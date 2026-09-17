import test from 'node:test';
import assert from 'node:assert/strict';
import { runSceneAssetPipeline } from '../sceneAssetPipeline.js';

const scene = {
  id: 'scene-1', order: 1,
  productionDirection: {
    assetType: 'historical-source',
    visualDirection: 'Nightingale statistical diagram',
    rules: ['AI fake chart禁止']
  }
};
const project = { id: 'p1', scenes: [scene], mediaLibrary: [] };
const eligible = {
  title: 'Diagram of the causes of mortality',
  provider: 'verified-archive',
  sourceUrl: 'https://example.org/item/1',
  previewUrl: 'https://example.org/image.jpg',
  rightsStatements: ['Public domain'],
  rightsStatus: 'verified'
};
const resolved = {
  status: 'resolved',
  asset: { name: 'diagram.jpg', data: 'data:image/jpeg;base64,AAAA', previewUrl: eligible.previewUrl }
};

test('connects safe path through mediaLibrary and scene assignment without mutating input', async () => {
  const before = structuredClone(project);
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [eligible] }),
    fetchImage: async () => resolved
  });
  assert.equal(result.status, 'applied');
  assert.equal(result.stage, 'complete');
  assert.equal(result.project.mediaLibrary.length, 1);
  assert.equal(result.project.scenes[0].imageAssetId, result.assetId);
  assert.deepEqual(project, before);
});

test('stops at needs-review and never fetches or changes project', async () => {
  let fetchCalls = 0;
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [{ ...eligible, rightsStatus: 'needs-review' }] }),
    fetchImage: async () => { fetchCalls += 1; return resolved; }
  });
  assert.equal(result.status, 'needs-review');
  assert.equal(result.stage, 'adoption');
  assert.equal(fetchCalls, 0);
  assert.equal(result.project, null);
});

test('stops before search when requirement is ambiguous', async () => {
  let searchCalls = 0;
  const result = await runSceneAssetPipeline(project, { id: 's2', productionDirection: {} }, {
    searchCandidates: async () => { searchCalls += 1; return []; }
  });
  assert.equal(result.stage, 'requirement');
  assert.equal(searchCalls, 0);
});

test('stops on multiple eligible candidates before image fetch', async () => {
  let fetchCalls = 0;
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [eligible, { ...eligible, title: 'Second' }] }),
    fetchImage: async () => { fetchCalls += 1; return resolved; }
  });
  assert.equal(result.status, 'needs-selection');
  assert.equal(fetchCalls, 0);
});

test('propagates search and fetch failures without applying', async () => {
  const searchFailure = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'error', reason: 'offline' })
  });
  assert.equal(searchFailure.stage, 'search');
  assert.equal(searchFailure.status, 'error');

  const fetchFailure = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [eligible] }),
    fetchImage: async () => ({ status: 'error', reason: 'CORS' })
  });
  assert.equal(fetchFailure.stage, 'fetch');
  assert.equal(fetchFailure.status, 'error');
  assert.equal(fetchFailure.project, null);
});

test('protects an existing scene image at final apply stage', async () => {
  const withImage = { ...project, scenes: [{ ...scene, imageAssetId: 'manual-image' }] };
  const result = await runSceneAssetPipeline(withImage, withImage.scenes[0], {
    searchCandidates: async () => ({ status: 'ok', candidates: [eligible] }),
    fetchImage: async () => resolved
  });
  assert.equal(result.stage, 'apply');
  assert.equal(result.status, 'blocked');
  assert.equal(withImage.scenes[0].imageAssetId, 'manual-image');
});
