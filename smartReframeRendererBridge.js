import { readRoute } from './router.js';
import { getProject } from './db.js';
import { resolveSceneImageSource } from './mediaLibrary.js';
import { normalizeSceneReframe } from './smartReframe.js';
import { calculateReframedDrawRect } from './smartReframeRenderPlacement.js';

const PATCH_KEY = '__creatorOsSmartReframeDrawImagePatched';
const state = { routeId: '', bySource: new Map() };

function reframeSignature(value) {
  if (!value) return 'none';
  const normalized = normalizeSceneReframe(value);
  return `${normalized.focusX.toFixed(4)}:${normalized.focusY.toFixed(4)}:${normalized.zoom.toFixed(4)}`;
}

async function refreshSourceMap() {
  const route = readRoute();
  if (route.page !== 'output' || !route.id) {
    state.routeId = '';
    state.bySource = new Map();
    return;
  }
  const project = await getProject(route.id);
  if (!project) return;
  const grouped = new Map();
  for (const scene of Array.isArray(project.scenes) ? project.scenes : []) {
    const source = resolveSceneImageSource(project, scene).data;
    if (!source) continue;
    const entry = grouped.get(source) || [];
    entry.push(scene.smartReframe ? normalizeSceneReframe(scene.smartReframe) : null);
    grouped.set(source, entry);
  }
  const bySource = new Map();
  for (const [source, values] of grouped.entries()) {
    const signatures = new Set(values.map(reframeSignature));
    if (signatures.size !== 1 || signatures.has('none')) continue;
    bySource.set(source, values[0]);
  }
  state.routeId = route.id;
  state.bySource = bySource;
}

function patchCanvasDrawImage() {
  const proto = globalThis.CanvasRenderingContext2D?.prototype;
  if (!proto || proto[PATCH_KEY]) return;
  const original = proto.drawImage;
  Object.defineProperty(proto, PATCH_KEY, { value: true, configurable: false });
  proto.drawImage = function patchedDrawImage(...args) {
    if (args.length === 5 && state.bySource.size) {
      const [image, dx, dy, drawWidth, drawHeight] = args;
      const source = typeof image?.src === 'string' ? image.src : '';
      const reframe = source ? state.bySource.get(source) : null;
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
window.addEventListener('hashchange', () => { void refreshSourceMap(); });
window.addEventListener('focus', () => { void refreshSourceMap(); });
