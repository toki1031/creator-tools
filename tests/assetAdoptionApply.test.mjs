import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAssetAdoptionPlan } from '../assetAdoptionApply.js';

function baseProject() {
  return {
    id: 'project-1',
    schemaVersion: 4,
    scenes: [{ id: 'scene-5', order: 5, text: '数字' }],
    mediaLibrary: [{ id: 'existing', type: 'image', data: 'data:image/png;base64,old' }]
  };
}

const readyPlan = {
  sceneId: 'scene-5',
  status: 'ready',
  candidate: {
    provider: 'library-of-congress',
    title: 'Nightingale statistical diagram',
    sourcePage: 'https://www.loc.gov/item/example/',
    previewUrl: 'https://tile.loc.gov/example.jpg',
    rightsAdvisory: 'Check Rights & Access'
  }
};

test('does nothing without explicit apply permission', () => {
  const project = baseProject();
  const before = JSON.stringify(project);
  const result = applyAssetAdoptionPlan(project, readyPlan, { data: 'data:image/jpeg;base64,new' });
  assert.equal(result.applied, false);
  assert.equal(JSON.stringify(project), before);
});

test('applies a ready asset to mediaLibrary and matching Scene without mutation', () => {
  const project = baseProject();
  const before = JSON.stringify(project);
  const result = applyAssetAdoptionPlan(project, readyPlan, { id: 'nightingale-chart', data: 'data:image/jpeg;base64,new' }, { allowApply: true });
  assert.equal(result.applied, true);
  assert.equal(result.project.mediaLibrary.length, 2);
  assert.equal(result.project.scenes[0].imageAssetId, 'nightingale-chart');
  assert.equal(result.project.mediaLibrary[1].source.pageUrl, readyPlan.candidate.sourcePage);
  assert.equal(JSON.stringify(project), before);
});

test('does not apply needs-review or blocked plans', () => {
  for (const status of ['needs-review', 'blocked', 'needs-selection']) {
    const result = applyAssetAdoptionPlan(baseProject(), { ...readyPlan, status }, { data: 'data:image/jpeg;base64,new' }, { allowApply: true });
    assert.equal(result.applied, false);
    assert.equal(result.project.mediaLibrary.length, 1);
  }
});

test('protects an existing Scene image assignment', () => {
  const project = baseProject();
  project.scenes[0].imageAssetId = 'existing';
  const result = applyAssetAdoptionPlan(project, readyPlan, { data: 'data:image/jpeg;base64,new' }, { allowApply: true });
  assert.equal(result.applied, false);
  assert.equal(result.project.scenes[0].imageAssetId, 'existing');
  assert.equal(result.project.mediaLibrary.length, 1);
});

test('avoids mediaLibrary asset id collisions', () => {
  const project = baseProject();
  const result = applyAssetAdoptionPlan(project, readyPlan, { id: 'existing', data: 'data:image/jpeg;base64,new' }, { allowApply: true });
  assert.equal(result.applied, true);
  assert.equal(result.assetId, 'existing-2');
  assert.equal(result.project.scenes[0].imageAssetId, 'existing-2');
});

test('does not apply when Scene or usable image data is missing', () => {
  const noScene = applyAssetAdoptionPlan(baseProject(), { ...readyPlan, sceneId: 'missing' }, { data: 'x' }, { allowApply: true });
  assert.equal(noScene.applied, false);
  const noData = applyAssetAdoptionPlan(baseProject(), { ...readyPlan, candidate: { ...readyPlan.candidate, previewUrl: '' } }, {}, { allowApply: true });
  assert.equal(noData.applied, false);
});
