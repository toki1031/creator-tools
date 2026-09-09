import { getProject } from './db.js';
import { createShortsRenderProject, summarizeShortsRenderProject } from './shortsRenderProject.js';
import { getVideoCapabilities, prepareVideoProject, runVisualPreview, exportProjectVideo, validateVideoProject } from './videoRenderer.js';

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [page, projectId, subpage, draftId] = hash.split('/');
  if (page !== 'project' || subpage !== 'shorts' || !projectId || !draftId) return null;
  return { projectId:decodeURIComponent(projectId), draftId:decodeURIComponent(draftId) };
}

function safeName(value) {
  return String(value || 'creator-os-shorts').replace(/[\\/:*?"<>|]/g, '_').trim() || 'creator-os-shorts';
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

async function buildRuntime(route, status = () => {}) {
  const project = await getProject(route.projectId);
  if (!project) throw new Error('元プロジェクトが見つかりません。');
  const runtime = createShortsRenderProject(project, route.draftId);
  const validation = validateVideoProject(runtime);
  if (validation.errors.length) throw new Error(validation.errors.join('／'));
  status('Shorts用素材を準備しています…');
  const prepared = await prepareVideoProject(runtime, { onStatus:status });
  return { runtime, prepared, validation, summary:summarizeShortsRenderProject(runtime) };
}

function inject() {
  const route = parseRoute();
  if (!route) return;
  const app = document.getElementById('app');
  const workspace = app?.querySelector('[data-shorts-workspace]');
  if (!workspace || workspace.querySelector('[data-shorts-output-panel]')) return;

  const actions = workspace.querySelector('.actions');
  if (!actions) return;
  const section = document.createElement('section');
  section.className = 'editor-card';
  section.setAttribute('data-shorts-output-panel', '');
  section.innerHTML = `
    <div class="section-head"><div><h2>プレビュー・出力</h2><p>元Sceneと素材をその場で参照して9:16動画を作ります。元素材は複製しません。</p></div><span data-shorts-output-status>待機中</span></div>
    <canvas data-shorts-preview-canvas width="360" height="640" style="width:min(100%,360px);aspect-ratio:9/16;background:#080b12;border-radius:16px;display:block;margin:0 auto;"></canvas>
    <p class="notice" data-shorts-output-note>長尺全体に1本だけ付いたナレーションは切り出し位置がずれるため使用しません。Scene別ナレーションは引き継ぎます。</p>
    <div class="tool-row"><button type="button" data-shorts-preview>▶ 10秒プレビュー</button><button type="button" class="primary" data-shorts-export>Shorts動画を生成</button></div>
    <p class="muted" data-shorts-output-detail></p>`;
  actions.insertAdjacentElement('beforebegin', section);

  const canvas = section.querySelector('[data-shorts-preview-canvas]');
  const status = section.querySelector('[data-shorts-output-status]');
  const detail = section.querySelector('[data-shorts-output-detail]');
  let controller = null;
  let running = false;

  const setStatus = text => { status.textContent = text; };
  const setBusy = value => {
    running = value;
    section.querySelector('[data-shorts-preview]').disabled = value;
    section.querySelector('[data-shorts-export]').disabled = value;
  };

  section.querySelector('[data-shorts-preview]').onclick = async () => {
    if (running) return;
    setBusy(true);
    controller = new AbortController();
    try {
      const { runtime, prepared, summary, validation } = await buildRuntime(route, setStatus);
      canvas.width = 360;
      canvas.height = 640;
      detail.textContent = `${summary.sceneCount}シーン・約${Math.round(summary.durationSec)}秒${validation.warnings.length ? `／${validation.warnings.join('／')}` : ''}`;
      await runVisualPreview(runtime, prepared, canvas, {
        durationLimit:10,
        signal:controller.signal,
        onProgress:(current,total) => setStatus(`プレビュー ${current.toFixed(1)} / ${total.toFixed(1)}秒`)
      });
      setStatus('プレビュー完了');
    } catch (error) {
      if (String(error?.name) !== 'AbortError') {
        console.error(error);
        setStatus('プレビュー失敗');
        alert(`Shortsプレビューに失敗しました：${error instanceof Error ? error.message : String(error)}`);
      }
    } finally { setBusy(false); }
  };

  section.querySelector('[data-shorts-export]').onclick = async () => {
    if (running) return;
    if (!getVideoCapabilities().supported) return alert('このブラウザでは動画生成に必要な録画機能を利用できません。');
    if (!confirm('Shorts動画を生成しますか？生成中は画面を前面に表示し、画面をロックしないでください。')) return;
    setBusy(true);
    controller = new AbortController();
    try {
      const { runtime, prepared, summary, validation } = await buildRuntime(route, setStatus);
      if (summary.suppressedWholeNarration) detail.textContent = '全体ナレーションは位置ずれ防止のため除外しています。Scene別ナレーションのみ使用します。';
      else detail.textContent = validation.warnings.join('／');
      const result = await exportProjectVideo(runtime, prepared, canvas, {
        signal:controller.signal,
        onStatus:setStatus,
        onProgress:(current,total) => setStatus(`生成中 ${Math.round(current)} / ${Math.round(total)}秒`)
      });
      downloadBlob(`${safeName(runtime.title)}.${result.extension}`, result.blob);
      setStatus(`生成完了 ${Math.round(result.durationSec)}秒`);
    } catch (error) {
      if (String(error?.name) !== 'AbortError') {
        console.error(error);
        setStatus('生成失敗');
        alert(`Shorts動画を生成できませんでした：${error instanceof Error ? error.message : String(error)}`);
      }
    } finally { setBusy(false); }
  };
}

const observer = new MutationObserver(() => inject());
observer.observe(document.getElementById('app') || document.body, { childList:true, subtree:true });
window.addEventListener('hashchange', () => setTimeout(inject, 0));
setTimeout(inject, 0);
