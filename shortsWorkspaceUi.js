import { getProject, saveProject } from './db.js';
import { listShortsDrafts } from './shortsDraft.js';
import { resolveShortsWorkspace, updateShortsDraftSceneOrder, updateShortsDraftSettings } from './shortsWorkspace.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c] || c));

function parseWorkspaceRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, projectId, subpage, draftId] = hash.split('/');
  if (page !== 'project' || subpage !== 'shorts' || !projectId || !draftId) return null;
  return { projectId:decodeURIComponent(projectId), draftId:decodeURIComponent(draftId) };
}

function workspaceHash(projectId, draftId) {
  return `#/project/${encodeURIComponent(projectId)}/shorts/${encodeURIComponent(draftId)}`;
}

function injectDraftList() {
  if (parseWorkspaceRoute()) return;
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, projectId] = hash.split('/');
  if (page !== 'project' || !projectId) return;
  const app = document.getElementById('app');
  if (!app || app.querySelector('[data-shorts-workspace-list]')) return;
  void getProject(decodeURIComponent(projectId)).then(project => {
    if (!project || parseWorkspaceRoute()) return;
    const drafts = listShortsDrafts(project);
    if (!drafts.length) return;
    const target = app.querySelector('[data-shorts-highlight-entry]') || app.querySelector('.steps');
    if (!target) return;
    const section = document.createElement('section');
    section.className = 'editor-card';
    section.setAttribute('data-shorts-workspace-list', '');
    section.innerHTML = `<div class="section-head"><div><h2>保存済みShorts案</h2><p>元素材を複製せず、このプロジェクトのSceneを参照して編集します。</p></div><span>${drafts.length}件</span></div><div class="shorts-highlight-list">${drafts.map(draft => `<article class="editor-card compact"><div><b>${escapeHtml(draft.title || 'Shorts案')}</b><p>約${Math.round(Number(draft.durationSec) || 0)}秒・${Array.isArray(draft.sceneIds) ? draft.sceneIds.length : 0}シーン</p></div><button type="button" data-open-shorts-draft="${escapeHtml(draft.id)}">編集</button></article>`).join('')}</div>`;
    target.insertAdjacentElement('afterend', section);
    section.querySelectorAll('[data-open-shorts-draft]').forEach(button => {
      button.onclick = () => { location.hash = workspaceHash(project.id, button.dataset.openShortsDraft); };
    });
  }).catch(error => console.warn('Shorts draft list failed', error));
}

async function renderWorkspace() {
  const route = parseWorkspaceRoute();
  if (!route) return false;
  const project = await getProject(route.projectId);
  if (!project) return false;
  const workspace = resolveShortsWorkspace(project, route.draftId);
  if (!workspace) return false;
  const app = document.getElementById('app');
  if (!app) return false;

  const render = () => {
    const current = resolveShortsWorkspace(project, route.draftId);
    if (!current) return;
    const draft = current.draft;
    app.innerHTML = `<main class="shell editor-shell" data-shorts-workspace>
      <header class="editor-head"><button type="button" data-shorts-back>←</button><div><span>SHORTS WORKSPACE</span><h1>${escapeHtml(draft.title || 'Shorts案')}</h1></div><span>9:16</span></header>
      <section class="editor-card"><div class="section-head"><div><h2>Shorts構成</h2><p>元プロジェクト「${escapeHtml(current.sourceProjectTitle)}」のSceneを参照しています。画像・動画は複製しません。</p></div><span>${current.scenes.length}シーン</span></div>
        <label>案の名前<input data-shorts-title value="${escapeHtml(draft.title || '')}"></label>
        <label>目標尺<input data-shorts-target type="number" min="15" max="60" value="${Math.round(Number(draft.targetDurationSec || draft.durationSec || 45))}"><span>秒</span></label>
        <p class="notice">並び替えはShorts案の参照順だけを変更します。元プロジェクトのScene順・素材・字幕は変更しません。</p>
      </section>
      <section class="scene-list">${current.scenes.map((item, index) => `<article class="editor-card" data-shorts-scene="${escapeHtml(item.sceneId)}"><div class="section-head"><div><span class="eyebrow">Shorts ${index + 1}</span><h3>元Scene ${item.sourceNumber}</h3></div><div><button type="button" data-move-up="${index}" ${index === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move-down="${index}" ${index === current.scenes.length - 1 ? 'disabled' : ''}>↓</button></div></div><p>${escapeHtml(String(item.scene?.subtitleText || item.scene?.text || '').slice(0, 180) || '本文なし')}</p><p class="muted">約${Math.round(Number(item.scene?.durationSec) || 0)}秒${item.scene?.smartReframe ? '・Smart Reframe設定あり' : ''}</p></article>`).join('')}</section>
      ${current.missingSceneIds.length ? `<section class="editor-card"><p class="notice">元プロジェクトで見つからないSceneが${current.missingSceneIds.length}件あります。元Sceneが削除された可能性があります。</p></section>` : ''}
      <section class="actions"><button type="button" data-shorts-back>← 元プロジェクトへ</button><button class="primary" type="button" data-shorts-save>Shorts案を保存</button></section>
    </main>`;

    app.querySelectorAll('[data-shorts-back]').forEach(button => button.onclick = () => { location.hash = `#/project/${encodeURIComponent(project.id)}`; });
    app.querySelectorAll('[data-move-up]').forEach(button => button.onclick = async () => {
      const index = Number(button.dataset.moveUp);
      const ids = current.scenes.map(item => item.sceneId);
      [ids[index - 1], ids[index]] = [ids[index], ids[index - 1]];
      updateShortsDraftSceneOrder(project, draft.id, ids);
      await saveProject(project);
      render();
    });
    app.querySelectorAll('[data-move-down]').forEach(button => button.onclick = async () => {
      const index = Number(button.dataset.moveDown);
      const ids = current.scenes.map(item => item.sceneId);
      [ids[index + 1], ids[index]] = [ids[index], ids[index + 1]];
      updateShortsDraftSceneOrder(project, draft.id, ids);
      await saveProject(project);
      render();
    });
    app.querySelector('[data-shorts-save]').onclick = async () => {
      const title = app.querySelector('[data-shorts-title]').value;
      const targetDurationSec = Number(app.querySelector('[data-shorts-target]').value);
      updateShortsDraftSettings(project, draft.id, { title, targetDurationSec });
      project.updatedAt = new Date().toISOString();
      await saveProject(project);
      render();
    };
  };

  render();
  return true;
}

let rendering = false;
function sync() {
  if (rendering) return;
  rendering = true;
  void renderWorkspace().then(rendered => { if (!rendered) injectDraftList(); }).catch(error => console.warn('Shorts workspace failed', error)).finally(() => { rendering = false; });
}

const observer = new MutationObserver(() => sync());
observer.observe(document.getElementById('app') || document.body, { childList:true, subtree:true });
window.addEventListener('hashchange', () => setTimeout(sync, 0));
setTimeout(sync, 0);
