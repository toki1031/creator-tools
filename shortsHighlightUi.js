import { readRoute } from './router.js';
import { getProject, saveProject } from './db.js';
import { extractShortsHighlights } from './shortsHighlight.js';
import { saveShortsDraft, listShortsDrafts } from './shortsDraft.js';
import { hasShortsHighlightDecision, recordShortsHighlightDecision } from './shortsHighlightDecision.js';

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
    <p class="notice">採用・見送りの判断は学習用DecisionRecordとして保存します。画像・動画は複製せず、元Sceneも変更しません。</p>
    <div class="dialog-actions"><button type="button" data-shorts-highlight-close>閉じる</button></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('[data-shorts-highlight-close]').onclick = () => dialog.close();
  return dialog;
}

function renderCandidates(dialog, project, candidates) {
  const host = dialog.querySelector('[data-shorts-highlight-results]');
  const drafts = listShortsDrafts(project);
  if (!candidates.length) {
    host.innerHTML = '<div class="empty"><h3>候補を作れませんでした</h3><p>15〜60秒に収まるSceneのまとまりが必要です。</p></div>';
    return;
  }
  host.innerHTML = `<div class="shorts-highlight-list">${candidates.map((candidate, index) => {
    const saved = drafts.some(draft => Number(draft.startIndex) === candidate.startIndex && Number(draft.endIndex) === candidate.endIndex);
    const adopted = hasShortsHighlightDecision(project, candidate, 'adopt');
    const rejected = hasShortsHighlightDecision(project, candidate, 'reject');
    return `
    <article class="editor-card shorts-highlight-card">
      <div class="section-head"><div><span class="eyebrow">候補 ${index + 1}</span><h3>Scene ${candidate.sceneNumbers[0]}〜${candidate.sceneNumbers[candidate.sceneNumbers.length - 1]}</h3></div><strong>${candidate.score}点</strong></div>
      <p><b>約${Math.round(candidate.durationSec)}秒</b>・${candidate.sceneNumbers.length}シーン</p>
      <p>${escapeHtml(candidate.previewText || '字幕・Scene本文なし')}</p>
      <ul>${candidate.reasons.map(reason => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>
      <div class="tool-row">
        <button type="button" ${saved ? 'disabled' : ''} data-save-shorts-draft="${index}">${saved ? '✓ Shorts案に保存済み' : 'Shorts案として保存'}</button>
        <button type="button" ${rejected ? 'disabled' : ''} data-reject-shorts-candidate="${index}">${rejected ? '✓ 見送りを記録済み' : '今回は見送る'}</button>
      </div>
      ${adopted ? '<p class="muted">✓ この候補の採用判断を学習データに記録済み</p>' : ''}
    </article>`;
  }).join('')}</div>`;

  host.querySelectorAll('[data-save-shorts-draft]').forEach(button => {
    button.onclick = async () => {
      const index = Number(button.dataset.saveShortsDraft);
      const candidate = candidates[index];
      if (!candidate) return;
      button.disabled = true;
      const oldText = button.textContent;
      button.textContent = '保存中…';
      try {
        const latest = await getProject(project.id);
        if (!latest) throw new Error('元プロジェクトを読み込めませんでした。');
        const result = saveShortsDraft(latest, candidate);
        recordShortsHighlightDecision(latest, candidate, { action:'adopt', rank:index + 1 });
        latest.updatedAt = new Date().toISOString();
        await saveProject(latest);
        button.textContent = '✓ Shorts案に保存済み';
      } catch (error) {
        console.error(error);
        button.disabled = false;
        button.textContent = oldText;
        alert(`Shorts案を保存できませんでした：${error instanceof Error ? error.message : String(error)}`);
      }
    };
  });

  host.querySelectorAll('[data-reject-shorts-candidate]').forEach(button => {
    button.onclick = async () => {
      const index = Number(button.dataset.rejectShortsCandidate);
      const candidate = candidates[index];
      if (!candidate) return;
      button.disabled = true;
      const oldText = button.textContent;
      button.textContent = '記録中…';
      try {
        const latest = await getProject(project.id);
        if (!latest) throw new Error('元プロジェクトを読み込めませんでした。');
        recordShortsHighlightDecision(latest, candidate, { action:'reject', rank:index + 1 });
        latest.updatedAt = new Date().toISOString();
        await saveProject(latest);
        button.textContent = '✓ 見送りを記録済み';
      } catch (error) {
        console.error(error);
        button.disabled = false;
        button.textContent = oldText;
        alert(`見送り判断を記録できませんでした：${error instanceof Error ? error.message : String(error)}`);
      }
    };
  });
}

async function openHighlights(projectId) {
  const project = await getProject(projectId);
  if (!project) return;
  const candidates = extractShortsHighlights(project);
  const dialog = ensureDialog();
  renderCandidates(dialog, project, candidates);
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
  wrap.innerHTML = `<div><b>Shorts再利用</b><p>長尺のSceneから短尺候補を抽出し、採用・見送り判断も学習データとして残します。</p></div><button type="button" data-shorts-highlight-open>Shorts候補を抽出</button>`;
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
