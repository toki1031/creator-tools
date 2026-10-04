import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');

test('final review image replacement reuses the existing media library and command layer',()=>{
  assert.match(source,/id="finalReviewImageDialog"/);
  assert.match(source,/data-replace-image/);
  assert.match(source,/ensureMediaLibrary\(project\)/);
  assert.match(source,/resolveSceneImageForDisplay\(project,\{imageAssetId:el\.dataset\.finalReviewAssetImage\}\)/);
  assert.match(source,/type:'replace-scene-image'/);
});

test('final review image picker keeps images lazy until the dialog is opened',()=>{
  const outputStart=source.indexOf('async function renderOutput');
  const pickerStart=source.indexOf('const openFinalReviewImagePicker=async sceneId=>',outputStart);
  const resolveStart=source.indexOf('resolveSceneImageForDisplay(project,{imageAssetId:el.dataset.finalReviewAssetImage})',outputStart);
  assert.ok(pickerStart>outputStart);
  assert.ok(resolveStart>pickerStart);
  assert.doesNotMatch(source.slice(outputStart,pickerStart),/data-final-review-asset-image[^\n]*src=/);
});

test('final review picker does not add upload or duplicate media storage paths',()=>{
  assert.doesNotMatch(source,/id="finalReviewImageDialog"[\s\S]{0,800}type="file"/);
  assert.doesNotMatch(source,/finalReviewImageSceneId[\s\S]{0,2500}addImageAsset\(/);
});
