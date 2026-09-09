import { summarizeBgmRights } from './bgmRights.js';

const DB_NAME='creator-os-bgm-library';
const STORE='tracks';
const app=document.querySelector('#app');
let busy=false;

function onBgmRoute(){return /^#\/project\/[^/]+\/bgm/.test(location.hash)}
function openDb(){return new Promise((resolve,reject)=>{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});}
async function listTracks(){const db=await openDb();try{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();return await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);});}finally{db.close();}}

async function install(){
  if(busy||!app||!onBgmRoute()) return;
  const library=app.querySelector('[data-bgm-library]');
  if(!library||library.querySelector('[data-bgm-rights-summary]')) return;
  busy=true;
  try{
    const summary=summarizeBgmRights(await listTracks());
    if(!onBgmRoute()) return;
    const box=document.createElement('div');
    box.dataset.bgmRightsSummary='1';
    box.className='notice';
    box.style.margin='10px 0';
    if(!summary.total) box.textContent='BGMを登録すると、配布元・ライセンス・商用利用可否をここで確認できます。';
    else if(summary.blocked) box.textContent=`権利確認：利用可 ${summary.ready} / 要確認 ${summary.review} / 商用利用不可 ${summary.blocked}。商用利用不可の曲はおすすめ対象になりません。`;
    else if(summary.review) box.textContent=`権利確認：利用可 ${summary.ready} / 要確認 ${summary.review}。未確認の曲は配布元URL・ライセンス・商用利用可否を確認してください。`;
    else box.textContent=`権利確認：登録済み ${summary.total}曲すべて確認済みです。`;
    const list=library.querySelector('[data-bgm-library-list]');
    if(list) library.insertBefore(box,list); else library.prepend(box);
  }catch(error){console.warn('BGM rights summary unavailable',error)}
  finally{busy=false}
}

const observer=new MutationObserver(()=>void install());
if(app)observer.observe(app,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>queueMicrotask(install));
void install();
