import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveShortsWorkspace, updateShortsDraftSceneOrder, updateShortsDraftSettings } from '../shortsWorkspace.js';

function projectFixture() {
  return {
    id:'p1',
    title:'Long video',
    scenes:[
      { id:'s1', text:'A', durationSec:10, imageData:'data:image/png;base64,AAA' },
      { id:'s2', text:'B', durationSec:12, smartReframe:{ focusX:.4, focusY:.5, zoom:1.1 } },
      { id:'s3', text:'C', durationSec:14 }
    ],
    shortsDrafts:[{
      id:'d1', title:'案', startIndex:0, endIndex:2, sceneIds:['s1','s2','s3'], durationSec:36, createdAt:'2026-09-09T00:00:00.000Z', updatedAt:'2026-09-09T00:00:00.000Z'
    }]
  };
}

test('workspace resolves source scenes without copying them into draft metadata', () => {
  const project = projectFixture();
  const workspace = resolveShortsWorkspace(project, 'd1');
  assert.equal(workspace.scenes.length, 3);
  assert.equal(workspace.scenes[1].sourceNumber, 2);
  assert.equal(workspace.aspectRatio, '9:16');
  assert.equal(Object.hasOwn(workspace.draft, 'mediaLibrary'), false);
  assert.equal(Object.hasOwn(workspace.draft, 'scenes'), false);
});

test('scene order update changes only draft references', () => {
  const project = projectFixture();
  const originalScenes = JSON.stringify(project.scenes);
  updateShortsDraftSceneOrder(project, 'd1', ['s3','s1','s2'], { now:()=>'later' });
  assert.deepEqual(project.shortsDrafts[0].sceneIds, ['s3','s1','s2']);
  assert.equal(project.shortsDrafts[0].updatedAt, 'later');
  assert.equal(JSON.stringify(project.scenes), originalScenes);
});

test('scene order rejects missing or duplicate references', () => {
  const project = projectFixture();
  assert.throws(() => updateShortsDraftSceneOrder(project, 'd1', ['s1','s1','s3']));
  assert.throws(() => updateShortsDraftSceneOrder(project, 'd1', ['s1','s2']));
});

test('settings stay lightweight and lock aspect ratio to 9:16', () => {
  const project = projectFixture();
  updateShortsDraftSettings(project, 'd1', { title:'  New Shorts  ', targetDurationSec:80 }, { now:()=>'later' });
  const draft = project.shortsDrafts[0];
  assert.equal(draft.title, 'New Shorts');
  assert.equal(draft.targetDurationSec, 60);
  assert.equal(draft.aspectRatio, '9:16');
  assert.equal(Object.hasOwn(draft, 'imageData'), false);
  assert.equal(Object.hasOwn(draft, 'videoData'), false);
});
