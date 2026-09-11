function isIOSDevice(userAgent = globalThis.navigator?.userAgent || '') {
  return /iPhone|iPad|iPod/i.test(String(userAgent));
}

function outputProjectId(hash = globalThis.location?.hash || '') {
  const match = String(hash).match(/^#\/project\/([^/]+)\/output(?:$|[/?])/);
  if (!match) return '';
  try { return decodeURIComponent(match[1]); } catch { return match[1]; }
}

function supportsIsolatedRender() {
  return Boolean(isIOSDevice() && globalThis.navigator?.storage?.getDirectory);
}

if (supportsIsolatedRender()) {
  document.addEventListener('click', event => {
    const button = event.target?.closest?.('#generateVideo');
    if (!button) return;
    const projectId = outputProjectId();
    if (!projectId) return;

    // Stop main.js from starting the heavy renderer in the editor page.
    // The isolated page first prepares a compact Render Job, reloads once to
    // release the full project, and only then starts Canvas/MediaRecorder.
    event.preventDefault();
    event.stopImmediatePropagation();
    try {
      sessionStorage.setItem('creator-os-render-return', location.hash || '#/');
      sessionStorage.setItem('creator-os-render-project-title', document.querySelector('h1')?.textContent || 'Creator OS');
    } catch {}
    button.disabled = true;
    const status = document.querySelector('#renderStatus');
    if (status) status.textContent = 'iPhone用の専用動画生成画面へ移動します…';
    location.href = `./render-runner.html?project=${encodeURIComponent(projectId)}&stage=prepare`;
  }, true);
}

export { isIOSDevice, outputProjectId, supportsIsolatedRender };
