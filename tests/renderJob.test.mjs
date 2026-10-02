import assert from 'node:assert/strict';
import { createRenderJob } from '../renderJob.js';

const image = 'data:image/png;base64,AAAA';
const audio = 'data:audio/wav;base64,BBBB';
const project = {
  id: 'p1',
  scenes: [{
    id: 's1', durationSec: 4, motion: 'zoom-in', transition: 'fade',
    text: '本文', subtitleText: '字幕', subtitleEnabled: true,
    subtitlePosition: 'top', subtitlePositionOffsetPercent: 6,
    imageAssetId: 'asset-1',
    narration: { audioData: audio, mimeType: 'audio/wav', durationSec: 3.5 },
    smartReframe: { focusX: .2, focusY: .3, zoom: 1.5 },
    aiSuggestion: { large: 'unused' }
  }],
  mediaLibrary: [
    { id: 'asset-1', type: 'image', data: image },
    { id: 'asset-unused', type: 'image', data: 'data:image/png;base64,UNUSED' }
  ],
  output: { width: 1080, height: 1920, fps: 30, subtitles: true, bgmEnabled: true },
  bgm: { audioData: audio, volume: .2, loop: true, ducking: true },
  narration: { audioData: 'data:audio/wav;base64,LEGACY', volume: 1 },
  subtitleStyle: { fontSize: 54 },
  learning: { decisions: Array(100).fill({ large: 'ignored' }) },
  publish: { title: 'ignored' }
};

const job = createRenderJob(project);
assert.equal(job.__renderJob, true);
assert.equal(job.scenes.length, 1);
assert.equal(job.scenes[0].imageData, image);
assert.equal(job.scenes[0].narration.audioData, audio);
assert.equal(job.scenes[0].subtitlePosition, 'top');
assert.equal(job.scenes[0].subtitlePositionOffsetPercent, 6);
assert.equal(job.scenes[0].smartReframe, undefined);
assert.equal(job.scenes[0].aiSuggestion, undefined);
assert.deepEqual(job.mediaLibrary, []);
assert.equal(job.learning, undefined);
assert.equal(job.publish, undefined);
assert.equal(job.narration.audioData, undefined, 'legacy whole-project narration must be omitted when scene narration exists');
assert.equal(job.narration.volume, 1);


{
  const mediaProject={
    id:'p-media',
    autoProduction:{mode:'production-request'},
    scenes:[{
      id:'scene-1',
      durationSec:5,
      subtitleText:'字幕',
      imageAssetId:'generated-1',
      narration:{
        mediaRef:{id:'audio-1',kind:'audio',mimeType:'audio/wav',sizeBytes:123},
        mimeType:'audio/wav',
        durationSec:4.8
      }
    }],
    mediaLibrary:[
      {id:'generated-1',type:'image',data:'',mediaRef:{id:'generated-1',kind:'image',mimeType:'image/jpeg',sizeBytes:456}},
      {id:'unused',type:'image',data:'data:image/png;base64,UNUSED'}
    ],
    output:{width:1080,height:1920,fps:30,subtitles:true,bgmEnabled:true},
    bgm:{
      source:'procedural',
      volume:.08,
      ducking:true,
      loop:true,
      fadeInSec:1.5,
      fadeOutSec:2.5,
      procedural:{preset:'calm-documentary',libraryVersion:1,selection:'auto'}
    },
    narration:{volume:1},
    subtitleStyle:{fontSize:54},
    learning:{decisions:[{large:'ignore'}]}
  };
  const mediaJob=createRenderJob(mediaProject);
  assert.equal(mediaJob.autoProduction.mode,'production-request');
  assert.equal(mediaJob.scenes[0].imageData,'');
  assert.equal(mediaJob.scenes[0].imageAssetId,'generated-1');
  assert.equal(mediaJob.scenes[0].narration.audioData,'');
  assert.equal(mediaJob.scenes[0].narration.mediaRef.id,'audio-1');
  assert.equal(mediaJob.mediaLibrary.length,1);
  assert.equal(mediaJob.mediaLibrary[0].id,'generated-1');
  assert.equal(mediaJob.mediaLibrary[0].mediaRef.id,'generated-1');
  assert.equal(mediaJob.bgm.source,'procedural');
  assert.equal(mediaJob.bgm.procedural.preset,'calm-documentary');
  assert.equal(mediaJob.learning,undefined);
}
