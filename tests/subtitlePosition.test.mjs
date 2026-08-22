import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSubtitleOffset, resolveSubtitleYRatio } from '../subtitlePosition.js';

test('上・中央・下の従来位置を維持する',()=>{
  assert.equal(resolveSubtitleYRatio('top',0),.2);
  assert.equal(resolveSubtitleYRatio('center',0),.5);
  assert.equal(resolveSubtitleYRatio('bottom',0),.82);
});

test('画面高さに対する上下微調整を適用する',()=>{
  assert.ok(Math.abs(resolveSubtitleYRatio('bottom',-6)-.76)<1e-12);
  assert.equal(resolveSubtitleYRatio('top',5),.25);
});

test('未設定値と範囲外値を安全に補正する',()=>{
  assert.equal(normalizeSubtitleOffset(undefined),0);
  assert.equal(normalizeSubtitleOffset(-99),-15);
  assert.equal(normalizeSubtitleOffset(99),15);
  assert.ok(Math.abs(resolveSubtitleYRatio('top',-99)-.05)<1e-12);
  assert.equal(resolveSubtitleYRatio('bottom',99),resolveSubtitleYRatio('bottom',15));
  assert.ok(resolveSubtitleYRatio('bottom',99)<=.96);
});

test('字幕ボックスの半分を考慮して画面内へ収める',()=>{
  assert.equal(resolveSubtitleYRatio('top',-15,.12,.04),.16);
  assert.equal(resolveSubtitleYRatio('bottom',15,.12,.04),.84);
});
