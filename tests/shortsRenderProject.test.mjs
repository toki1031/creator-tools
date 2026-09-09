import assert from 'node:assert/strict';
import test from 'node:test';
import { createShortsRenderProject, summarizeShortsRenderProject } from '../shortsRenderProject.js';

function projectFixture() {
  return {
    id:'p1', title:'Long', updatedAt:'2026-09-09T00:00:00.000Z',
    mediaLibrary:[{id:'asset-1',type:'image',data:'data:image/png;base64,AAA'}],
    narration:{audioData:'data:audio/wav;base64,WHOLE',fileName:'whole.wav',mimeType:'audio/wav',volume:1},
    output:{width:720,height:1280,fps:30,subtitles:true},
    subtitleStyle:{enabled:true},
    scenes:[
      {id:'s1',text:'one',durationSec:10,imageAssetId:'asset-1'},
      {id:'s2',text:'two',durationSec:20,imageAssetId:'asset-1',narration:{audioData:'data:audio/wav;base64,TWO'}},
      {id:'s3',text:'three',durationSec:15,imageAssetId:'asset-1'}
    ],
    shortsDrafts:[{id:'d1',title:'Pick',sceneIds:['s3','s2'],targetDurationSec:40,durationSec:35}]
  };
}

test('builds 9:16 runtime project in draft order without duplicating persisted media', () => {
  const source = projectFixture();
  const render = createShortsRenderProject(source, 'd1');
  assert.deepEqual(render.scenes.map(scene => scene.id), ['s3','s2']);
  assert.equal(render.output.width, 1080);
  assert.equal(render.output.height, 1920);
  assert.equal(render.aspectRatio, '9:16');
  assert.equal(render.mediaLibrary, source.mediaLibrary);
  assert.equal(source.scenes[0].id, 's1');
  assert.deepEqual(source.shortsDrafts[0].sceneIds, ['s3','s2']);
});

test('suppresses unsafe whole-project narration but keeps scene narration', () => {
  const render = createShortsRenderProject(projectFixture(), 'd1');
  assert.equal(render.narration.audioData, '');
  assert.equal(render.shortsRuntime.suppressedWholeNarration, true);
  assert.equal(render.scenes[1].narration.audioData, 'data:audio/wav;base64,TWO');
  const summary = summarizeShortsRenderProject(render);
  assert.equal(summary.sceneNarrationCount, 1);
  assert.equal(summary.durationSec, 35);
});

test('throws for missing draft', () => {
  assert.throws(() => createShortsRenderProject(projectFixture(), 'missing'), /Shorts案/);
});
