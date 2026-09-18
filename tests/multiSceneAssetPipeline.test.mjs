import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequestRateLimiter } from '../requestRateLimiter.js';
import { runMultiSceneAssetPipeline } from '../multiSceneAssetPipeline.js';

test('rate limiter waits before exceeding the sliding-window limit', async () => {
  let clock = 0;
  const waits = [];
  const limiter = createRequestRateLimiter({
    maxRequests: 2,
    windowMs: 1000,
    now: () => clock,
    sleep: async ms => { waits.push(ms); clock += ms; }
  });
  await limiter();
  await limiter();
  await limiter();
  assert.deepEqual(waits, [1000]);
});

test('processes scenes sequentially in order and carries successful project updates forward', async () => {
  const input = { id: 'p1', scenes: [{ id: 'b', order: 2 }, { id: 'a', order: 1 }], mediaLibrary: [] };
  const before = structuredClone(input);
  const seen = [];
  const runScene = async (project, scene) => {
    seen.push([scene.id, project.mediaLibrary.length]);
    const next = structuredClone(project);
    next.mediaLibrary.push({ id: `asset-${scene.id}` });
    const target = next.scenes.find(item => item.id === scene.id);
    target.imageAssetId = `asset-${scene.id}`;
    return { status: 'applied', stage: 'complete', project: next, assetId: `asset-${scene.id}` };
  };
  const result = await runMultiSceneAssetPipeline(input, { runScene, searchCandidates: async () => [], waitForSearchSlot: async () => {} });
  assert.equal(result.status, 'complete');
  assert.deepEqual(seen, [['a', 0], ['b', 1]]);
  assert.equal(result.project.mediaLibrary.length, 2);
  assert.deepEqual(input, before);
});

test('stops on risk by default and keeps earlier successful changes', async () => {
  const input = { scenes: [{ id: 'a', order: 1 }, { id: 'b', order: 2 }, { id: 'c', order: 3 }], mediaLibrary: [] };
  const calls = [];
  const runScene = async (project, scene) => {
    calls.push(scene.id);
    if (scene.id === 'b') return { status: 'needs-review', stage: 'adoption', reason: 'rights review' };
    const next = structuredClone(project);
    next.mediaLibrary.push({ id: `asset-${scene.id}` });
    return { status: 'applied', stage: 'complete', project: next };
  };
  const result = await runMultiSceneAssetPipeline(input, { runScene, searchCandidates: async () => [], waitForSearchSlot: async () => {} });
  assert.equal(result.status, 'needs-review');
  assert.deepEqual(calls, ['a', 'b']);
  assert.equal(result.project.mediaLibrary.length, 1);
  assert.equal(result.stoppedSceneId, 'b');
});

test('can explicitly continue after a risky scene without treating it as success', async () => {
  const input = { scenes: [{ id: 'a', order: 1 }, { id: 'b', order: 2 }], mediaLibrary: [] };
  const runScene = async (project, scene) => {
    if (scene.id === 'a') return { status: 'blocked', stage: 'search', reason: 'none' };
    const next = structuredClone(project); next.mediaLibrary.push({ id: 'asset-b' });
    return { status: 'applied', stage: 'complete', project: next };
  };
  const result = await runMultiSceneAssetPipeline(input, { runScene, searchCandidates: async () => [], waitForSearchSlot: async () => {}, stopOnRisk: false });
  assert.equal(result.status, 'partial');
  assert.deepEqual(result.results.map(item => item.status), ['blocked', 'applied']);
  assert.equal(result.project.mediaLibrary.length, 1);
});

test('rate limiting wraps real scene search calls sequentially', async () => {
  const input = { scenes: [{ id: 'a', order: 1 }, { id: 'b', order: 2 }], mediaLibrary: [] };
  const events = [];
  const runScene = async (project, scene, options) => {
    await options.searchCandidates({ sceneId: scene.id });
    return { status: 'applied', stage: 'complete', project: structuredClone(project) };
  };
  const result = await runMultiSceneAssetPipeline(input, {
    runScene,
    waitForSearchSlot: async () => events.push('slot'),
    searchCandidates: async plan => { events.push(`search-${plan.sceneId}`); return []; }
  });
  assert.equal(result.status, 'complete');
  assert.deepEqual(events, ['slot', 'search-a', 'slot', 'search-b']);
});


test('shares one external request slot sequence between search and rights enrichment', async () => {
  const input = { scenes: [{ id: 'a', order: 1 }], mediaLibrary: [] };
  const events = [];
  const waitForExternalSlot = async () => events.push('slot');
  const runScene = async (project, scene, options) => {
    await options.searchCandidates({ sceneId: scene.id });
    await options.enrichmentOptions.waitForExternalSlot();
    events.push('rights-a');
    return { status: 'applied', stage: 'complete', project: structuredClone(project) };
  };
  const result = await runMultiSceneAssetPipeline(input, {
    runScene,
    waitForSearchSlot: waitForExternalSlot,
    searchCandidates: async () => { events.push('search-a'); return []; }
  });
  assert.equal(result.status, 'complete');
  assert.deepEqual(events, ['slot', 'search-a', 'slot', 'rights-a']);
});

test('supports an explicit shared external limiter while preserving legacy search limiter option', async () => {
  const input = { scenes: [{ id: 'a', order: 1 }], mediaLibrary: [] };
  const events = [];
  const runScene = async (project, scene, options) => {
    await options.searchCandidates({ sceneId: scene.id });
    await options.enrichmentOptions.waitForExternalSlot();
    return { status: 'applied', stage: 'complete', project: structuredClone(project) };
  };
  await runMultiSceneAssetPipeline(input, {
    runScene,
    waitForSearchSlot: async () => events.push('search-slot'),
    waitForExternalSlot: async () => events.push('external-slot'),
    searchCandidates: async () => []
  });
  assert.deepEqual(events, ['search-slot', 'external-slot']);
});
