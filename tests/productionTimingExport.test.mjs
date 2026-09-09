import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductionTimingReport } from '../productionTimingExport.js';

test('timing report contains summary rather than project content', () => {
  const report = createProductionTimingReport({id:'p',genre:'great-person',script:'secret',productionTimingLog:[{stage:'scenes',durationMs:1000}]});
  assert.equal(report.entryCount, 1);
  assert.equal(report.script, undefined);
  assert.equal(report.stages[0].stage, 'scenes');
});
