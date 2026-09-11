import { readRoute } from './router.js';
import { getProject } from './db.js';
import { resolveSceneImageSource } from './mediaLibrary.js';
import { normalizeSceneReframe } from './smartReframe.js';
import { calculateReframedDrawRect } from './smartReframeRenderPlacement.js';

const PATCH_KEY = '__creatorOsSmartReframeDrawImagePatched';
const state = { routeId: '', bySourceKey: new Map() };
const imageSourceKeyCache = new WeakMap();

function reframeSignature(value) {
  if (!value) return 'none';
  const normalized = normalizeSceneReframe(value);
  return `${normalized.focusX.toFixed(4)}:${normalized.focusY.toFixed(4)}:${normalized.zoom.toFixed(4)}`;
}

function sourceKey(source) {
  const text = typeof source === 'string' ? source : '';
  if (!text) return '';
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`;
}

function keyForImage(image) {
  if (!image || typeof image !== 'object') return '';
  const cached = imageSourceKeyCache.get(image);
  if (cached) return cached;
  const key = sourceKey(typeof image.src === 'string' ? image.src : '');
  if (key) imageSourceKeyCache.set(image, key);
  return key;
}

async function refreshSourceMap({ force = false } = {}) {
  const route = readRoute();
  if (route.page !== 'output' || !route.id) {
    state.routeId = '';
    state.bySourceKey = new Map();
    return;
  }
  if (!force && state.routeId === route.id && state.bySourceKey.size) return;

  const project = await getProject(route.id);
  if (!project) return;
  const grouped = new Map();
  for (const scene of Array.isArray(project.scenes) ? project.scenes : []) {
    const source = resolveSceneImageSource(project, scene).data;
    const key = sourceKey(source);
    if (!key) continue;
    const entry = grouped.get(key) || [];
    entry.push(scene.smartReframe ? normalizeSceneReframe(scene.smartReframe) : null);
    grouped.set(key, entry);
  }
  const bySourceKey = new Map();
  for (const [key, values] of grouped.entries()) {
    const signatures = new Set(values.map(reframeSignature));
    if (signatures.size !== 1 || signatures.has('none')) continue;
    bySourceKey.set(key, values[0]);
  }
  state.routeId = route.id;
  state.bySourceKey = bySourceKey;
}

function patchCanvasDrawImage() {
  const proto = globalThis.CanvasRenderingContext2D?.prototype;
  if (!proto || proto[PATCH_KEY]) return;
  const original = proto.drawImage;
  Object.defineProperty(proto, PATCH_KEY, { value: true, configurable: false });
  proto.drawImage = function patchedDrawImage(...args) {
    if (args.length === 5 && state.bySourceKey.size) {
      const [image, dx, dy, drawWidth, drawHeight] = args;
      const key = keyForImage(image);
      const reframe = key ? state.bySourceKey.get(key) : null;
      const canvas = this?.canvas;
      const fw = Number(canvas?.width) || 0;
      const fh = Number(canvas?.height) || 0;
      const width = Number(drawWidth) || 0;
      const height = Number(drawHeight) || 0;
      const looksLikeSceneCover = fw > 0 && fh > 0 && width >= fw - 1 && height >= fh - 1;
      if (reframe && looksLikeSceneCover) {
        const rect = calculateReframedDrawRect(fw, fh, dx, dy, width, height, reframe);
        return original.call(this, image, rect.x, rect.y, rect.drawWidth, rect.drawHeight);
      }
    }
    return original.apply(this, args);
  };
}

patchCanvasDrawImage();
void refreshSourceMap();
window.addEventListener('hashchange', () => { void refreshSourceMap({ force: true }); });
// Safariで別アプリ/別タブから戻るたびに30MB級projectを再読込しない。
// 同一outputルートでは既存の小さいreframe mapを再利用する。
window.addEventListener('focus', () => { void refreshSourceMap(); });
