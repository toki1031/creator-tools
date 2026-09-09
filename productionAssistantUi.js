import { getProject, saveProject } from './db.js';
import { syncProjectSceneDurationsToNarration } from './productionEfficiency.js';
import { inspectProductionProject } from './productionPreflight.js';
import { createProductionPreset, applyProductionPreset } from './productionPreset.js';

const app = document.querySelector('#app');
const PRESET_KEY = 'creator-os-production-preset-v1';
let installing = false;

function projectIdFromHash() {
  const match = location.hash.match(/^#\/project\/([^/]+)(?:\/|$)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function loadPreset() {
  try { return JSON.parse(localStorage.getItem(PRESET_KEY) || 'null'); }
  catch { return null; }
}

function savePreset(preset) {
  localStorage.setItem(PRESET_KEY, JSON.stringify(preset));
}

function resultText(report) {
  if (!report.issues.length) return '問題は見つかりませんでした。';
  return report.issues.map(issue => `${issue.level === 'error' ? '要修正' : '確認'}：${issue.message}`).join('\n');
}

async function install() {
  if (installing || !app) return;
  const projectId = projectIdFromHash();
  if (!projectId || app.querySelector('#productionAssistantPanel')) return;
  const main = app.querySelector('main');
  if (!main) return;
  installing = true;
  try {
    const project = await getProject(projectId);
    if (!project || projectIdFromHash() !== projectId) return;
    const section = document.createElement('section');
    section.id = 'productionAssistantPanel';
    section.className = 'card';
    section.innerHTML = `<h2>制作アシスト</h2>
      <p class="notice">実制作の手戻りを減らす補助機能です。既存データを自動変更せず、実行した項目だけ保存します。</p>
      <div class="actions">
        <button type="button" data-sync-duration>音声尺にScene尺を合わせる</button>
        <button type="button" data-preflight>完成前チェック</button>
        <button type="button" data-save-preset>今の設定をプリセット保存</button>
        <button type="button" data-apply-preset>保存プリセットを適用</button>
      </div>
      <pre data-assistant-result style="white-space:pre-wrap"></pre>`;
    main.appendChild(section);
    const output = section.querySelector('[data-assistant-result]');

    section.querySelector('[data-sync-duration]').onclick = async () => {
      const current = await getProject(projectId);
      if (!current) return;
      const result = syncProjectSceneDurationsToNarration(current);
      if (!result.changed) { output.textContent = '変更なし：実尺を取得済みのナレーションがないか、Scene尺はすでに一致しています。'; return; }
      result.project.updatedAt = new Date().toISOString();
      await saveProject(result.project);
      output.textContent = `${result.changed} Sceneの長さを生成済みナレーションの実尺に合わせました。`;
    };

    section.querySelector('[data-preflight]').onclick = async () => {
      const current = await getProject(projectId);
      if (!current) return;
      const report = inspectProductionProject(current);
      output.textContent = `要修正 ${report.errors}件 / 確認 ${report.warnings}件\n${resultText(report)}`;
    };

    section.querySelector('[data-save-preset]').onclick = async () => {
      const current = await getProject(projectId);
      if (!current) return;
      const name = `${current.genre || 'Creator OS'} ${current.platform || ''}`.trim();
      savePreset(createProductionPreset(current, name));
      output.textContent = `「${name}」の字幕・BGM設定などを端末に保存しました。BGM音源本体は複製していません。`;
    };

    const applyButton = section.querySelector('[data-apply-preset]');
    applyButton.disabled = !loadPreset();
    applyButton.onclick = async () => {
      const preset = loadPreset();
      const current = await getProject(projectId);
      if (!preset || !current) return;
      const next = applyProductionPreset(current, preset);
      next.updatedAt = new Date().toISOString();
      await saveProject(next);
      output.textContent = `「${preset.name || '制作プリセット'}」を適用しました。画面を開き直すと設定表示にも反映されます。`;
    };
  } finally {
    installing = false;
  }
}

const observer = new MutationObserver(() => void install());
if (app) observer.observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(install));
void install();
