import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProjectImageVisualFeatureIndex, resolveProjectImageVisualFeatures } from '../projectImageVisualFeatureIndex.js';
import { createSceneImageVisualPairwiseTrainingSet } from '../sceneImageVisualPairwiseTraining.js';

function dataUrl(name) {
  return `data:image/png;base64,${name}`;
}

function imageData(value) {
  return {
    width: 1,
    height: 1,
    data: new Uint8ClampedArray([value, value, value, 255])
  };
}

function decision(projectId) {
  return {
    id: `d-${projectId}`,
    decisionType: 'scene-image-selection',
    projectId,
    sceneId: `s-${projectId}`,
    timestamp: '2026-09-07T00:00:00.000Z',
    humanAction: 'replace-image',
    source: 'user',
    proposal: { imageAssetId: 'shared-asset' },
    finalDecision: { imageAssetId: 'chosen-asset' },
    alternatives: [],
    context: { sceneText: 'test', sceneIndex: 0, platform: 'youtube-shorts', aspectRatio: '9:16' }
  };
}

test('keeps same asset ids isolated by project and does not retain raw media', async () => {
  const projects = [
    { id: 'p1', mediaLibrary: [
      { id: 'shared-asset', type: 'image', data: dataUrl('p1-shared') },
      { id: 'chosen-asset', type: 'image', data: dataUrl('p1-chosen') }
    ] },
    { id: 'p2', mediaLibrary: [
      { id: 'shared-asset', type: 'image', data: dataUrl('p2-shared') },
      { id: 'chosen-asset', type: 'image', data: dataUrl('p2-chosen') }
    ] }
  ];
  const before = structuredClone(projects);
  const values = {
    'p1-shared': 20,
    'p1-chosen': 220,
    'p2-shared': 200,
    'p2-chosen': 40
  };
  const index = await buildProjectImageVisualFeatureIndex(projects, async data => {
    const key = data.split(',')[1];
    return imageData(values[key]);
  });

  assert.deepEqual(projects, before);
  assert.equal(index.featureIndexVersion, '0.66');
  assert.equal(index.summary.processedProjects, 2);
  assert.equal(index.summary.processedAssets, 4);
  assert.notEqual(
    resolveProjectImageVisualFeatures(index, 'p1', 'shared-asset').brightness,
    resolveProjectImageVisualFeatures(index, 'p2', 'shared-asset').brightness
  );
  assert.equal(JSON.stringify(index).includes('data:image'), false);
});

test('v0.62 pair builder resolves features from the matching project scope', async () => {
  const projects = [
    { id: 'p1', mediaLibrary: [
      { id: 'shared-asset', type: 'image', data: dataUrl('dark') },
      { id: 'chosen-asset', type: 'image', data: dataUrl('bright') }
    ] },
    { id: 'p2', mediaLibrary: [
      { id: 'shared-asset', type: 'image', data: dataUrl('bright') },
      { id: 'chosen-asset', type: 'image', data: dataUrl('dark') }
    ] }
  ];
  const index = await buildProjectImageVisualFeatureIndex(projects, async data => {
    return imageData(data.endsWith('bright') ? 240 : 16);
  });
  const training = createSceneImageVisualPairwiseTrainingSet([decision('p1'), decision('p2')], index);

  assert.equal(training.featureScopeVersion, '0.66');
  assert.equal(training.examples.length, 2);
  const p1 = training.examples.find(example => example.projectId === 'p1');
  const p2 = training.examples.find(example => example.projectId === 'p2');
  assert.ok(p1.chosenFeatures.brightness > p1.rejectedFeatures.brightness);
  assert.ok(p2.chosenFeatures.brightness < p2.rejectedFeatures.brightness);
});

test('keeps legacy flat-map compatibility', () => {
  const feature = {
    visualFeatureVersion: '0.61',
    aspectRatio: 1,
    aspectBalance: 0.5,
    brightness: 0.5,
    contrast: 0,
    saturation: 0,
    edgeDensity: 0
  };
  const result = createSceneImageVisualPairwiseTrainingSet([decision('p1')], {
    'shared-asset': feature,
    'chosen-asset': { ...feature, brightness: 0.8 }
  });
  assert.equal(result.featureScopeVersion, 'flat-legacy');
  assert.equal(result.examples.length, 1);
});

test('skips duplicate or malformed projects safely', async () => {
  const result = await buildProjectImageVisualFeatureIndex([
    { id: 'p1', mediaLibrary: [] },
    { id: 'p1', mediaLibrary: [] },
    {},
    null
  ], async () => imageData(128));
  assert.equal(result.summary.eligibleProjects, 1);
  assert.equal(result.summary.skippedProjects, 3);
  assert.deepEqual(Object.keys(result.projectsById), ['p1']);
  assert.equal(resolveProjectImageVisualFeatures(result, 'missing', 'asset'), null);
});
