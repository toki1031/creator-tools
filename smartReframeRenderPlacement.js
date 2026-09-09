const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value) || 0));

export function normalizeRenderReframe(value = {}) {
  return {
    focusX: clamp(value?.focusX ?? 0.5, 0, 1),
    focusY: clamp(value?.focusY ?? 0.5, 0, 1),
    zoom: clamp(value?.zoom ?? 1, 1, 1.5)
  };
}

export function calculateReframedDrawRect(frameWidth, frameHeight, dx, dy, drawWidth, drawHeight, reframe = {}) {
  const fw = Math.max(1, Number(frameWidth) || 1);
  const fh = Math.max(1, Number(frameHeight) || 1);
  const width = Math.max(fw, Number(drawWidth) || fw);
  const height = Math.max(fh, Number(drawHeight) || fh);
  const currentX = Number(dx) || 0;
  const currentY = Number(dy) || 0;
  const normalized = normalizeRenderReframe(reframe);

  const centeredX = (fw - width) / 2;
  const centeredY = (fh - height) / 2;
  const motionDeltaX = currentX - centeredX;
  const motionDeltaY = currentY - centeredY;
  const nextWidth = width * normalized.zoom;
  const nextHeight = height * normalized.zoom;

  const minX = Math.min(0, fw - nextWidth);
  const minY = Math.min(0, fh - nextHeight);
  const idealX = fw / 2 - nextWidth * normalized.focusX + motionDeltaX;
  const idealY = fh / 2 - nextHeight * normalized.focusY + motionDeltaY;

  return {
    x: Math.min(0, Math.max(minX, idealX)),
    y: Math.min(0, Math.max(minY, idealY)),
    drawWidth: nextWidth,
    drawHeight: nextHeight
  };
}
