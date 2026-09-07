const DEFAULT_MAX_SAMPLES = 4096;

function finiteInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function round(value, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function luminance01(r, g, b) {
  return clamp01((0.2126 * r + 0.7152 * g + 0.0722 * b) / 255);
}

function saturation01(r, g, b) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max <= 0) return 0;
  return clamp01((max - min) / max);
}

function pixelLuminance(data, width, x, y) {
  const offset = (y * width + x) * 4;
  return luminance01(data[offset], data[offset + 1], data[offset + 2]);
}

export function extractImageVisualFeatures(imageDataLike, options = {}) {
  const width = finiteInteger(imageDataLike?.width);
  const height = finiteInteger(imageDataLike?.height);
  const data = imageDataLike?.data;
  if (!width || !height || !data || typeof data.length !== 'number') return null;

  const expectedLength = width * height * 4;
  if (!Number.isSafeInteger(expectedLength) || expectedLength <= 0 || data.length < expectedLength) return null;

  const requestedMaxSamples = finiteInteger(options.maxSamples) || DEFAULT_MAX_SAMPLES;
  const maxSamples = Math.min(65536, Math.max(16, requestedMaxSamples));
  const stride = Math.max(1, Math.ceil(Math.sqrt((width * height) / maxSamples)));

  let count = 0;
  let sumLuma = 0;
  let sumLumaSquared = 0;
  let sumSaturation = 0;
  let edgeSum = 0;
  let edgeCount = 0;

  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const offset = (y * width + x) * 4;
      const r = Number(data[offset]) || 0;
      const g = Number(data[offset + 1]) || 0;
      const b = Number(data[offset + 2]) || 0;
      const luma = luminance01(r, g, b);

      count += 1;
      sumLuma += luma;
      sumLumaSquared += luma * luma;
      sumSaturation += saturation01(r, g, b);

      const rightX = x + stride;
      if (rightX < width) {
        edgeSum += Math.abs(luma - pixelLuminance(data, width, rightX, y));
        edgeCount += 1;
      }
      const downY = y + stride;
      if (downY < height) {
        edgeSum += Math.abs(luma - pixelLuminance(data, width, x, downY));
        edgeCount += 1;
      }
    }
  }

  if (!count) return null;
  const brightness = sumLuma / count;
  const variance = Math.max(0, (sumLumaSquared / count) - brightness * brightness);
  const contrast = clamp01(Math.sqrt(variance) * 2);
  const saturation = sumSaturation / count;
  const edgeDensity = edgeCount ? edgeSum / edgeCount : 0;

  return {
    visualFeatureVersion: '0.61',
    width,
    height,
    aspectRatio: round(width / height),
    aspectBalance: round(width / (width + height)),
    brightness: round(brightness),
    contrast: round(contrast),
    saturation: round(saturation),
    edgeDensity: round(clamp01(edgeDensity)),
    sampledPixels: count
  };
}
