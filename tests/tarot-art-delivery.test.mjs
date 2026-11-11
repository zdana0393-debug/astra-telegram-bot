import {test} from 'node:test';
import assert from 'node:assert/strict';
import names from '../data/tarot25-art-contract07.json' with {type:'json'};
import {validateTelegramArt, imagePlan, sendArt, sendPurchasedArt} from '../src/tarot25/art-delivery.mjs';
import {createReadingV2} from '../src/tarot25/engine-v2.mjs';
import {seededRng} from '../src/tarot25/engine.mjs';
import {SPREADS} from '../src/tarot25/spreads.mjs';
import {registry,verifyPrivateMockMedia} from './fixtures/art-private-registry.mjs';
import fs from 'node:fs';
import {validateArtManifest,cardPresentation} from '../src/tarot25/art07.mjs';
const env = {ASTRA_TAROT_ART_ENABLED: 'true', ASTRA_BOT_TOKEN: '901:OFFLINE_NOT_REAL', ASTRA_TELEGRAM_TEST_MODE: 'true'};
const actor = {telegram_id: 12, generation: 'synthetic-generation'};
const card = {card_id: 'major-00', reversed: false, position_id: 'day'};
function ack(id, n = 1) { return Array.from({length: n}, (_,i) => ({message_id: i + 10, chat: {id, type: 'private'}, photo: [{file_id: 'SYNTHETIC_ACK_PHOTO'}]})); }
const options = () => ({env, actor, registry, cards: [card], verify: async () => true, send: async () => ack(12)[0]});
test('complete private registry requires156 unique bot-specific file IDs', () => assert.equal(validateTelegramArt(registry), true));
for (const c of names) for (const reversed of [false, true]) test(c.card_id + ' maps saved orientation ' + reversed, () => {
  const plan = imagePlan(registry, [{card_id: c.card_id, reversed, position_id: 'saved-position'}]);
  assert.equal(plan[0].media, 'SYNTHETIC_' + (reversed ? 'REVERSED_' : 'UPRIGHT_') + c.card_id);
  assert.ok(plan[0].caption.includes(c.name_ru));
  verifyPrivateMockMedia(plan[0].media);
});
for (const mutation of ['duplicate', 'unknown', 'missing', 'same_image', 'url', 'unique_id', 'no_hash']) test('fail closed registry ' + mutation, () => {
  const r = structuredClone(registry);
  if (mutation === 'duplicate') r.cards[1].card_id = r.cards[0].card_id;
  if (mutation === 'unknown') r.cards[0].card_id = 'The_Fool';
  if (mutation === 'missing') r.cards.pop();
  if (mutation === 'same_image') r.cards[0].reversed = r.cards[0].upright;
  if (mutation === 'url') r.cards[0].upright.file_id = 'https://public.invalid/face.jpg';
  if (mutation === 'unique_id') r.cards[0].upright = {file_unique_id: 'NO_DOWNLOAD_ID'};
  if (mutation === 'no_hash') delete r.source_manifest_sha256;
  assert.throws(() => validateTelegramArt(r));
});
test('default OFF makes zero verification/HTTP calls, even without registry', async () => {
  assert.deepEqual(await sendArt({env:{},verify:()=>assert.fail(),send:()=>assert.fail()}), {state:'disabled',http:0});
});
for (const mutation of ['bot', 'realm', 'deleted', 'db_error']) test('no image leaks across ' + mutation, async () => {
  const opts = options(); let sent = 0; opts.send = async () => { sent++; };
  if (mutation === 'bot') opts.env = {...env, ASTRA_BOT_TOKEN:'902:OFFLINE'};
  if (mutation === 'realm') opts.env = {...env, ASTRA_TELEGRAM_TEST_MODE:'false'};
  if (mutation === 'deleted') opts.verify = async () => false;
  if (mutation === 'db_error') opts.verify = async () => { throw Error('SYNTHETIC_D1'); };
  assert.equal((await sendArt(opts)).state, 'unavailable'); assert.equal(sent, 0);
});
for (const fault of [403,429,500,'network','wrong_chat','short_ack','no_ack','duplicate_ack']) test('photo failure no automatic retry ' + fault, async () => {
  let calls = 0; const opts = options();
  if (fault === 'duplicate_ack') opts.cards = [card, {...card,card_id:'major-01',position_id:'advice'}];
  opts.send = async () => { calls++;
    if (Number.isInteger(fault)) throw Object.assign(Error('OFFLINE'), {telegramCode:fault,retryAfter:1});
    if (fault === 'network') throw Error('UNKNOWN_NETWORK_OUTCOME');
    if (fault === 'wrong_chat') return ack(13)[0];
    if (fault === 'short_ack') return {message_id:1};
    if (fault === 'duplicate_ack') return [ack(12)[0],ack(12)[0]];
    return true;
  };
  const r = await sendArt(opts); assert.equal(calls,1);
  assert.equal(r.state, fault === 403 ? 'rejected' : fault === 429 ? 'rate_limited' : 'unknown');
});
for (const spread of SPREADS) test('album preserves all saved positions in ' + spread.spread_id, async () => {
  const snapshot = createReadingV2({spread_id:spread.spread_id,theme:spread.theme,rng:seededRng(spread.spread_id)});
  const material = {snapshot,result:snapshot.text,telegram_id:12,generation:actor.generation};
  const before = JSON.stringify(material), calls = [];
  const r = await sendPurchasedArt({...options(),material,send:async(method,body)=>{ calls.push({method,body}); return ack(12,snapshot.cards.length); }});
  assert.equal(r.state,'sent'); assert.equal(calls.length,1); assert.equal(calls[0].method,'sendMediaGroup');
  assert.deepEqual(calls[0].body.media.map(x=>x.media), imagePlan(registry,snapshot.cards).map(x=>x.media));
  assert.equal(calls[0].body.protect_content,true); assert.equal(JSON.stringify(material),before);
});
test('legacy material stays text only; absent canonical snapshot never guesses card IDs',async()=>assert.equal((await sendPurchasedArt({...options(),material:{result:'Историческое чтение'}})).state,'legacy_text_only'));
test('a foreign paid snapshot cannot be shown',async()=>{
  const s=createReadingV2({spread_id:'basic-3',rng:seededRng('private')});
  const r=await sendPurchasedArt({...options(),material:{snapshot:s,result:s.text,telegram_id:13,generation:actor.generation},send:()=>assert.fail()});
  assert.equal(r.http,0);assert.equal(r.state,'unavailable');
});
test('the existing invocation budget defers optional photos without a network attempt',async()=>{
  const r=await sendArt({...options(),send:async()=>{throw Object.assign(Error('UI_OPERATION_BUDGET'),{code:'UI_OPERATION_BUDGET',no_ui_retry:true});}});
  assert.deepEqual(r,{state:'deferred',http:0});
});
test('the frozen paid V1 fixture supplies the same saved images without current engine regeneration',async()=>{
  const snapshot=JSON.parse(fs.readFileSync('tests/fixtures/tarot25/reading-v1.json','utf8'));
  let observed;
  const r=await sendPurchasedArt({...options(),material:{snapshot,result:snapshot.text,telegram_id:12,generation:actor.generation},send:async(method,body)=>{observed=body.media;return ack(12,snapshot.cards.length);}});
  assert.equal(r.state,'sent');assert.deepEqual(observed,imagePlan(registry,snapshot.cards));
});
test('real admitted private manifest is compatible with the existing TASK07 art contract',
  {skip:!process.env.ASTRA_PRIVATE_TAROT_MANIFEST},()=>{
    const m=JSON.parse(fs.readFileSync(process.env.ASTRA_PRIVATE_TAROT_MANIFEST,'utf8'));
    assert.deepEqual(validateArtManifest(m),{total:78,available:78,missing:0,text_fallback:false});
    for(const c of m.cards)for(const reversed of [false,true]){
      const view=cardPresentation(m,{card_id:c.card_id,reversed,position_id:'saved-position'},{art_enabled:true});
      assert.equal(view.card_id,c.card_id);assert.equal(view.rotation,reversed?180:0);
      assert.equal(view.asset,c['telegram_'+(reversed?'reversed':'upright')]);assert.equal(view.text_only,false);
    }
  });
