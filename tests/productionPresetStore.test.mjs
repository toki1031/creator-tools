import test from 'node:test';
import assert from 'node:assert/strict';
import { readProductionPresets, upsertProductionPreset, removeProductionPreset, PRESET_LIST_KEY, LEGACY_PRESET_KEY } from '../productionPresetStore.js';

function memoryStorage(seed={}){
  const map=new Map(Object.entries(seed));
  return {getItem:key=>map.has(key)?map.get(key):null,setItem:(key,value)=>map.set(key,String(value)),removeItem:key=>map.delete(key)};
}

test('migrates legacy single preset into readable list',()=>{
  const storage=memoryStorage({[LEGACY_PRESET_KEY]:JSON.stringify({name:'legacy',settings:{}})});
  assert.equal(readProductionPresets(storage)[0].name,'legacy');
});

test('stores multiple named presets and replaces same name',()=>{
  const storage=memoryStorage();
  upsertProductionPreset({name:'A',settings:{platform:'a'}},storage);
  upsertProductionPreset({name:'B',settings:{platform:'b'}},storage);
  upsertProductionPreset({name:'A',settings:{platform:'new'}},storage);
  const list=readProductionPresets(storage);
  assert.equal(list.length,2);
  assert.equal(list.find(x=>x.name==='A').settings.platform,'new');
  assert.ok(storage.getItem(PRESET_LIST_KEY));
});

test('removes preset without touching others',()=>{
  const storage=memoryStorage();
  upsertProductionPreset({name:'A',settings:{}},storage);
  upsertProductionPreset({name:'B',settings:{}},storage);
  removeProductionPreset('A',storage);
  assert.deepEqual(readProductionPresets(storage).map(x=>x.name),['B']);
});
