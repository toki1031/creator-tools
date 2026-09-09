import { getProject, saveProject } from './db.js';
import { syncProjectSceneDurationsToNarration } from './productionEfficiency.js';
import { inspectSmartFinish, firstSmartFinishAction } from './smartFinish.js';
import { createProductionPreset, applyProductionPreset } from './productionPreset.js';
import { readProductionPresets, upsertProductionPreset, removeProductionPreset } from './productionPresetStore.js';
import { createProjectSnapshot, restoreProjectSnapshot } from './projectSnapshot.js';
import { readProjectSnapshots, saveProjectSnapshot, removeProjectSnapshot } from './projectSnapshotStore.js';

const app = document.querySelector('#app');
let installing = false;

function projectIdFromHash() {
  const match = location.hash.match(/^#\/project\/([^/]+)(?:\/|$)/);
  return match ? decodeURIComponent(match[1]) : '';
}

function resultText(report) {
  if (!report.issues.length) return '問題は見つかりませんでした。';
  return report.issues.map(issue => `${issue.level === 'error' ? '要修正' : '確認'}：${issue.message}`).join('\n');
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function routeTo(projectId, route) {
  if (route === 'narration') {
    location.href = `voice-lab.html?projectId=${encodeURIComponent(projectId)}`;
    return;
  }
  location.hash = `#/project/${encodeURIComponent(projectId)}/${route || 'scenes'}`;
}

function snapshotOption(snapshot) {
  const label = escapeHtml(snapshot.label || '復元点');
  const date = snapshot.createdAt ? new Date(snapshot.createdAt).toLocaleString('ja-JP') : '';
  return `<option value="${escapeHtml(snapshot.createdAt || '')}">${label}${date ? `｜${escapeHtml(date)}` : ''}</option>`;
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
        <button type="button" data-preflight>スマート仕上げチェック</button>
        <button type="button" data-repair hidden>最初の修正箇所へ</button>
      </div>
      <div style="margin-top:12px">
        <label>制作プリセット<select data-preset-select></select></label>
        <div class="actions">
          <button type="button" data-save-preset>今の設定を保存</button>
          <button type="button" data-apply-preset>選択プリセットを適用</button>
          <button type="button" data-delete-preset>削除</button>
        </div>
      </div>
      <div style="margin-top:12px">
        <label>編集の復元点<select data-snapshot-select></select></label>
        <div class="actions">
          <button type="button" data-save-snapshot>復元点を保存</button>
          <button type="button" data-restore-snapshot>この復元点に戻す</button>
          <button type="button" data-delete-snapshot>復元点を削除</button>
        </div>
        <small>台本・Scene構成・字幕・見た目設定を最大5件保存します。画像・音声ファイル本体は複製しません。</small>
      </div>
      <pre data-assistant-result style="white-space:pre-wrap"></pre>`;
    main.appendChild(section);
    const output = section.querySelector('[data-assistant-result]');
    const select = section.querySelector('[data-preset-select]');
    const applyButton = section.querySelector('[data-apply-preset]');
    const deleteButton = section.querySelector('[data-delete-preset]');
    const repairButton = section.querySelector('[data-repair]');
    const snapshotSelect = section.querySelector('[data-snapshot-select]');
    const restoreSnapshotButton = section.querySelector('[data-restore-snapshot]');
    const deleteSnapshotButton = section.querySelector('[data-delete-snapshot]');
    let repairRoute = '';

    const refreshPresets = preferredName => {
      const presets = readProductionPresets();
      select.innerHTML = presets.length ? presets.map(preset => `<option value="${escapeHtml(preset.name)}">${escapeHtml(preset.name)}</option>`).join('') : '<option value="">保存済みプリセットなし</option>';
      if (preferredName && presets.some(preset => preset.name === preferredName)) select.value = preferredName;
      applyButton.disabled = !presets.length;
      deleteButton.disabled = !presets.length;
      return presets;
    };

    const refreshSnapshots = preferredCreatedAt => {
      const snapshots = readProjectSnapshots(projectId);
      snapshotSelect.innerHTML = snapshots.length ? snapshots.map(snapshotOption).join('') : '<option value="">保存済み復元点なし</option>';
      if (preferredCreatedAt && snapshots.some(item => item.createdAt === preferredCreatedAt)) snapshotSelect.value = preferredCreatedAt;
      restoreSnapshotButton.disabled = !snapshots.length;
      deleteSnapshotButton.disabled = !snapshots.length;
      return snapshots;
    };

    refreshPresets();
    refreshSnapshots();

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
      const report = inspectSmartFinish(current);
      const action = firstSmartFinishAction(current);
      repairRoute = action.code === 'ready' ? '' : action.route;
      repairButton.hidden = !repairRoute;
      repairButton.textContent = repairRoute ? `修正へ：${action.message}` : '最初の修正箇所へ';
      output.textContent = `要修正 ${report.errors}件 / 確認 ${report.warnings}件\n${resultText(report)}`;
    };

    repairButton.onclick = () => {
      if (repairRoute) routeTo(projectId, repairRoute);
    };

    section.querySelector('[data-save-preset]').onclick = async () => {
      const current = await getProject(projectId);
      if (!current) return;
      const name = `${current.genre || 'Creator OS'} ${current.platform || ''}`.trim();
      upsertProductionPreset(createProductionPreset(current, name));
      refreshPresets(name);
      output.textContent = `「${name}」を保存しました。BGM音源本体やproject固有素材IDは保存していません。`;
    };

    applyButton.onclick = async () => {
      const preset = readProductionPresets().find(item => item?.name === select.value);
      const current = await getProject(projectId);
      if (!preset || !current) return;
      const next = applyProductionPreset(current, preset);
      next.updatedAt = new Date().toISOString();
      await saveProject(next);
      output.textContent = `「${preset.name || '制作プリセット'}」を適用しました。`;
    };

    deleteButton.onclick = () => {
      const name = select.value;
      if (!name) return;
      removeProductionPreset(name);
      refreshPresets();
      output.textContent = `「${name}」をプリセット一覧から削除しました。プロジェクト本体は変更していません。`;
    };

    section.querySelector('[data-save-snapshot]').onclick = async () => {
      const current = await getProject(projectId);
      if (!current) return;
      const label = `復元点 ${new Date().toLocaleString('ja-JP')}`;
      const snapshot = createProjectSnapshot(current, { label });
      saveProjectSnapshot(snapshot);
      refreshSnapshots(snapshot.createdAt);
      output.textContent = '復元点を保存しました。画像・音声ファイル本体は複製していません。';
    };

    restoreSnapshotButton.onclick = async () => {
      const snapshot = readProjectSnapshots(projectId).find(item => item.createdAt === snapshotSelect.value);
      if (!snapshot) return;
      if (!confirm('この復元点の編集状態へ戻します。現在の画像・音声ファイル本体は削除しません。続けますか？')) return;
      const current = await getProject(projectId);
      if (!current) return;
      const next = restoreProjectSnapshot(current, snapshot);
      await saveProject(next);
      output.textContent = `「${snapshot.label || '復元点'}」の編集状態へ戻しました。画像・音声ファイル本体は保持しています。`;
    };

    deleteSnapshotButton.onclick = () => {
      const createdAt = snapshotSelect.value;
      if (!createdAt) return;
      removeProjectSnapshot(projectId, createdAt);
      refreshSnapshots();
      output.textContent = '復元点を一覧から削除しました。プロジェクト本体は変更していません。';
    };
  } finally {
    installing = false;
  }
}

const observer = new MutationObserver(() => void install());
if (app) observer.observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(install));
void install();
