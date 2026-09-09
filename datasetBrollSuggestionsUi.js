import { getProject, listProjects, saveProject } from './db.js';
import { suggestBrollFromDataset } from './datasetBrollSuggestions.js';
import { getDatasetBrollFeedbackState, recordDatasetBrollFeedback } from './datasetBrollFeedback.js';

const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c] || c));

function parseScenesRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, projectId] = hash.split('/');
  if (page !== 'scenes' || !projectId) return null;
  return { projectId: decodeURIComponent(projectId) };
}

function ensureDialog() {
  let dialog = document.getElementById('datasetBrollDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'datasetBrollDialog';
  dialog.className = 'shorts-highlight-dialog';
  dialog.innerHTML = `
    <div class="section-head"><div><h2>Dataset B-roll候補</h2><p>過去に実際に採用した画像判断を根拠に、似たSceneの傾向を表示します。</p></div></div>
    <label>対象Scene<select data-dataset-broll-scene></select></label>
    <div data-dataset-broll-results></div>
    <p class="notice">候補への「参考にする／今回は見送る」も学習します。ただし画像は自動適用せず、実際の素材選択はこれまで通り人が行います。</p>
    <div class="dialog-actions"><button type="button" data-dataset-broll-close>閉じる</button></div>`;
  document.body.appendChild(dialog);
  dialog.querySelector('[data-dataset-broll-close]').onclick = () => dialog.close();
  return dialog;
}

function replaceProjectSnapshot(projects, project) {
  const index = projects.findIndex(item => String(item?.id || '') === String(project?.id || ''));
  if (index >= 0) projects[index] = project;
  else projects.push(project);
}

function renderResults(dialog, project, projects, sceneIndex) {
  const host = dialog.querySelector('[data-dataset-broll-results]');
  const scene = project.scenes?.[sceneIndex];
  if (!scene) {
    host.innerHTML = '<div class="empty"><p>Sceneが見つかりません。</p></div>';
    return;
  }
  const suggestions = suggestBrollFromDataset(project, scene, projects, { limit: 5 });
  if (!suggestions.length) {
    host.innerHTML = '<div class="empty"><h3>まだ十分な学習例がありません</h3><p>画像素材の採用判断が増えると、ここに似たSceneの実例が出るようになります。</p></div>';
    return;
  }
  host.innerHTML = `<div class="shorts-highlight-list">${suggestions.map((item, index) => {
    const state = getDatasetBrollFeedbackState(project, scene.id, item);
    const feedbackText = item.feedbackAccepted || item.feedbackRejected
      ? `<p class="muted">提案評価：参考 ${item.feedbackAccepted}件／見送り ${item.feedbackRejected}件</p>` : '';
    return `
    <article class="editor-card shorts-highlight-card">
      <div class="section-head"><div><span class="eyebrow">候補 ${index + 1}</span><h3>${escapeHtml(item.assetLabel || 'B-roll候補')}</h3></div><strong>${item.score}点</strong></div>
      <p>${escapeHtml(item.reason)}</p>
      <p><b>過去のScene：</b>${escapeHtml(item.evidenceSceneText.slice(0, 180))}</p>
      <p class="muted">根拠：${escapeHtml(item.evidenceProjectTitle || '過去プロジェクト')}${item.assetSource ? `・出典 ${escapeHtml(item.assetSource)}` : ''}</p>
      ${feedbackText}
      ${item.reusableInCurrentProject ? '<p class="notice">同じ素材IDが現在のプロジェクトにもあります。自動適用せず、画像素材ライブラリから人が選択します。</p>' : ''}
      <div class="tool-row">
        <button type="button" data-broll-feedback="accept" data-broll-index="${index}" ${state === 'accepted' ? 'disabled' : ''}>${state === 'accepted' ? '✓ 参考にするを記録済み' : '参考にする'}</button>
        <button type="button" data-broll-feedback="reject" data-broll-index="${index}" ${state === 'rejected' ? 'disabled' : ''}>${state === 'rejected' ? '✓ 見送りを記録済み' : '今回は見送る'}</button>
      </div>
    </article>`;
  }).join('')}</div>`;

  host.querySelectorAll('[data-broll-feedback]').forEach(button => {
    button.onclick = async () => {
      const item = suggestions[Number(button.dataset.brollIndex)];
      const action = button.dataset.brollFeedback;
      if (!item || (action !== 'accept' && action !== 'reject')) return;
      const previousText = button.textContent;
      button.disabled = true;
      button.textContent = '記録中…';
      try {
        const record = recordDatasetBrollFeedback(project, {
          sceneId: scene.id,
          sceneIndex,
          sceneText: scene.text,
          suggestion: item,
          action
        });
        if (record) {
          project.updatedAt = new Date().toISOString();
          await saveProject(project);
          replaceProjectSnapshot(projects, project);
        }
        renderResults(dialog, project, projects, sceneIndex);
      } catch (error) {
        console.error(error);
        button.disabled = false;
        button.textContent = previousText;
        alert(`提案評価を保存できませんでした：${error instanceof Error ? error.message : String(error)}`);
      }
    };
  });
}

async function openDialog(projectId) {
  const [project, projects] = await Promise.all([getProject(projectId), listProjects()]);
  if (!project) throw new Error('プロジェクトを読み込めませんでした。');
  replaceProjectSnapshot(projects, project);
  const dialog = ensureDialog();
  const select = dialog.querySelector('[data-dataset-broll-scene]');
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  select.innerHTML = scenes.length
    ? scenes.map((scene, index) => `<option value="${index}">Scene ${index + 1}｜${escapeHtml(String(scene?.text || '').slice(0, 36))}</option>`).join('')
    : '<option value="0">Sceneなし</option>';
  const refresh = () => renderResults(dialog, project, projects, Number(select.value) || 0);
  select.onchange = refresh;
  refresh();
  if (typeof dialog.showModal === 'function') dialog.showModal();
  else dialog.setAttribute('open', '');
}

function inject() {
  const route = parseScenesRoute();
  if (!route) return;
  const app = document.getElementById('app');
  if (!app || app.querySelector('[data-dataset-broll-entry]')) return;
  const target = app.querySelector('.steps');
  if (!target) return;
  const section = document.createElement('section');
  section.className = 'editor-card compact';
  section.setAttribute('data-dataset-broll-entry', '');
  section.innerHTML = `<div><b>Dataset B-roll提案</b><p>過去の画像選択と提案評価から、似たSceneのB-roll傾向を確認します。</p></div><button type="button" data-dataset-broll-open>候補を見る</button>`;
  target.insertAdjacentElement('afterend', section);
  section.querySelector('[data-dataset-broll-open]').onclick = () => openDialog(route.projectId).catch(error => {
    console.error(error);
    alert(`Dataset候補を表示できませんでした：${error instanceof Error ? error.message : String(error)}`);
  });
}

const observer = new MutationObserver(() => inject());
observer.observe(document.getElementById('app') || document.body, { childList:true, subtree:true });
window.addEventListener('hashchange', () => queueMicrotask(inject));
queueMicrotask(inject);
