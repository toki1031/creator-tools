function clean(v=''){return String(v??'').trim();}
function narrationUnits(items=[]){
  const lines=Array.isArray(items)?items:[]; const kept=[];
  for(const raw of lines){const x=clean(raw); if(!x)continue; if(/^■/.test(x))break; kept.push(x);}
  const text=kept.join('\n');
  if(!text)return[];
  const sentences=text.replace(/\n+/g,'').match(/[^。！？!?]+[。！？!?]?/g)||[];
  return sentences.map(clean).filter(Boolean);
}
function weights(scenes){const total=scenes.reduce((n,s)=>n+(Number(s.durationSec)||1),0)||scenes.length;return scenes.map(s=>(Number(s.durationSec)||1)/total);}
function subtitlePreview(text,max=16){
  const s=clean(text); if(!s)return'';
  const first=(s.match(/[^。！？!?]+[。！？!?]?/g)||[s])[0];
  if(first.length<=max*2)return first.length>max?first.slice(0,max)+'\n'+first.slice(max):first;
  return first.slice(0,max)+'\n'+first.slice(max,max*2);
}
export function distributeGlobalNarration(scenes,brief){
  const source=Array.isArray(scenes)?scenes:[];
  if(!source.length)return[];
  const units=narrationUnits(brief?.narrationGuidance);
  if(!units.length)return source.map(s=>({...s}));
  const result=source.map(s=>({...s})); const w=weights(result); let cursor=0;
  for(let i=0;i<result.length;i++){
    if(clean(result[i].speechText))continue;
    const remainingScenes=result.slice(i).filter(s=>!clean(s.speechText)).length;
    const remainingUnits=units.length-cursor;
    if(remainingUnits<=0)break;
    const take=i===result.length-1?remainingUnits:Math.max(1,Math.min(remainingUnits-remainingScenes+1,Math.round(units.length*w[i])));
    const speech=units.slice(cursor,cursor+take).join(''); cursor+=take;
    result[i].speechText=speech;
    if(!clean(result[i].subtitleText))result[i].subtitleText=subtitlePreview(speech);
    if(!clean(result[i].text))result[i].text=result[i].subtitleText||speech;
  }
  return result;
}
