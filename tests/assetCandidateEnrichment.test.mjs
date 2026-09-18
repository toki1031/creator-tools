import test from 'node:test';
import assert from 'node:assert/strict';
import { enrichAssetCandidates } from '../assetCandidateEnrichment.js';
import { runSceneAssetPipeline } from '../sceneAssetPipeline.js';

const scene = {
  id: 'scene-1', order: 1,
  productionDirection: {
    assetType: 'historical-source',
    visualDirection: 'historical document',
    rules: ['生成素材で実物史料を代用しない']
  }
};
const project = { id: 'p1', scenes: [scene], mediaLibrary: [] };

function locCandidate(overrides = {}) {
  return {
    provider: 'library-of-congress', sceneId: 'scene-1', requestedType: 'historical-source',
    title: 'Archive item', sourceUrl: 'https://www.loc.gov/item/abc/',
    previewUrl: 'https://tile.loc.gov/example.jpg', rightsStatus: 'needs-review',
    ...overrides
  };
}

test('enriches LoC candidates sequentially through the external slot', async () => {
  const events = [];
  const result = await enrichAssetCandidates([locCandidate(), locCandidate({ sourceUrl: 'https://www.loc.gov/item/def/' })], {
    waitForExternalSlot: async () => events.push('slot'),
    enrichLoc: async candidate => { events.push(candidate.sourceUrl); return { ...candidate, rightsStatements: ['Public domain'], rightsStatus: 'rights-cleared-signal' }; }
  });
  assert.deepEqual(events, ['slot', 'https://www.loc.gov/item/abc/', 'slot', 'https://www.loc.gov/item/def/']);
  assert.equal(result[0].rightsStatus, 'rights-cleared-signal');
});

test('ambiguous LoC rights stop before image fetch or apply', async () => {
  let fetched = 0;
  let applied = 0;
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [locCandidate()] }),
    enrichCandidates: async candidates => candidates.map(candidate => ({ ...candidate, rightsStatements: ['Rights information requires review'], rightsStatus: 'needs-review' })),
    fetchImage: async () => { fetched += 1; return { status: 'resolved', asset: {} }; },
    applyAsset: () => { applied += 1; return { applied: true, project }; }
  });
  assert.equal(result.status, 'needs-review');
  assert.equal(result.stage, 'adoption');
  assert.equal(fetched, 0);
  assert.equal(applied, 0);
});

test('explicit free-use signal without official rights-check evidence stops before fetch', async () => {
  let fetched = 0;
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [locCandidate()] }),
    enrichCandidates: async candidates => candidates.map(candidate => ({ ...candidate, rightsStatements: ['No known copyright restrictions'], rightsStatus: 'rights-cleared-signal' })),
    fetchImage: async plan => { fetched += 1; return { status: 'resolved', asset: { name: 'a.jpg', data: 'data:image/jpeg;base64,AA==', previewUrl: plan.candidate.previewUrl } }; },
    applyAsset: (input, plan) => ({ applied: true, project: { ...input, appliedCandidate: plan.candidate }, assetId: 'asset-1' })
  });
  assert.equal(result.status, 'needs-review');
  assert.equal(result.stage, 'adoption');
  assert.equal(fetched, 0);
  assert.equal(result.adoptionPlan.autoApply, false);
  assert.equal(result.adoptionPlan.candidate.rightsStatus, 'rights-cleared-signal');
});

test('enrichment failure stops safely', async () => {
  let fetched = 0;
  const result = await runSceneAssetPipeline(project, scene, {
    searchCandidates: async () => ({ status: 'ok', candidates: [locCandidate()] }),
    enrichCandidates: async () => { throw new Error('rights endpoint failed'); },
    fetchImage: async () => { fetched += 1; return { status: 'resolved', asset: {} }; }
  });
  assert.equal(result.status, 'error');
  assert.equal(result.stage, 'enrichment');
  assert.equal(fetched, 0);
});
