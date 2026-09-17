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

function waitForInitialRender(callback) {
  const app = document.getElementById('app');
  if (!app || !app.querySelector('.boot')) {
    callback();
    return;
  }
  const observer = new MutationObserver(() => {
    if (app.querySelector('.boot')) return;
    observer.disconnect();
    callback();
  });
  observer.observe(app, { childList: true, subtree: true });
}

function scheduleIdle(callback) {
  if (typeof globalThis.requestIdleCallback === 'function') {
    globalThis.requestIdleCallback(callback, { timeout: 750 });
    return;
  }
  setTimeout(callback, 80);
}

const optionalModules = [
  './dedicatedRenderHandoff.js',
  './subtitlePreviewNavigation.js',
  './subtitleAlignUi.js',
  './subtitleCardEditorUi.js',
  './editorUndo.js',
  './datasetExportUi.js',
  './datasetBrollSuggestionsUi.js',
  './sceneVisualTypeSuggestionsUi.js',
  './optionalAiModuleLoader.js',
  './autoProductionUi.js',
  './bgmLibraryUi.js',
  './bgmRightsSummaryUi.js',
  './bgmBeatSyncUi.js',
  './smartReframeUi.js',
  './smartReframeRendererBridge.js',
  './shortsHighlightUi.js',
  './shortsWorkspaceUi.js',
  './shortsOutputUi.js',
  './publishRightsUi.js'
];

function loadOptionalModulesDeferred() {
  let index = 0;
  const loadNext = () => {
    const modulePath = optionalModules[index++];
    if (!modulePath) return;
    import(modulePath)
      .catch(error => console.warn(`Optional module failed to load: ${modulePath}`, error))
      .finally(() => scheduleIdle(loadNext));
  };
  scheduleIdle(loadNext);
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
    // main.js の import 完了は「初回画面の描画完了」ではない。
    // iPhone Safariの冷起動では、IndexedDB読み込みと多数の追加module読み込みを
    // 同時に走らせると初回描画と競合しやすいため、boot画面が消えるまで待つ。
    waitForInitialRender(() => {
      clearTimeout(bootWatchdog);
      if (document.querySelector('#app .error, #app .boot-error')) return;
      // 起動直後に大容量projectを再読込する補助UIは自動起動しない。
      // productionAssistantUi / productionPipelineUi / productionTimingTracker はファイルを残し、
      // 将来必要になった場合のみ明示操作で読み込む。
      // その他の追加UIも初回画面を優先し、idle時に1つずつ読み込む。
      loadOptionalModulesDeferred();
    });
  })
  .catch(error => {
    clearTimeout(bootWatchdog);
    showBootError(error);
  });
