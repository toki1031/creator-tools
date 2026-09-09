import { getProject } from './db.js';
import { assessBgmRights, createBgmCreditLines } from './bgmRights.js';

const app=document.querySelector('#app');
let installing=false;
function projectId(){const match=location.hash.match(/^#\/project\/([^/]+)\/publish/);return match?decodeURIComponent(match[1]):''}
function esc(value=''){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

async function install(){
  if(installing||!app) return;
  const id=projectId();
  if(!id||app.querySelector('[data-publish-rights]')) return;
  const main=app.querySelector('main');
  if(!main) return;
  installing=true;
  try{
    const project=await getProject(id);
    if(!project||projectId()!==id) return;
    const bgm=project.bgm||{};
    if(!bgm.audioData&&!bgm.dataUrl&&!bgm.title&&!bgm.sourceUrl&&!bgm.license&&!bgm.credit) return;
    const rights=assessBgmRights(bgm);
    const lines=createBgmCreditLines(bgm);
    const section=document.createElement('section');
    section.className='card';
    section.dataset.publishRights='1';
    const status=rights.status==='ready'?'確認済み':rights.status==='blocked'?'商用利用不可':'要確認';
    section.innerHTML=`<h2>権利・クレジット確認</h2><p class="notice">BGM登録時に保存した情報だけを表示します。Creator OSが利用許諾を自動判定するものではありません。</p><p><strong>BGM：${esc(status)}</strong> — ${esc(rights.message)}</p>${lines.length?`<textarea data-credit-lines rows="${Math.min(6,Math.max(2,lines.length))}" readonly>${esc(lines.join('\n'))}</textarea><button type="button" data-copy-credit>クレジット情報をコピー</button>`:'<p class="muted">保存済みのクレジット情報はありません。</p>'}`;
    main.appendChild(section);
    section.querySelector('[data-copy-credit]')?.addEventListener('click',async()=>{
      const value=lines.join('\n');
      try{await navigator.clipboard.writeText(value);}catch{const area=section.querySelector('[data-credit-lines]');area?.select();document.execCommand?.('copy');}
    });
  }catch(error){console.warn('Publish rights UI unavailable',error)}finally{installing=false}
}
const observer=new MutationObserver(()=>void install());
if(app)observer.observe(app,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>queueMicrotask(install));
void install();
