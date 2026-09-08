import { getProject, saveProject } from './db.js';

const app = document.querySelector('#app');
let installedProjectId = '';
let applying = false;

function projectIdFromHash() {
  const match = location.hash.match(/^#\/project\/([^/]+)\/bgm/);
  return match ? decodeURIComponent(match[1]) : '';
}

function normalizeAlign(value) {
  return value === 'left' || value === 'right' ? value : 'center';
}

function applyPreviewAlignment(value) {
  const align = normalizeAlign(value);
  const rendered = app?.querySelector('#subtitlePreview .subtitle-render');
  if (rendered) rendered.style.textAlign = align;
}

async function install() {
  if (applying) return;
  const projectId = projectIdFromHash();
  const maxLines = app?.querySelector('#maxLines');
  if (!projectId || !maxLines) return;
  if (installedProjectId === projectId && app.querySelector('#subtitleTextAlign')) {
    const select = app.querySelector('#subtitleTextAlign');
    applyPreviewAlignment(select?.value);
    return;
  }

  applying = true;
  try {
    const project = await getProject(projectId);
    if (!project) return;
    const align = normalizeAlign(project.subtitleStyle?.align);
    let select = app.querySelector('#subtitleTextAlign');
    if (!select) {
      const label = document.createElement('label');
      label.innerHTML = '文字揃え<select id="subtitleTextAlign"><option value="left">左揃え</option><option value="center">中央揃え</option><option value="right">右揃え</option></select><small>字幕ブロックの位置は変えず、改行した各行の揃え方だけを変えます。</small>';
      maxLines.closest('label')?.insertAdjacentElement('afterend', label);
      select = label.querySelector('#subtitleTextAlign');
    }
    select.value = align;
    applyPreviewAlignment(align);
    select.onchange = async () => {
      const current = await getProject(projectId);
      if (!current) return;
      current.subtitleStyle = { ...(current.subtitleStyle || {}), align: normalizeAlign(select.value) };
      current.updatedAt = new Date().toISOString();
      await saveProject(current);
      applyPreviewAlignment(select.value);
    };
    installedProjectId = projectId;
  } finally {
    applying = false;
  }
}

const observer = new MutationObserver(() => {
  const select = app?.querySelector('#subtitleTextAlign');
  if (select) applyPreviewAlignment(select.value);
  void install();
});
if (app) observer.observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => { installedProjectId = ''; queueMicrotask(install); });
void install();
