import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeProductionTiming, productionEfficiencySummary } from '../productionTimingSummary.js';

test('summarizes stage timing without project content', () => {
  const summary=summarizeProductionTiming([{stage:'scenes',durationMs:1000,text:'secret'},{stage:'scenes',durationMs:2000},{stage:'output',durationMs:500}]);
  assert.equal(summary.totalDurationMs,3500);
  assert.equal(summary.stages.find(x=>x.stage==='scenes').durationMs,3000);
  assert.equal(JSON.stringify(summary).includes('secret'),false);
});

test('efficiency summary is compact and excludes media bodies', () => {
  const project={id:'p',genre:'great-person',platform:'youtube-shorts',scenes:[{text:'secret',imageData:'data:image/png;base64,AAA'}],productionTimingLog:[{stage:'scenes',durationMs:1000}],learning:{decisions:[{}]}};
  const summary=productionEfficiencySummary(project);
  const json=JSON.stringify(summary);
  assert.equal(summary.sceneCount,1);
  assert.equal(summary.decisionCount,1);
  assert.equal(json.includes('secret'),false);
  assert.equal(json.includes('base64'),false);
});
