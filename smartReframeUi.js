import { readRoute } from './router.js';
import { getProject, saveProject } from './db.js';
import { resolveSceneImageSource } from './mediaLibrary.js';
import { normalizeSceneReframe, suggestReframeFromSaliency } from './smartReframe.js';

const route = readRoute();
if (route.page === 'scenes' && route.id) void mountSmartReframe(route.id);

async function mountSmartReframe(projectId) {
  const sceneList = document.querySelector('#sceneList');
  if (!sceneList) return;
  let project = await getProject(projectId);
  if (!project) return;
  let activeIndex = -1;
  let candidate = null;

  const dialog = document.createElement('dialog');
  dialog.id = 'smartReframeDialog';
  dialog.className = 'smart-reframe-dialog';
  dialog.innerHTML = `
    <div class="section-head"><div><h2>Smart Reframe</h2><p>9:16で主役が切れにくい構図候補を端末内で分析します。</p></div></div>
    <div data-reframe-preview style="position:relative;overflow:hidden;aspect-ratio:9/16;max-height:58vh;background:#111;border-radius:14px;margin:12px auto;width:min(100%,340px)"></div>
    <p data-reframe-status class="muted">画像を分析しています…</p>
    <div class="tool-row" style="flex-wrap:wrap"><button type="button" data-reframe-preset="left">左を主役</button><button type="button" data-reframe-preset="center">中央</button><button type="button" data-reframe-preset="right">右を主役</button><button type="button" data-reframe-preset="top">上寄せ</button></div>
    <label>ズーム <input data-reframe-zoom type="range" min="1" max="1.5" step="0.01" value="1"><span data-reframe-zoom-label>1.00×</span></label>
    <p class="notice">分析だけではプロジェクトを変更しません。「この構図を採用」を押したときだけSceneへ保存します。画像データは外部送信しません。</p>
    <div class="dialog-actions"><button type="button" data-reframe-reset>中央に戻す</button><button type="button" data-reframe-close>閉じる</button><button type="button" class="primary" data-reframe-apply>この構図を採用</button></div>`;
  document.body.appendChild(dialog);

  const preview = dialog.querySelector('[data-reframe-preview]');
  const status = dialog.querySelector('[data-reframe-status]');
  const zoomInput = dialog.querySelector('[data-reframe-zoom]');
  const zoomLabel = dialog.querySelector('[data-reframe-zoom-label]');
  const sceneForIndex = index => Array.isArray(project?.scenes) ? project.scenes[index] : null;

  function renderCandidate() {
    const scene = sceneForIndex(activeIndex);
    const src = resolveSceneImageSource(project, scene).data;
    if (!scene || !src || !candidate) return;
    const value = normalizeSceneReframe(candidate);
    preview.innerHTML = `<img src="${src}" alt="Smart Reframe preview" style="width:100%;height:100%;object-fit:cover;object-position:${(value.focusX * 100).toFixed(1)}% ${(value.focusY * 100).toFixed(1)}%;transform:scale(${value.zoom.toFixed(3)});transform-origin:${(value.focusX * 100).toFixed(1)}% ${(value.focusY * 100).toFixed(1)}%;display:block">`;
    zoomInput.value = String(value.zoom);
    zoomLabel.textContent = `${value.zoom.toFixed(2)}×`;
  }

  async function analyzeImage(src) {
    const image = await loadImage(src);
    const size = 48;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('画像分析を開始できません。');
    ctx.drawImage(image, 0, 0, size, size);
    const pixels = ctx.getImageData(0, 0, size, size).data;
    const luminance = new Float32Array(size * size);
    for (let i = 0; i < luminance.length; i++) {
      const p = i * 4;
      luminance[i] = pixels[p] * 0.2126 + pixels[p + 1] * 0.7152 + pixels[p + 2] * 0.0722;
    }
    const saliency = new Array(size * size).fill(0);
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        const i = y * size + x;
        saliency[i] = Math.abs(luminance[i + 1] - luminance[i - 1]) + Math.abs(luminance[i + size] - luminance[i - size]);
      }
    }
    return suggestReframeFromSaliency(saliency, size, size);
  }

  async function openFor(index) {
    project = await getProject(projectId);
    activeIndex = index;
    const scene = sceneForIndex(index);
    const src = resolveSceneImageSource(project, scene).data;
    if (!scene || !src) {
      alert('このシーンには画像がありません。先に画像を登録してください。');
      return;
    }
    candidate = normalizeSceneReframe(scene.smartReframe || {});
    renderCandidate();
    status.textContent = '端末内で構図候補を分析しています…';
    if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
    try {
      const suggestion = await analyzeImage(src);
      candidate = suggestion;
      renderCandidate();
      const confidence = Math.round((Number(suggestion.confidence) || 0) * 100);
      status.textContent = suggestion.source === 'fallback-center' ? '特徴を十分に検出できなかったため中央構図を候補にしました。' : `構図候補を作成しました（特徴集中度 ${confidence}%）。`;
    } catch (error) {
      console.warn('Smart Reframe analysis failed', error);
      status.textContent = '自動分析できなかったため、現在の構図を表示しています。手動プリセットは利用できます。';
    }
  }

  function applyScenePreview(card, scene) {
    const img = card.querySelector('.scene-preview img');
    if (!img) return;
    if (!scene?.smartReframe) {
      img.style.removeProperty('object-position');
      img.style.removeProperty('transform');
      img.style.removeProperty('transform-origin');
      return;
    }
    const value = normalizeSceneReframe(scene.smartReframe);
    img.style.objectPosition = `${(value.focusX * 100).toFixed(1)}% ${(value.focusY * 100).toFixed(1)}%`;
    img.style.transform = `scale(${value.zoom.toFixed(3)})`;
    img.style.transformOrigin = `${(value.focusX * 100).toFixed(1)}% ${(value.focusY * 100).toFixed(1)}%`;
  }

  function injectButtons() {
    sceneList.querySelectorAll('.scene-card').forEach((card, index) => {
      const scene = sceneForIndex(index);
      applyScenePreview(card, scene);
      const controls = card.querySelector('.scene-image-control');
      if (!controls || controls.querySelector('[data-smart-reframe]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.smartReframe = String(index);
      button.textContent = scene?.smartReframe ? 'Smart Reframe ✓' : 'Smart Reframe';
      button.onclick = () => void openFor(index);
      controls.appendChild(button);
    });
  }

  dialog.querySelectorAll('[data-reframe-preset]').forEach(button => button.addEventListener('click', () => {
    const presets = {
      left: { focusX: 0.3, focusY: 0.5, zoom: 1.08 }, center: { focusX: 0.5, focusY: 0.5, zoom: 1 },
      right: { focusX: 0.7, focusY: 0.5, zoom: 1.08 }, top: { focusX: 0.5, focusY: 0.35, zoom: 1.08 }
    };
    candidate = presets[button.dataset.reframePreset] || presets.center;
    renderCandidate();
    status.textContent = '手動プリセットを候補にしました。';
  }));

  zoomInput.addEventListener('input', () => {
    candidate = { ...normalizeSceneReframe(candidate || {}), zoom: Number(zoomInput.value) };
    renderCandidate();
  });

  dialog.querySelector('[data-reframe-apply]').addEventListener('click', async () => {
    project = await getProject(projectId);
    const scene = sceneForIndex(activeIndex);
    if (!scene || !candidate) return;
    scene.smartReframe = { ...normalizeSceneReframe(candidate), source: candidate.source || 'manual', updatedAt: new Date().toISOString() };
    project.updatedAt = new Date().toISOString();
    await saveProject(project);
    if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
    injectButtons();
  });

  dialog.querySelector('[data-reframe-reset]').addEventListener('click', async () => {
    project = await getProject(projectId);
    const scene = sceneForIndex(activeIndex);
    if (!scene) return;
    delete scene.smartReframe;
    project.updatedAt = new Date().toISOString();
    await saveProject(project);
    candidate = { focusX: 0.5, focusY: 0.5, zoom: 1 };
    renderCandidate();
    status.textContent = 'Smart Reframe設定を解除し、中央構図へ戻しました。';
    injectButtons();
  });

  dialog.querySelector('[data-reframe-close]').addEventListener('click', () => {
    if (dialog.open && typeof dialog.close === 'function') dialog.close(); else dialog.removeAttribute('open');
  });

  new MutationObserver(() => injectButtons()).observe(sceneList, { childList: true, subtree: true });
  injectButtons();
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('画像を読み込めませんでした。'));
    image.src = src;
  });
}
