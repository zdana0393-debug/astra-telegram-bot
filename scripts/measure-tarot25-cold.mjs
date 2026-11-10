// Run in a fresh Node process. Wall time/RSS approximate; never Cloudflare CPU.
const start=performance.now();await import('../release/ASTRA_2_5_TASK03_CANDIDATE.js');console.log(JSON.stringify({import_ms:performance.now()-start,rss:process.memoryUsage().rss}));
