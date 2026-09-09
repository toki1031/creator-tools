function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function bootNote() {
  return document.querySelector('#app .boot p');
}

function setBootStage(message) {
  const note = bootNote();
  if (note) note.textContent = message;
}

function showBootError(error) {
  const app = document.getElementById('app');
  if (!app) return;
  const detail = escapeHtml(error?.stack || error?.message || error || 'Unknown error');
  app.innerHTML = `<main class="boot"><section class="boot-error"><h1>Creator OSを起動できませんでした</h1><p>起動処理で問題が発生しました。</p><pre>${detail}</pre><button type="button" data-boot-reload>再読み込み</button></section></main>`;
  app.querySelector('[data-boot-reload]')?.addEventListener('click', () => location.reload());
}

window.addEventListener('error', event => {
  showBootError(event.error || event.message || 'Script error');
});
window.addEventListener('unhandledrejection', event => {
  showBootError(event.reason || 'Unhandled promise rejection');
});

setBootStage('Creator OS本体を読み込んでいます…');
const bootWatchdog = setTimeout(() => {
  if (document.querySelector('#app .boot')) {
    showBootError(new Error('起動処理が12秒以内に完了しませんでした。画面に「端末データベース」または「保存済みプロジェクト」と表示されていた場合は端末保存処理、表示が「Creator OS本体」のままだった場合は本体モジュール読み込みで停止しています。'));
  }
}, 12000);

import('./main.js')
  .then(() => {
    clearTimeout(bootWatchdog);
    const optionalModules = [
      './subtitlePreviewNavigation.js',
      './subtitleAlignUi.js',
      './subtitleCardEditorUi.js',
      './editorUndo.js',
      './datasetExportUi.js',
      './optionalAiModuleLoader.js',
      './bgmLibraryUi.js',
      './bgmRightsSummaryUi.js',
      './bgmBeatSyncUi.js',
      './smartReframeUi.js',
      './smartReframeRendererBridge.js',
      './shortsHighlightUi.js',
      './shortsWorkspaceUi.js',
      './shortsOutputUi.js',
      './publishRightsUi.js',
      './productionAssistantUi.js',
      './productionPipelineUi.js',
      './productionTimingTracker.js'
    ];
    for (const modulePath of optionalModules) {
      import(modulePath).catch(error => console.warn(`Optional module failed to load: ${modulePath}`, error));
    }
  })
  .catch(error => {
    clearTimeout(bootWatchdog);
    showBootError(error);
  });
