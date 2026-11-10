export {broadcastFixture as uiFixture,click,last,withClock,instrument} from './task03-helpers.mjs';
export {setupFence,activate,starSetup,members,starProof,sign} from './task01-helpers.mjs';
export function normalizeUi04(row){const text=JSON.stringify(row);return JSON.parse(text.replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/g,'<order>').replace(/shell:tarot26:[a-f0-9]{32}/g,'shell:tarot26:<offer>').replace(/Номер обращения: [a-f0-9]{16}/g,'Номер обращения: <reference>').replace(/\d{2}\.\d{2}\.\d{4},? \d{2}:\d{2}:\d{2}/g,'<московское время>'));}
