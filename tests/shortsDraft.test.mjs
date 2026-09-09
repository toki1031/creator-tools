import test from 'node:test';
import assert from 'node:assert/strict';
import { createShortsDraft, saveShortsDraft, listShortsDrafts } from '../shortsDraft.js';

const project = () => ({
  id: 'p1',
  updatedAt: '2026-09-09T00:00:00.000Z',
  mediaLibrary: [{ id:'asset-1', type:'image', data:'data:image/png;base64,AAAA' }],
  scenes: [
    { id:'s1', text:'one', durationSec:10, imageAssetId:'asset-1' },
    { id:'s2', text:'two', durationSec:12, imageAssetId:'asset-1' },
    { id:'s3', text:'three', durationSec:14, imageAssetId:'asset-1' }
  ]
});

const candidate = { startIndex:0, endIndex:1, durationSec:22, score:84, reasons:['good'], previewText:'one two' };

test('creates lightweight draft metadata without media payloads', () => {
  const p = project();
  const draft = createShortsDraft(p, candidate, { now:()=> '2026-09-09T01:00:00.000Z', createId:()=> 'draft-1' });
  assert.equal(draft.id, 'draft-1');
  assert.deepEqual(draft.sceneIds, ['s1','s2']);
  assert.equal(draft.durationSec, 22);
  assert.equal('mediaLibrary' in draft, false);
  assert.equal('scenes' in draft, false);
  assert.equal(JSON.stringify(draft).includes('data:image/'), false);
});

test('saving draft leaves source scenes and media unchanged', () => {
  const p = project();
  const beforeScenes = structuredClone(p.scenes);
  const beforeMedia = structuredClone(p.mediaLibrary);
  const result = saveShortsDraft(p, candidate, { createId:()=> 'draft-1' });
  assert.equal(result.created, true);
  assert.deepEqual(p.scenes, beforeScenes);
  assert.deepEqual(p.mediaLibrary, beforeMedia);
  assert.equal(p.shortsDrafts.length, 1);
});

test('same scene range is not duplicated', () => {
  const p = project();
  saveShortsDraft(p, candidate, { createId:()=> 'draft-1' });
  const second = saveShortsDraft(p, candidate, { createId:()=> 'draft-2' });
  assert.equal(second.created, false);
  assert.equal(p.shortsDrafts.length, 1);
});

test('lists newest drafts first', () => {
  const p = project();
  p.shortsDrafts = [
    { id:'a', createdAt:'2026-09-09T01:00:00.000Z' },
    { id:'b', createdAt:'2026-09-09T02:00:00.000Z' }
  ];
  assert.deepEqual(listShortsDrafts(p).map(x => x.id), ['b','a']);
});
