import test from 'node:test';
import assert from 'node:assert/strict';
import { readProjectSnapshots, saveProjectSnapshot, removeProjectSnapshot, MAX_SNAPSHOTS } from '../projectSnapshotStore.js';

function memoryStorage() {
  const map = new Map();
  return { getItem:k=>map.has(k)?map.get(k):null, setItem:(k,v)=>map.set(k,String(v)) };
}

const snap = (projectId, n) => ({version:1,projectId,label:`s${n}`,createdAt:`2026-09-09T12:00:0${n}Z`,state:{scenes:[]}});

test('keeps only the latest bounded snapshots per project', () => {
  const storage = memoryStorage();
  for (let i=0;i<MAX_SNAPSHOTS+2;i++) saveProjectSnapshot(snap('p1',i), storage);
  const list = readProjectSnapshots('p1', storage);
  assert.equal(list.length, MAX_SNAPSHOTS);
  assert.equal(list[0].label, `s${MAX_SNAPSHOTS+1}`);
});

test('isolates projects and removes only the selected snapshot', () => {
  const storage = memoryStorage();
  saveProjectSnapshot(snap('p1',1), storage);
  saveProjectSnapshot(snap('p1',2), storage);
  saveProjectSnapshot(snap('p2',1), storage);
  removeProjectSnapshot('p1', snap('p1',2).createdAt, storage);
  assert.deepEqual(readProjectSnapshots('p1',storage).map(x=>x.label), ['s1']);
  assert.deepEqual(readProjectSnapshots('p2',storage).map(x=>x.label), ['s1']);
});

test('malformed storage is treated as empty', () => {
  const storage = {getItem:()=>'{bad json',setItem:()=>{}};
  assert.deepEqual(readProjectSnapshots('p1',storage), []);
});
