import { readRoute } from './router.js';
import { getProject } from './db.js';
import { extractShortsHighlights } from './shortsHighlight.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c] || c));

function ensureDialog() {
  let dialog = document.getElementById('shortsHighlightDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'shortsHighlightDialog';
  dialog.className = 'shorts-highlight-dialog';
  dialog.innerHTML = `
    <div class="section-head"><div><h2>Shorts候補</h2><p>既存のScene・字幕・尺からローカル判定した候補です。</p></div></div>
    <div data-shorts-highlight-results></div>
    <p class="notice">この段階では元プロジェクトを変更しません。候補の採用・派生プロジェクト作成は次の段階で明示操作として追加します。</p>
    <div class="dialog-actions"><button type="button" data-shorts-highlight-close>閉じる</button></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('[data-shorts-highlight-close]').onclick = () => dialog.close();
  return dialog;
}

function renderCandidates(dialog, candidates) {
  const host = dialog.querySelector('[data-shorts-highlight-results]');
  if (!candidates.length) {
    host.innerHTML = '<div class="empty"><h3>候補を作れませんでした</h3><p>15〜60秒に収まるSceneのまとまりが必要です。</p></div>';
    return;
  }
  host.innerHTML = `<div class="shorts-highlight-list">${candidates.map((candidate, index) => `
    <article class="editor-card shorts-highlight-card">
      <div class="section-head"><div><span class="eyebrow">候補 ${index + 1}</span><h3>Scene ${candidate.sceneNumbers[0]}〜${candidate.sceneNumbers[candidate.sceneNumbers.length - 1]}</h3></div><strong>${candidate.score}点</strong></div>
      <p><b>約${Math.round(candidate.durationSec)}秒</b>・${candidate.sceneNumbers.length}シーン</p>
      <p>${escapeHtml(candidate.previewText || '字幕・Scene本文なし')}</p>
      <ul>${candidate.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
    </article>`).join('')}</div>`;
}

async function openHighlights(projectId) {
  const project = await getProject(projectId);
  if (!project) return;
  const candidates = extractShortsHighlights(project);
  const dialog = ensureDialog();
  renderCandidates(dialog, candidates);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function injectButton() {
  const route = readRoute();
  if (route.page !== 'project' || !route.id) return;
  const root = document.getElementById('app');
  if (!root || root.querySelector('[data-shorts-highlight-open]')) return;
  const target = root.querySelector('.steps') || root.querySelector('.editor-head');
  if (!target) return;
  const wrap = document.createElement('section');
  wrap.className = 'editor-card compact';
  wrap.setAttribute('data-shorts-highlight-entry', '');
  wrap.innerHTML = `<div><b>Shorts再利用</b><p>長尺のSceneから短尺候補を抽出します。</p></div><button type="button" data-shorts-highlight-open>Shorts候補を抽出</button>`;
  target.insertAdjacentElement('afterend', wrap);
  wrap.querySelector('[data-shorts-highlight-open]').onclick = () => openHighlights(route.id).catch(error => {
    console.error(error);
    alert(`Shorts候補を作れませんでした：${error instanceof Error ? error.message : String(error)}`);
  });
}

const observer = new MutationObserver(() => injectButton());
observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(injectButton));
queueMicrotask(injectButton);
