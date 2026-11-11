import bot,{runRetentionTask06,previewRetentionTask06} from '../../release/ASTRA_2_5_TASK06_CANDIDATE.js';
import {scenario25,fakeBot25,actor25,generation25,metadata,wallet25,quote25,press25,pick25,screen25,sent25,openTarot25,seedHistorical25,stage25} from '../task04/upgrade-helpers.mjs';
import {upgradeLocal25,readState25} from '../../scripts/lib/astra25-upgrade06.mjs';
export function scenario06(){const c=scenario25();return {...c,migrate:extra=>upgradeLocal25({...c.options,...extra}),async ready(){await upgradeLocal25(c.options);const db=c.open(),fake=fakeBot25(db,{bot});return {db,fake};}};}
export function fakeBot06(db,options={}){return fakeBot25(db,{bot,...options});}
export function enable06(db,fake,config={}){if(Object.keys(config).length){const keys=Object.keys(config);db.prepare('UPDATE astra_tarot30_policy SET '+keys.map(k=>k+'=?').join(',')+',revision=revision+1 WHERE singleton=1').run(...Object.values(config));}db.exec('UPDATE astra_tarot25_runtime29 SET enabled=1;UPDATE astra_tarot30_policy SET write_enabled=1');Object.assign(fake.env,{ASTRA_TAROT25_ENABLED:'true',ASTRA_TAROT25_STORAGE_TEST_MODE:'true'});}
export {clock30 as clock06} from '../../scripts/lib/tarot30-synthetic.mjs';

export {bot,runRetentionTask06,previewRetentionTask06,actor25,generation25,metadata,wallet25,quote25,press25,pick25,screen25,sent25,openTarot25,seedHistorical25,stage25};
export {scenario06 as scenario25,enable06 as enable25,fakeBot06 as fakeBot25New};

export {readState25};
