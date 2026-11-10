import fs from 'node:fs';import {createSynthetic20} from './lib/astra25-synthetic.mjs';
const args=process.argv.slice(2);if(args.length!==3||args[0]!=='--local-only'||args[1]!=='--output')throw Error('Use --local-only --output /absolute/new-origin.sqlite');
const metadata=await createSynthetic20(args[2]);fs.writeFileSync(args[2]+'.synthetic.json',JSON.stringify(metadata,null,2)+'\n',{flag:'wx',mode:0o600});console.log(JSON.stringify({synthetic:true,users:metadata.users,balance_total:metadata.balance_total,source:args[2]}));
