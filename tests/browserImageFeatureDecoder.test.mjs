import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateFeatureDecodeSize, decodeImageDataUrlForFeatures } from '../browserImageFeatureDecoder.js';

function makeImage({ width = 400, height = 200, fail = false } = {}) {
  const image = { naturalWidth: width, naturalHeight: height, onload: null, onerror: null };
  Object.defineProperty(image, 'src', {
    set() {
      queueMicrotask(() => fail ? image.onerror?.(new Error('load failed')) : image.onload?.());
    }
  });
  return image;
}

function makeCanvas(result, calls) {
  return {
    width: 0,
    height: 0,
    getContext() {
      return {
        drawImage(...args) { calls.push(args); },
        getImageData(x, y, width, height) {
          calls.push(['getImageData', x, y, width, height]);
          return result;
        }
      };
    }
  };
}

test('preserves aspect ratio while shrinking to bounded feature dimensions', () => {
  assert.deepEqual(calculateFeatureDecodeSize(400, 200, 128), { width: 128, height: 64 });
  assert.deepEqual(calculateFeatureDecodeSize(200, 400, 128), { width: 64, height: 128 });
  assert.deepEqual(calculateFeatureDecodeSize(40, 20, 128), { width: 40, height: 20 });
  assert.equal(calculateFeatureDecodeSize(0, 20), null);
});

test('decodes data:image locally through image and canvas factories', async () => {
  const imageData = { width: 128, height: 64, data: new Uint8ClampedArray(128 * 64 * 4) };
  const calls = [];
  const canvas = makeCanvas(imageData, calls);
  const result = await decodeImageDataUrlForFeatures('data:image/png;base64,abc', {
    imageFactory: () => makeImage(),
    canvasFactory: () => canvas,
    timeoutMs: 1000
  });

  assert.equal(result, imageData);
  assert.equal(canvas.width, 128);
  assert.equal(canvas.height, 64);
  assert.deepEqual(calls.at(-1), ['getImageData', 0, 0, 128, 64]);
});

test('rejects malformed URLs, image errors, and missing canvas contexts safely', async () => {
  await assert.rejects(() => decodeImageDataUrlForFeatures('https://example.com/x.png'), /invalid-image-data-url/);
  await assert.rejects(() => decodeImageDataUrlForFeatures('data:image/png;base64,abc', {
    imageFactory: () => makeImage({ fail: true }),
    canvasFactory: () => makeCanvas({}, [])
  }), /load failed/);
  await assert.rejects(() => decodeImageDataUrlForFeatures('data:image/png;base64,abc', {
    imageFactory: () => makeImage(),
    canvasFactory: () => ({ getContext: () => null })
  }), /canvas-context-unavailable/);
});

test('times out without hanging when image loading never resolves', async () => {
  const image = { naturalWidth: 1, naturalHeight: 1, onload: null, onerror: null };
  Object.defineProperty(image, 'src', { set() {} });
  let timeoutHandler;
  const promise = decodeImageDataUrlForFeatures('data:image/png;base64,abc', {
    imageFactory: () => image,
    canvasFactory: () => makeCanvas({}, []),
    setTimer(handler) { timeoutHandler = handler; return 1; },
    clearTimer() {}
  });
  timeoutHandler();
  await assert.rejects(() => promise, /image-decode-timeout/);
});
