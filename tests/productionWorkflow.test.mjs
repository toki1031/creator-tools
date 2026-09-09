import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionPreset, applyProductionPreset } from '../productionPreset.js';
import { inspectProductionProject } from '../productionPreflight.js';
import { startProductionStage, finishProductionStage, appendProductionTiming } from '../productionTiming.js';

test('preset copies reusable settings without embedding BGM audio', () => {
  const project = { platform:'youtube-shorts', aspectRatio:'9:16', subtitleStyle:{fontSize:44}, bgm:{volume:0.2,audioData:'huge'} };
  const preset = createProductionPreset(project, '偉人Shorts');
  assert.equal(preset.settings.bgm.audioData, undefined);
  const applied = applyProductionPreset({ id:'p' }, preset);
  assert.equal(applied.id, 'p');
  assert.equal(applied.aspectRatio, '9:16');
});

test('preflight reports missing scene media without mutating project', () => {
  const project = { scenes:[{text:'hello',durationSec:3,subtitleText:'hello'}] };
  const result = inspectProductionProject(project);
  assert.equal(result.ok, true);
  assert.ok(result.issues.some(issue => issue.code === 'scene-image-missing'));
  assert.ok(result.issues.some(issue => issue.code === 'narration-missing'));
});

test('timing log stores bounded stage durations', () => {
  const started = startProductionStage('narration', 1000);
  const finished = finishProductionStage(started, 2500);
  assert.equal(finished.durationMs, 1500);
  const project = appendProductionTiming({}, finished, 10);
  assert.equal(project.productionTimingLog[0].stage, 'narration');
});
