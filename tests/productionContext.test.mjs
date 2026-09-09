import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionContext, productionContextSignature } from '../productionContext.js';

test('builds compact context without audio or image bodies', () => {
  const context = buildProductionContext({ genre:'great-person', platform:'youtube-shorts', scenes:[{ text:'北斎', durationSec:5, imageData:'data:image/png;base64,HUGE', narration:{audioData:'data:audio/wav;base64,HUGE'} }] });
  assert.equal(context.sceneCount, 1);
  assert.equal(context.scenes[0].hasImage, true);
  assert.equal(context.scenes[0].hasNarration, true);
  const json = JSON.stringify(context);
  assert.doesNotMatch(json, /base64/);
  assert.equal(productionContextSignature(context), json);
});
