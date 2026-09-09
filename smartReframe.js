const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function normalizeSceneReframe(value = {}) {
  return {
    focusX: clamp(value?.focusX ?? 0.5, 0, 1),
    focusY: clamp(value?.focusY ?? 0.5, 0, 1),
    zoom: clamp(value?.zoom ?? 1, 1, 1.5)
  };
}

export function reframePreset(name = 'center') {
  if (name === 'left') return { focusX: 0.3, focusY: 0.5, zoom: 1.08 };
  if (name === 'right') return { focusX: 0.7, focusY: 0.5, zoom: 1.08 };
  if (name === 'top') return { focusX: 0.5, focusY: 0.35, zoom: 1.08 };
  if (name === 'close') return { focusX: 0.5, focusY: 0.5, zoom: 1.2 };
  return { focusX: 0.5, focusY: 0.5, zoom: 1 };
}

export function calculateCoverPlacement(imageWidth, imageHeight, frameWidth, frameHeight, reframe = {}) {
  const iw = Math.max(1, Number(imageWidth) || 1);
  const ih = Math.max(1, Number(imageHeight) || 1);
  const fw = Math.max(1, Number(frameWidth) || 1);
  const fh = Math.max(1, Number(frameHeight) || 1);
  const normalized = normalizeSceneReframe(reframe);
  const base = Math.max(fw / iw, fh / ih);
  const drawWidth = iw * base * normalized.zoom;
  const drawHeight = ih * base * normalized.zoom;
  const idealX = fw / 2 - drawWidth * normalized.focusX;
  const idealY = fh / 2 - drawHeight * normalized.focusY;
  const x = Math.min(0, Math.max(fw - drawWidth, idealX));
  const y = Math.min(0, Math.max(fh - drawHeight, idealY));
  return { x, y, drawWidth, drawHeight, ...normalized };
}

export function suggestReframeFromSaliency(samples = [], gridWidth = 0, gridHeight = 0) {
  const w = Math.max(0, Math.floor(Number(gridWidth) || 0));
  const h = Math.max(0, Math.floor(Number(gridHeight) || 0));
  if (!w || !h || !Array.isArray(samples) || samples.length < w * h) {
    return { ...reframePreset('center'), confidence: 0, source: 'fallback-center' };
  }

  let total = 0;
  let weightedX = 0;
  let weightedY = 0;
  let peak = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const raw = Math.max(0, Number(samples[y * w + x]) || 0);
      const nx = (x + 0.5) / w;
      const ny = (y + 0.5) / h;
      const centerBias = 0.72 + 0.28 * (1 - Math.min(1, Math.hypot(nx - 0.5, ny - 0.5) / 0.71));
      const weight = raw * centerBias;
      total += weight;
      weightedX += nx * weight;
      weightedY += ny * weight;
      peak = Math.max(peak, raw);
    }
  }

  if (total <= 0 || peak <= 0) return { ...reframePreset('center'), confidence: 0, source: 'fallback-center' };

  const focusX = clamp(weightedX / total, 0.2, 0.8);
  const focusY = clamp(weightedY / total, 0.2, 0.8);
  const average = total / (w * h);
  const concentration = clamp((peak / Math.max(average, 0.0001) - 1) / 5, 0, 1);
  const zoom = clamp(1 + concentration * 0.12, 1, 1.12);
  const confidence = clamp(concentration * 0.8 + 0.2, 0, 1);
  return { focusX, focusY, zoom, confidence, source: 'local-saliency-v1' };
}
