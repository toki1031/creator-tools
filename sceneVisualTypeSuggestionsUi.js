import { getProject, listProjects, saveProject } from './db.js';
import { suggestSceneVisualTypes } from './sceneVisualTypeSuggestions.js';
import { getSceneVisualTypeFeedbackState, recordSceneVisualTypeFeedback } from './sceneVisualTypeFeedback.js';

const esc = (value='') => String(value).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]||c));
function route(){ const [page,id]=location.hash.replace(/^#\/?/,'').split('/'); return page==='scenes'&&id?{projectId:decodeURIComponent(id)}:null; }
function ensureDialog(){
  let d=document.getElementById('sceneVisualTypeDialog'); if(d)return d;
  d=document.createElement('dialog'); d.id='sceneVisualTypeDialog'; d.className='shorts-highlight-dialog';
  d.innerHTML=`<div class="section-head"><div><h2>Scene映像タイプ提案</h2><p>Scene本文から、内容を伝えやすい映像の種類をローカルで提案します。</p></div></div><label>対象Scene<select data-visual-scene></select></label><div data-visual-results></div><p class="notice">画像生成や素材適用は行いません。「どんな映像を探すか」を決めるための提案です。</p><div class="dialog-actions"><button type="button" data-visual-close>閉じる</button></div>`;
  document.body.appendChild(d); d.querySelector('[data-visual-close]').onclick=()=>d.close(); return d;
}
function replace(projects,project){const i=projects.findIndex(p=>String(p?.id)===String(project?.id)); if(i>=0)projects[i]=project;else projects.push(project);}
function render(d,project,projects,index){
  const host=d.querySelector('[data-visual-results]'), scene=project.scenes?.[index];
  if(!scene){host.innerHTML='<div class="empty"><p>Sceneが見つかりません。</p></div>';return;}
  const items=suggestSceneVisualTypes(scene,projects,{limit:3});
  if(!items.length){host.innerHTML='<div class="empty"><h3>明確な映像タイプを判定できませんでした</h3><p>このSceneは手動で映像方針を決めてください。判断例が増えると今後の候補改善に使えます。</p></div>';return;}
  const sceneId=String(scene.id||`scene-${index+1}`);
  host.innerHTML=`<div class="shorts-highlight-list">${items.map((item,i)=>{const state=getSceneVisualTypeFeedbackState(project,sceneId,item.typeId);return `<article class="editor-card shorts-highlight-card"><div class="section-head"><div><span class="eyebrow">候補 ${i+1}</span><h3>${esc(item.label)}</h3></div><strong>${item.score}点</strong></div><p>${esc(item.reason)}</p>${item.accepted||item.rejected?`<p class="muted">過去評価：採用 ${item.accepted}件／見送り ${item.rejected}件</p>`:''}<div class="tool-row"><button type="button" data-visual-action="accept" data-index="${i}" ${state==='accepted'?'disabled':''}>${state==='accepted'?'✓ 採用を記録済み':'この方向で探す'}</button><button type="button" data-visual-action="reject" data-index="${i}" ${state==='rejected'?'disabled':''}>${state==='rejected'?'✓ 見送りを記録済み':'今回は違う'}</button></div></article>`}).join('')}</div>`;
  host.querySelectorAll('[data-visual-action]').forEach(btn=>btn.onclick=async()=>{const item=items[Number(btn.dataset.index)],action=btn.dataset.visualAction;if(!item)return;btn.disabled=true;const old=btn.textContent;btn.textContent='記録中…';try{const rec=recordSceneVisualTypeFeedback(project,{scene,sceneIndex:index,suggestion:item,action});if(rec){project.updatedAt=new Date().toISOString();await saveProject(project);replace(projects,project);}render(d,project,projects,index);}catch(e){console.error(e);btn.disabled=false;btn.textContent=old;alert(`映像タイプの判断を保存できませんでした：${e instanceof Error?e.message:String(e)}`);}});
}
async function open(projectId){const [project,projects]=await Promise.all([getProject(projectId),listProjects()]);if(!project)throw new Error('プロジェクトを読み込めませんでした。');replace(projects,project);const d=ensureDialog(),select=d.querySelector('[data-visual-scene]'),scenes=Array.isArray(project.scenes)?project.scenes:[];select.innerHTML=scenes.length?scenes.map((s,i)=>`<option value="${i}">Scene ${i+1}｜${esc(String(s?.text||'').slice(0,36))}</option>`).join(''):'<option value="0">Sceneなし</option>';const refresh=()=>render(d,project,projects,Number(select.value)||0);select.onchange=refresh;refresh();typeof d.showModal==='function'?d.showModal():d.setAttribute('open','');}
function inject(){const r=route(),app=document.getElementById('app');if(!r||!app||app.querySelector('[data-scene-visual-entry]'))return;const anchor=app.querySelector('[data-dataset-broll-entry]')||app.querySelector('.steps');if(!anchor)return;const section=document.createElement('section');section.className='editor-card compact';section.setAttribute('data-scene-visual-entry','');section.innerHTML='<div><b>Scene映像タイプ提案</b><p>本文から「人物・手元・作品・地図・資料」など、探す映像の方向を提案します。</p></div><button type="button" data-scene-visual-open>映像タイプを見る</button>';anchor.insertAdjacentElement('afterend',section);section.querySelector('[data-scene-visual-open]').onclick=()=>open(r.projectId).catch(e=>{console.error(e);alert(`映像タイプ候補を表示できませんでした：${e instanceof Error?e.message:String(e)}`);});}
const observer=new MutationObserver(inject);observer.observe(document.getElementById('app')||document.body,{childList:true,subtree:true});window.addEventListener('hashchange',()=>queueMicrotask(inject));queueMicrotask(inject);
