function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
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

try {
  await import('./main.js');
  const optionalModules = [
    './subtitlePreviewNavigation.js',
    './editorUndo.js',
    './datasetExportUi.js',
    './optionalAiModuleLoader.js'
  ];
  for (const modulePath of optionalModules) {
    import(modulePath).catch(error => console.warn(`Optional module failed to load: ${modulePath}`, error));
  }
} catch (error) {
  showBootError(error);
}
