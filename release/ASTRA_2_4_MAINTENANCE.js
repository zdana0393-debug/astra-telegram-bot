// Emergency writer pause only. No D1, Bot API, acknowledgement or migration.
export default {
  async fetch(request){
    const health=new URL(request.url).pathname==='/health';
    return new Response(health?JSON.stringify({version:'ASTRA-2.4-maintenance',ready:false,maintenance:true}):'Astra: maintenance; retry later',{
      status:503,headers:{'Content-Type':health?'application/json; charset=utf-8':'text/plain; charset=utf-8','Retry-After':'30','Cache-Control':'no-store'}
    });
  },
  async scheduled(){}
};
