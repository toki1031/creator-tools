import { getProject } from './db.js';
import { downloadJson } from './download.js';
import { readRoute } from './router.js';
import { createDatasetExportPayload } from './datasetExport.js';

function safeName(value = 'project') {
  return String(value).trim().replace(/[\\/:*?"<>|]+/g, '_').replace(/\s+/g, ' ').slice(0, 80) || 'project';
}

function bindDatasetExportButton() {
  const route = readRoute();
  if (route.page !== 'project' || !route.id) return;
  const backupButton = document.querySelector('#exportJson');
  if (!backupButton || document.querySelector('#exportDataset')) return;
  const button = document.createElement('button');
  button.id = 'exportDataset';
  button.type = 'button';
  button.textContent = '学習Datasetを書き出す';
  backupButton.insertAdjacentElement('afterend', button);
  button.onclick = async () => {
    button.disabled = true;
    try {
      const project = await getProject(route.id);
      if (!project) throw new Error('プロジェクトが見つかりません。');
      const payload = createDatasetExportPayload(project);
      downloadJson(`${safeName(project.title)}-dataset-v0.30.json`, payload);
    } catch (error) {
      console.error(error);
      alert(`Datasetを書き出せませんでした：${error?.message || error}`);
    } finally {
      button.disabled = false;
    }
  };
}

const observer = new MutationObserver(bindDatasetExportButton);
observer.observe(document.querySelector('#app'), { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(bindDatasetExportButton));
bindDatasetExportButton();
