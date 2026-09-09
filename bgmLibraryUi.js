import { getProject, saveProject } from './db.js';
import { createAudioAssetIdFromFile } from './audioAssetIdentity.js';
import { recordBgmSelectionChange } from './decisionLog.js';
import { rankBgmTracks, bgmRecommendationReason } from './bgmRecommendation.js';

const DB_NAME='creator-os-bgm-library';
const STORE='tracks';
const app=document.querySelector('#app');
let installedFor='';
let objectUrls=[];

function projectIdFromHash(){
  const m=location.hash.match(/^#\/project\/([^/]+)\/bgm/);
  return m ? decodeURIComponent(m[1]) : '';
}
function openDb(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
  });
}
function txDone(tx){return new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
async function listTracks(){
  const db=await openDb();
  try{const tx=db.transaction(STORE,'readonly');const req=tx.objectStore(STORE).getAll();const rows=await new Promise((res,rej)=>{req.onsuccess=()=>res(req.result||[]);req.onerror=()=>rej(req.error);});return rows.sort((a,b)=>String(b.updatedAt).localeCompare(String(a.updatedAt)));}
  finally{db.close();}
}
async function putTrack(track){const db=await openDb();try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(track);await txDone(tx);}finally{db.close();}}
async function deleteTrack(id){const db=await openDb();try{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(id);await txDone(tx);}finally{db.close();}}
function blobToDataUrl(blob){return new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});}
function esc(v=''){return String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function cleanupUrls(){objectUrls.forEach(url=>URL.revokeObjectURL(url));objectUrls=[];}

async function useTrack(track){
  const projectId=projectIdFromHash();
  if(!projectId) return;
  const project=await getProject(projectId);
  if(!project) throw new Error('プロジェクトが見つかりません。');
  const file=new File([track.blob],track.fileName||`${track.title||'bgm'}.audio`,{type:track.mimeType||track.blob?.type||'audio/mpeg'});
  const audioData=await blobToDataUrl(track.blob);
  const audioAssetId=await createAudioAssetIdFromFile(file);
  const beforeAudioAssetId=project.bgm?.audioAssetId;
  const hadBgmBefore=Boolean(project.bgm?.audioData);
  project.bgm={
    ...(project.bgm||{}),source:'library',title:track.title||track.fileName||'BGM',category:track.category||project.bgm?.category||'calm',
    license:track.license||'',credit:track.credit||'',sourceUrl:track.sourceUrl||'',commercialUse:track.commercialUse||'unknown',
    audioData,fileName:track.fileName||file.name,mimeType:file.type,audioAssetId
  };
  recordBgmSelectionChange(project,{beforeAudioAssetId,afterAudioAssetId:audioAssetId,selectionMethod:'library',hadBgmBefore,bgmCategory:project.bgm.category,ducking:project.bgm.ducking!==false,loop:project.bgm.loop!==false});
  project.updatedAt=new Date().toISOString();
  await saveProject(project);
  const current=app?.querySelector('#audioPreview');if(current)current.src=audioData;
  const fileName=app?.querySelector('#fileName');if(fileName)fileName.textContent=project.bgm.fileName;
  const source=app?.querySelector('#source');if(source)source.value='library';
  alert(`BGM「${track.title||track.fileName}」を設定しました。`);
}

async function renderLibrary(container){
  cleanupUrls();
  const tracks=await listTracks();
  const list=container.querySelector('[data-bgm-library-list]');
  if(!tracks.length){list.innerHTML='<p class="muted">まだ登録がありません。無料BGMを一度登録すると、次回からここで選べます。</p>';return;}
  const project=await getProject(projectIdFromHash());
  const ranked=rankBgmTracks(tracks,project||{},3);
  const recommendedIds=new Set(ranked.map(row=>row.track.id));
  const scoreById=new Map(ranked.map(row=>[row.track.id,row.score]));
  const displayTracks=[...tracks].sort((a,b)=>(scoreById.get(b.id)??-Infinity)-(scoreById.get(a.id)??-Infinity)||String(b.updatedAt).localeCompare(String(a.updatedAt)));
  list.innerHTML=displayTracks.map(track=>{
    const url=URL.createObjectURL(track.blob);objectUrls.push(url);
    const recommended=recommendedIds.has(track.id);
    const reason=recommended?`<small><strong>おすすめ</strong> ${esc(bgmRecommendationReason(track,project||{}))}</small>`:'';
    return `<article class="bgm-library-item" data-bgm-id="${esc(track.id)}"><div><b>${recommended?'★ ':''}${esc(track.title||track.fileName)}</b><small>${esc(track.category||'未分類')} / ${esc(track.license||'ライセンス未記入')}</small>${reason}${track.sourceUrl?`<small>${esc(track.sourceUrl)}</small>`:''}</div><audio controls preload="none" src="${url}"></audio><div class="tool-row"><button type="button" class="primary" data-use-bgm="${esc(track.id)}">このBGMを使う</button><button type="button" class="danger" data-delete-bgm="${esc(track.id)}">ライブラリから削除</button></div></article>`;
  }).join('');
  list.querySelectorAll('[data-use-bgm]').forEach(btn=>btn.onclick=async()=>{const track=tracks.find(x=>x.id===btn.dataset.useBgm);if(!track)return;btn.disabled=true;try{await useTrack(track);}catch(e){alert(`BGM設定に失敗しました：${e?.message||e}`);}finally{btn.disabled=false;}});
  list.querySelectorAll('[data-delete-bgm]').forEach(btn=>btn.onclick=async()=>{if(!confirm('このBGMをライブラリから削除しますか？\n現在のプロジェクトに設定済みのBGMは消しません。'))return;await deleteTrack(btn.dataset.deleteBgm);await renderLibrary(container);});
}

function install(){
  const projectId=projectIdFromHash();
  const audioFile=app?.querySelector('#audioFile');
  if(!projectId||!audioFile||installedFor===projectId) return;
  installedFor=projectId;
  const host=audioFile.closest('.editor-card')||audioFile.parentElement;
  if(!host||host.querySelector('[data-bgm-library]')) return;
  const section=document.createElement('section');
  section.className='bgm-library-panel';section.dataset.bgmLibrary='1';
  section.innerHTML=`<hr><div class="section-head"><div><h3>マイBGMライブラリ</h3><p>一度登録した無料BGMを次の動画でもすぐ使えます。動画ジャンルに合う候補を上に表示します。</p></div><button type="button" data-add-bgm>＋ BGMを登録</button></div><input type="file" accept="audio/*,.mp3,.m4a,.aac,.wav,.ogg" data-add-bgm-file hidden><div data-bgm-library-list></div><dialog data-bgm-meta><form method="dialog"><h3>BGM情報</h3><label>曲名<input name="title" required></label><label>用途<select name="category"><option value="calm">落ち着き</option><option value="inspiring">前向き</option><option value="dramatic">ドラマチック</option><option value="traditional">和・伝統</option><option value="ambient">環境・アンビエント</option><option value="other">その他</option></select></label><label>配布元URL<input name="sourceUrl" inputmode="url" placeholder="https://..."></label><label>ライセンス<input name="license" placeholder="例：CC0 / 配布サイト利用規約"></label><label>商用利用<select name="commercialUse"><option value="unknown">未確認</option><option value="allowed">可</option><option value="not-allowed">不可</option></select></label><label>クレジット表記<input name="credit" placeholder="不要なら空欄"></label><p class="notice">「動画で無料利用できる」と「音源の再配布ができる」は別です。このライブラリはあなたの端末内で再利用するためのものです。</p><div class="dialog-actions"><button value="cancel">キャンセル</button><button value="default" class="primary">登録</button></div></form></dialog>`;
  host.appendChild(section);
  const picker=section.querySelector('[data-add-bgm-file]');const dialog=section.querySelector('[data-bgm-meta]');const form=dialog.querySelector('form');let pendingFile=null;
  section.querySelector('[data-add-bgm]').onclick=()=>{picker.value='';picker.click();};
  picker.onchange=()=>{const file=picker.files?.[0];if(!file)return;if(file.size>20_000_000&&!confirm('20MBを超える音源です。端末容量を大きく使いますが登録しますか？'))return;pendingFile=file;form.elements.title.value=file.name.replace(/\.[^.]+$/,'');dialog.showModal();};
  form.addEventListener('submit',async event=>{event.preventDefault();if(!pendingFile)return;const data=new FormData(form);const bytes=new Uint8Array(await pendingFile.arrayBuffer());let hash=2166136261;for(const b of bytes){hash^=b;hash=Math.imul(hash,16777619);}const id=`bgm-${(hash>>>0).toString(16)}-${pendingFile.size}`;await putTrack({id,blob:pendingFile,fileName:pendingFile.name,mimeType:pendingFile.type||'audio/mpeg',title:String(data.get('title')||pendingFile.name),category:String(data.get('category')||'other'),sourceUrl:String(data.get('sourceUrl')||''),license:String(data.get('license')||''),commercialUse:String(data.get('commercialUse')||'unknown'),credit:String(data.get('credit')||''),updatedAt:new Date().toISOString()});pendingFile=null;dialog.close();await renderLibrary(section);});
  void renderLibrary(section);
}

const observer=new MutationObserver(()=>install());
if(app)observer.observe(app,{childList:true,subtree:true});
window.addEventListener('hashchange',()=>{installedFor='';cleanupUrls();queueMicrotask(install);});
install();
