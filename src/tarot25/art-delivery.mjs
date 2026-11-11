// Optional presentation only. No RNG, payments, writes, public URLs or automatic retries.
import names from '../../data/tarot25-art-contract07.json' with {type:'json'};
import {validateSnapshot} from './reader-v2.mjs';
const known = new Map(names.map(c => [c.card_id, c.name_ru]));
const yes = x => x === true || x === 'true';
const fileId = x => typeof x === 'string' && /^[A-Za-z0-9_-]{8,512}$/.test(x);
const need = (ok, code) => { if (!ok) throw Error(code); };

export function validateTelegramArt(registry) {
  need(registry?.version === 'astra-telegram-art-v1' && registry.deck_version === 'rws78-v1', 'ART_REGISTRY_VERSION');
  need(typeof registry.art_version === 'string' && /^[a-zA-Z0-9._-]{1,80}$/.test(registry.art_version), 'ART_VERSION');
  need(Number.isSafeInteger(registry.bot_id) && registry.bot_id > 0 && ['test', 'production'].includes(registry.realm), 'ART_BOT_SCOPE');
  need(/^[a-f0-9]{64}$/.test(registry.source_manifest_sha256 ?? ''), 'ART_MANIFEST_HASH');
  need(Array.isArray(registry.cards) && registry.cards.length === 78, 'ART_CARD_COUNT');
  const ids = new Set(), media = new Set();
  for (const c of registry.cards) {
    need(known.has(c.card_id) && !ids.has(c.card_id), 'ART_CARD_ID'); ids.add(c.card_id);
    for (const orientation of ['upright', 'reversed']) {
      const id = c[orientation]?.file_id;
      need(fileId(id) && !media.has(id), 'ART_FILE_ID'); media.add(id);
    }
  }
  return true;
}

export function imagePlan(registry, cards) {
  validateTelegramArt(registry);
  need(Array.isArray(cards) && cards.length >= 1 && cards.length <= 10, 'ART_DRAW_SIZE');
  const rows = new Map(registry.cards.map(c => [c.card_id, c])), seen = new Set();
  return cards.map((c, i) => {
    need(known.has(c.card_id) && !seen.has(c.card_id) && typeof c.reversed === 'boolean', 'ART_DRAW_CARD');
    need(typeof c.position_id === 'string' && c.position_id.length > 0, 'ART_DRAW_POSITION'); seen.add(c.card_id);
    const orientation = c.reversed ? 'reversed' : 'upright';
    return {type: 'photo', media: rows.get(c.card_id)[orientation].file_id,
      caption: `Карта ${i + 1} · ${known.get(c.card_id)} · ${c.reversed ? 'перевёрнутая' : 'прямая'}`};
  });
}

function validateAck(result, count, chatId) {
  const messages = count === 1 ? [result] : result;
  need(Array.isArray(messages) && messages.length === count, 'ART_ACK_UNKNOWN');
  const seen = new Set();
  for (const m of messages) {
    need(Number.isSafeInteger(m?.message_id) && m.message_id > 0 && !seen.has(m.message_id)
      && m.chat?.id === chatId && m.chat?.type === 'private' && Array.isArray(m.photo)
      && m.photo.length > 0 && m.photo.every(p => fileId(p.file_id)), 'ART_ACK_UNKNOWN');
    seen.add(m.message_id);
  }
}

// registry is injected by the PRIVATE build, never a query parameter or public JSON.
// verify must re-check current profile/generation/ownership immediately before HTTP.
export async function sendArt({env, registry, actor, cards, send, verify}) {
  if (!yes(env.ASTRA_TAROT_ART_ENABLED)) return {state: 'disabled', http: 0};
  let attempted = false;
  try {
    validateTelegramArt(registry);
    const botId = Number(String(env.ASTRA_BOT_TOKEN ?? '').split(':')[0]);
    need(botId === registry.bot_id && registry.realm === (yes(env.ASTRA_TELEGRAM_TEST_MODE) ? 'test' : 'production'), 'ART_BOT_SCOPE');
    need(Number.isSafeInteger(actor?.telegram_id) && actor.telegram_id > 0 && typeof actor.generation === 'string', 'ART_ACTOR');
    const media = imagePlan(registry, cards);
    need(typeof verify === 'function' && await verify(), 'ART_NOT_OWNED');
    const body = media.length === 1
      ? {chat_id: actor.telegram_id, photo: media[0].media, caption: media[0].caption, protect_content: true}
      : {chat_id: actor.telegram_id, media, protect_content: true};
    attempted = true;
    const result = await send(media.length === 1 ? 'sendPhoto' : 'sendMediaGroup', body);
    validateAck(result, media.length, actor.telegram_id);
    return {state: 'sent', http: 1, cards: media.length};
  } catch (e) {
    // No automatic retry even on 429. An explicit free history read is the recovery path.
    if (e.code === 'UI_OPERATION_BUDGET') return {state: 'deferred', http: 0};
    const code = Number.isInteger(e.telegramCode) ? e.telegramCode : null;
    return {state: !attempted ? 'unavailable' : code === 429 ? 'rate_limited' : code >= 400 && code < 500 ? 'rejected' : 'unknown',
      http: attempted ? 1 : 0};
  }
}

export async function sendPurchasedArt({env, registry, actor, material, send, verify}) {
  if (!yes(env.ASTRA_TAROT_ART_ENABLED)) return {state: 'disabled', http: 0};
  // Legacy3/5 had no canonical card snapshot: preserve their exact text, do not guess IDs.
  if (!material?.snapshot) return {state: 'legacy_text_only', http: 0};
  try {
    validateSnapshot(material.snapshot);
    need(material.telegram_id === actor.telegram_id && material.generation === actor.generation
      && material.result === material.snapshot.text, 'ART_NOT_OWNED');
  } catch { return {state: 'unavailable', http: 0}; }
  return sendArt({env, registry, actor, cards: material.snapshot.cards, send, verify});
}
