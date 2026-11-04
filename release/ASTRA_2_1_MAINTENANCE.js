// Safe write-free rollback/maintenance: Telegram will retry POST webhook requests.
// Never changes webhook or database. Use only by explicit owner decision.
export default {
  async fetch(request) {
    const path=new URL(request.url).pathname;
    if(path==='/health') return Response.json({version:'ASTRA-2.1-MAINTENANCE',ready:false},{status:503});
    return new Response('Temporarily unavailable',{status:503,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
  },
  async scheduled() {},
};
