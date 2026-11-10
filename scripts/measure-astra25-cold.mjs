// Fresh-process local import CPU/wall/RSS. NOT Cloudflare CPU or workerd acceptance.
import fs from 'node:fs';import {pathToFileURL} from 'node:url';import {ROOT25,CANDIDATE25,PINNED_CANDIDATE25,sha25} from './lib/astra25-upgrade-plan.mjs';
const args=process.argv.slice(2);if(args.length<1||args[0]!=='--local-only'||args.length>2)throw Error('--local-only [absolute /tmp/astra25-task04-dryrun-* bundle]');
const file=args[1]||ROOT25+CANDIDATE25;if(args[1]&&!file.startsWith('/tmp/astra25-task04-dryrun-'))throw Error('Only pinned local dry-run output');const hash=sha25(fs.readFileSync(file));if(!args[1]&&hash!==PINNED_CANDIDATE25)throw Error('Candidate changed');
const cpu=process.cpuUsage(),start=performance.now(),worker=(await import(pathToFileURL(file))).default;if(typeof worker.fetch!=='function')throw Error('Candidate not importable');const delta=process.cpuUsage(cpu);
console.log(JSON.stringify({target:args[1]?'wrangler_dryrun':'frozen_candidate',sha256:hash,import_wall_ms:performance.now()-start,process_cpu_ms:(delta.user+delta.system)/1000,rss_bytes:process.memoryUsage().rss,cloudflare_cpu_measured:false}));
