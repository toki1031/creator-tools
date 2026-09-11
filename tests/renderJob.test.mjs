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
