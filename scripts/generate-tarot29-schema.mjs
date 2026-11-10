// Developer-only local generator; never connects to Cloudflare or Telegram.
import fs from 'node:fs';import {DatabaseSync} from 'node:sqlite';
const db=new DatabaseSync(':memory:');for(const file of ['src/02_SCHEMA.sql','migrations/0021_wallet.sql','migrations/0022_shell.sql','migrations/0023_forecast.sql','migrations/0024_activity_history.sql','migrations/0025_rewards_stars.sql','migrations/0026_economy_fence.sql','migrations/0027_broadcast.sql','migrations/0028_notification_consent.sql'])db.exec(fs.readFileSync(file,'utf8'));
const base=db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY name").all();fs.writeFileSync('data/tarot25-base-schema29.json',JSON.stringify(base,null,2)+'\n');
const dir='migrations/0029_steps/',initial=['01_tables.sql','02_offer_guards.sql','03_payment.sql'].map(p=>fs.readFileSync(dir+p,'utf8')).join('');db.exec(initial);
const rows=()=>db.prepare("SELECT name,type,sql FROM sqlite_master WHERE sql IS NOT NULL AND (name LIKE 'astra_tarot25_%29' OR name LIKE 'idx_tarot25_%29_%') ORDER BY name").all();
const vals=rows().map(x=>'('+[x.name,x.type,x.sql].map(s=>"'"+s.replaceAll("'","''")+"'").join(',')+')').join(',');
const prices=JSON.parse(fs.readFileSync('data/tarot25-prices29.json','utf8'));
const priceValues=prices.map(p=>'('+[p.price_version,p.spread_id,p.size,p.price,p.theme,p.positions_json].map(x=>typeof x==='number'?String(x):"'"+x.replaceAll("'","''")+"'").join(',')+')').join(',');
const priceDrift="WITH expected(price_version,spread_id,size,price,theme,positions_json) AS (VALUES "+priceValues+") SELECT count(*) FROM expected e LEFT JOIN astra_tarot25_prices29 t USING(price_version,spread_id) WHERE t.size IS NOT e.size OR t.price IS NOT e.price OR t.theme IS NOT e.theme OR t.positions_json IS NOT e.positions_json";
const completion=`CREATE TRIGGER IF NOT EXISTS astra_tarot25_complete29 BEFORE UPDATE OF migration_done ON astra_tarot25_runtime29 WHEN NEW.migration_done=1 BEGIN
 SELECT CASE WHEN OLD.migration_done=0 AND NEW.enabled<>0 THEN RAISE(ABORT,'Tarot migration must complete OFF') END;
 SELECT CASE WHEN (WITH expected(name,type,sql) AS (VALUES ${vals}) SELECT count(*) FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR a.sql IS NOT e.sql)>0 THEN RAISE(ABORT,'Tarot29 definition mismatch') END;
 SELECT CASE WHEN (${priceDrift})>0 THEN RAISE(ABORT,'Tarot29 price data mismatch') END;
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM astra_consent_runtime28 WHERE singleton=1 AND migration_done=1) OR NOT EXISTS(SELECT 1 FROM astra_patch26 WHERE singleton=1 AND migration_done=1) OR (SELECT count(*) FROM astra_tarot25_prices29)<>7 THEN RAISE(ABORT,'Tarot29 prerequisites incomplete') END;
END;
UPDATE astra_tarot25_runtime29 SET migration_done=1 WHERE singleton=1;
`;
fs.writeFileSync(dir+'04_complete.sql',completion);fs.writeFileSync('migrations/0029_tarot.sql',initial+completion);db.exec(completion);fs.writeFileSync('data/tarot25-schema29.json',JSON.stringify(rows(),null,2)+'\n');
const definitions=[...base,...rows()].map(x=>'('+[x.name,x.type,x.sql].map(s=>"'"+s.replaceAll("'","''")+"'").join(',')+')').join(',');
const audit=`-- Aggregate/read-only. Candidate expects new catalogue OFF. No personal data.
WITH expected(name,type,sql) AS (VALUES ${definitions}) SELECT 'ddl_drift' AS check_name,count(*) AS violations FROM expected e LEFT JOIN sqlite_master a ON a.name=e.name WHERE a.type IS NOT e.type OR a.sql IS NOT e.sql;
SELECT 'tariff_data' AS check_name, (SELECT count(*) FROM astra_tarot25_prices29)<>7 OR (${priceDrift})>0 AS violations;
SELECT 'wallet' AS check_name,count(*) AS violations FROM astra_users u WHERE balance<0 OR balance<>(SELECT coalesce(sum(delta),0) FROM astra_wallet_ledger l WHERE l.telegram_id=u.telegram_id)
UNION ALL SELECT 'new_ledger',count(*) FROM astra_tarot25_purchases29 p WHERE NOT EXISTS(SELECT 1 FROM astra_wallet_ledger l WHERE l.idempotency_key='tarot25:'||p.offer_id AND l.telegram_id=p.telegram_id AND l.delta=-p.price AND l.reason='tarot:v25')
UNION ALL SELECT 'orphan_ledger',count(*) FROM astra_wallet_ledger l WHERE l.reason='tarot:v25' AND NOT EXISTS(SELECT 1 FROM astra_tarot25_purchases29 p WHERE 'tarot25:'||p.offer_id=l.idempotency_key AND p.telegram_id=l.telegram_id AND l.delta=-p.price)
UNION ALL SELECT 'owner_generation',count(*) FROM astra_tarot25_offers29 o LEFT JOIN astra_users u USING(telegram_id) LEFT JOIN astra_user_policy g USING(telegram_id) WHERE u.telegram_id IS NULL OR g.generation IS NOT o.generation
UNION ALL SELECT 'paid_snapshot',count(*) FROM astra_tarot25_purchases29 p LEFT JOIN astra_tarot25_offers29 o USING(offer_id) WHERE o.offer_id IS NULL OR p.snapshot_json IS NOT o.snapshot_json OR p.result IS NOT o.result OR p.price IS NOT o.price OR p.generation IS NOT o.generation OR p.spread_id IS NOT o.spread_id OR p.theme IS NOT o.theme OR p.size IS NOT o.size OR p.price_version IS NOT o.price_version OR p.deck_version IS NOT o.deck_version OR p.engine_version IS NOT o.engine_version OR p.spread_version IS NOT o.spread_version OR p.snapshot_version IS NOT o.snapshot_version
UNION ALL SELECT 'catalogue_not_off',count(*) FROM astra_tarot25_runtime29 WHERE enabled<>0 OR migration_done<>1;
PRAGMA foreign_key_check;
`;
fs.writeFileSync('scripts/check_integrity_tarot25_29.sql',audit);console.log('Generated 0029: '+base.length+' base + '+rows().length+' new (see manifest).');db.close();
