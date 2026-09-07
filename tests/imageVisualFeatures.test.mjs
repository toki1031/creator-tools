import test from 'node:test';
import assert from 'node:assert/strict';
import { extractImageVisualFeatures } from '../imageVisualFeatures.js';

function rgba(width, height, pixel) {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    const offset = i * 4;
    data[offset] = pixel[0];
    data[offset + 1] = pixel[1];
    data[offset + 2] = pixel[2];
    data[offset + 3] = pixel[3] ?? 255;
  }
  return { width, height, data };
}

test('extracts deterministic compact features from a solid image without mutating pixels', () => {
  const image = rgba(4, 2, [255, 0, 0, 255]);
  const before = [...image.data];
  const features = extractImageVisualFeatures(image);

  assert.deepEqual([...image.data], before);
  assert.equal(features.visualFeatureVersion, '0.61');
  assert.equal(features.width, 4);
  assert.equal(features.height, 2);
  assert.equal(features.aspectRatio, 2);
  assert.equal(features.aspectBalance, 0.6667);
  assert.ok(features.brightness > 0.21 && features.brightness < 0.22);
  assert.equal(features.contrast, 0);
  assert.equal(features.saturation, 1);
  assert.equal(features.edgeDensity, 0);
  assert.equal(JSON.stringify(features), JSON.stringify(extractImageVisualFeatures(image)));
});

test('high-contrast checkerboard has higher contrast and edge density than a solid image', () => {
  const width = 4;
  const height = 4;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const value = (x + y) % 2 === 0 ? 0 : 255;
      const offset = (y * width + x) * 4;
      data[offset] = value;
      data[offset + 1] = value;
      data[offset + 2] = value;
      data[offset + 3] = 255;
    }
  }

  const checker = extractImageVisualFeatures({ width, height, data });
  const solid = extractImageVisualFeatures(rgba(width, height, [128, 128, 128, 255]));

  assert.ok(checker.contrast > solid.contrast);
  assert.ok(checker.edgeDensity > solid.edgeDensity);
  assert.equal(checker.saturation, 0);
});

test('bounds sampling cost and reports portrait/landscape geometry consistently', () => {
  const landscape = extractImageVisualFeatures(rgba(200, 100, [10, 20, 30, 255]), { maxSamples: 100 });
  const portrait = extractImageVisualFeatures(rgba(100, 200, [10, 20, 30, 255]), { maxSamples: 100 });

  assert.equal(landscape.aspectRatio, 2);
  assert.equal(portrait.aspectRatio, 0.5);
  assert.ok(landscape.aspectBalance > 0.5);
  assert.ok(portrait.aspectBalance < 0.5);
  assert.ok(landscape.sampledPixels <= 100);
  assert.ok(portrait.sampledPixels <= 100);
});

test('rejects malformed image data safely', () => {
  assert.equal(extractImageVisualFeatures(null), null);
  assert.equal(extractImageVisualFeatures({ width: 0, height: 1, data: [] }), null);
  assert.equal(extractImageVisualFeatures({ width: 2, height: 2, data: new Uint8ClampedArray(3) }), null);
  assert.equal(extractImageVisualFeatures({ width: 1.5, height: 2, data: new Uint8ClampedArray(12) }), null);
});
