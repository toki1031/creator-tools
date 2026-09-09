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
