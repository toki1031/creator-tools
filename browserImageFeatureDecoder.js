import { isImageDataUrl } from './mediaLibrary.js';

function boundedInteger(value, fallback, min, max) {
  const number = Number(value);
  if (!Number.isInteger(number)) return fallback;
  return Math.min(max, Math.max(min, number));
}

function targetSize(width, height, maxDimension) {
  const w = Number(width);
  const h = Number(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  const scale = Math.min(1, maxDimension / Math.max(w, h));
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale))
  };
}

export async function decodeImageDataUrlForFeatures(dataUrl, options = {}) {
  if (!isImageDataUrl(dataUrl)) throw new Error('invalid-image-data-url');

  const maxDimension = boundedInteger(options.maxDimension, 128, 16, 512);
  const timeoutMs = boundedInteger(options.timeoutMs, 5000, 100, 30000);
  const imageFactory = options.imageFactory || (() => new Image());
  const canvasFactory = options.canvasFactory || (() => document.createElement('canvas'));
  const setTimer = options.setTimer || ((handler, ms) => setTimeout(handler, ms));
  const clearTimer = options.clearTimer || (handle => clearTimeout(handle));

  const image = imageFactory();
  if (!image) throw new Error('image-unavailable');

  await new Promise((resolve, reject) => {
    let settled = false;
    let timer = null;
    const finish = callback => value => {
      if (settled) return;
      settled = true;
      if (timer != null) clearTimer(timer);
      callback(value);
    };
    const resolveOnce = finish(resolve);
    const rejectOnce = finish(reject);
    image.onload = resolveOnce;
    image.onerror = rejectOnce;
    timer = setTimer(() => rejectOnce('image-decode-timeout'), timeoutMs);
    try {
      image.src = dataUrl;
    } catch (error) {
      rejectOnce(error);
    }
  }).catch(error => {
    if (error === 'image-decode-timeout') throw new Error('image-decode-timeout');
    throw error instanceof Error ? error : new Error('image-decode-failed');
  });

  const size = targetSize(image.naturalWidth || image.width, image.naturalHeight || image.height, maxDimension);
  if (!size) throw new Error('invalid-image-dimensions');

  const canvas = canvasFactory();
  if (!canvas) throw new Error('canvas-unavailable');
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext?.('2d', { willReadFrequently: true });
  if (!context) throw new Error('canvas-context-unavailable');

  context.drawImage(image, 0, 0, size.width, size.height);
  return context.getImageData(0, 0, size.width, size.height);
}

export function calculateFeatureDecodeSize(width, height, maxDimension = 128) {
  return targetSize(width, height, boundedInteger(maxDimension, 128, 16, 512));
}
