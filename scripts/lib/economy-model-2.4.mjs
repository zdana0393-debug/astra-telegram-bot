// Planning only. Never imported by the Worker or migrations; owner approval required.
export const ECONOMY_OPTIONS=Object.freeze([
 Object.freeze({id:'current',name:'Текущий кандидат',initial:12,daily:3,first3:3,weekly:5,thirty:12,referrer:14,invitee:4,channel:8}),
 Object.freeze({id:'balanced',name:'Сбалансированный',initial:6,daily:1,first3:3,weekly:3,thirty:6,referrer:8,invitee:2,channel:5}),
 Object.freeze({id:'economical',name:'Экономный',initial:3,daily:1,first3:0,weekly:1,thirty:3,referrer:4,invitee:1,channel:3})
]);
export function modelEconomy(policy,days,{existing=false,gapped=false}={}){
 let total=existing?0:policy.initial,extendedBalance=total,mixedBalance=total,extended=0,mixedExtended=0,tarots=0,streak=0,visits=0;
 for(let day=1;day<=days;day++){
  if(gapped&&day%2===0){streak=0;continue;}visits++;streak++;
  const grant=policy.daily+(visits===3&&streak===3?policy.first3:0)+(streak%7===0?policy.weekly:0)+(visits===30?policy.thirty:0);
  total+=grant;extendedBalance+=grant;mixedBalance+=grant;
  if(extendedBalance>=4){extendedBalance-=4;extended++;}if(mixedBalance>=4){mixedBalance-=4;mixedExtended++;}
  if(day%7===0&&mixedBalance>=3){mixedBalance-=3;tarots++;}
 }
 return{days,visits,granted:total,tarotOnly:Math.floor(total/3),tarotRemainder:total%3,extendedOnly:extended,extendedRemainder:extendedBalance,mixedExtended,mixedTarot:tarots,mixedRemainder:mixedBalance};
}
export function daysForPack(policy,dust){for(let n=1;n<=2000;n++)if(modelEconomy(policy,n).granted>=dust)return n;return null;}
