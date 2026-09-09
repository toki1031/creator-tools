import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectSnapshot, restoreProjectSnapshot, estimateProjectSnapshotSize } from '../projectSnapshot.js';

const project = () => ({
  id:'p1', script:'新しい台本', mediaLibrary:[{id:'img1',type:'image',data:'data:image/png;base64,' + 'A'.repeat(20000)}],
  scenes:[{id:'s1',text:'新しいScene',subtitleText:'新字幕',imageAssetId:'img1',durationSec:8,narration:{audioData:'data:audio/wav;base64,' + 'B'.repeat(20000)}}],
  bgm:{enabled:true,volume:.3,loop:true,audioData:'data:audio/mp3;base64,' + 'C'.repeat(20000),audioAssetId:'audio-current',title:'現在の曲',license:'CC0'}
});

test('snapshot stays lightweight and excludes media payloads and BGM identity', () => {
  const source = project();
  const snap = createProjectSnapshot(source, { now:()=> '2026-09-09T12:00:00Z' });
  const json = JSON.stringify(snap);
  assert.equal(json.includes('data:image'), false);
  assert.equal(json.includes('data:audio'), false);
  assert.equal(json.includes('mediaLibrary'), false);
  assert.equal(json.includes('audioAssetId'), false);
  assert.equal(json.includes('現在の曲'), false);
  assert.ok(estimateProjectSnapshotSize(snap) < JSON.stringify(source).length / 10);
});

test('restore reverts editable state but preserves current heavy media and audio', () => {
  const original = project();
  original.script = '保存時の台本';
  original.scenes[0].text = '保存時Scene';
  original.bgm.volume = .2;
  const snap = createProjectSnapshot(original);

  const current = project();
  current.script = '編集中の台本';
  current.scenes[0].text = '編集中Scene';
  current.scenes[0].narration.audioData = 'data:audio/wav;base64,CURRENT';
  current.bgm.volume = .9;
  current.bgm.audioAssetId = 'audio-new';
  current.bgm.audioData = 'data:audio/mp3;base64,NEW';
  current.bgm.title = '新しい曲';

  const restored = restoreProjectSnapshot(current, snap);
  assert.equal(restored.script, '保存時の台本');
  assert.equal(restored.scenes[0].text, '保存時Scene');
  assert.equal(restored.scenes[0].narration.audioData, 'data:audio/wav;base64,CURRENT');
  assert.equal(restored.mediaLibrary[0].data.startsWith('data:image'), true);
  assert.equal(restored.bgm.volume, .2);
  assert.equal(restored.bgm.audioAssetId, 'audio-new');
  assert.equal(restored.bgm.audioData, 'data:audio/mp3;base64,NEW');
  assert.equal(restored.bgm.title, '新しい曲');
});

test('restore rejects another project or malformed snapshot', () => {
  const snap = createProjectSnapshot(project());
  assert.throws(() => restoreProjectSnapshot({...project(),id:'p2'}, snap));
  assert.throws(() => restoreProjectSnapshot(project(), {}));
});
