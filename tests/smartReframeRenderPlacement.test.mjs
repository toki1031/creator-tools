import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReframedDrawRect, normalizeRenderReframe } from '../smartReframeRenderPlacement.js';

test('normalizes render reframe safely', () => {
  assert.deepEqual(normalizeRenderReframe({ focusX: -2, focusY: 3, zoom: 9 }), { focusX: 0, focusY: 1, zoom: 1.5 });
});

test('center with zoom 1 preserves existing cover placement', () => {
  const rect = calculateReframedDrawRect(1080, 1920, -1166.67, 0, 3413.33, 1920, { focusX: 0.5, focusY: 0.5, zoom: 1 });
  assert.ok(Math.abs(rect.x + 1166.665) < 0.02);
  assert.equal(rect.y, 0);
  assert.ok(Math.abs(rect.drawWidth - 3413.33) < 0.01);
  assert.equal(rect.drawHeight, 1920);
});

test('left focus moves a landscape image right without exposing empty frame', () => {
  const rect = calculateReframedDrawRect(1080, 1920, -1166.67, 0, 3413.33, 1920, { focusX: 0.3, focusY: 0.5, zoom: 1.08 });
  assert.ok(rect.x > -1166.67);
  assert.ok(rect.x <= 0);
  assert.ok(rect.x + rect.drawWidth >= 1080);
  assert.ok(rect.y <= 0);
  assert.ok(rect.y + rect.drawHeight >= 1920);
});

test('existing motion offset is retained while reframe is applied', () => {
  const centeredX = (1080 - 3600) / 2;
  const motionX = centeredX + 48;
  const rect = calculateReframedDrawRect(1080, 1920, motionX, 0, 3600, 1920, { focusX: 0.5, focusY: 0.5, zoom: 1 });
  assert.ok(Math.abs(rect.x - motionX) < 0.001);
});
