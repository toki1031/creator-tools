import assert from 'node:assert/strict';
import fs from 'node:fs';

const boot = fs.readFileSync(new URL('../bootLoader.js', import.meta.url), 'utf8');
const handoff = fs.readFileSync(new URL('../dedicatedRenderHandoff.js', import.meta.url), 'utf8');
const runner = fs.readFileSync(new URL('../renderRunner.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../render-runner.html', import.meta.url), 'utf8');

assert.match(boot, /dedicatedRenderHandoff\.js/, 'boot loader should install the iPhone render handoff');
assert.match(handoff, /stopImmediatePropagation\(\)/, 'handoff must stop the editor renderer on iPhone');
assert.match(handoff, /render-runner\.html\?project=/, 'handoff must leave the editor page before render preparation');
assert.match(runner, /createRenderJob\(project\)/, 'prepare stage should compact the project');
assert.match(runner, /location\.replace\('\.\/render-runner\.html\?stage=generate'\)/, 'prepare stage must reload to release the full project before encoding');
assert.match(runner, /exportProjectVideo\(job, prepared, canvas/, 'generation must use the compact render job, not the full project');
assert.match(html, /renderRunnerStart/, 'dedicated page should require an explicit generation tap for Web Audio');
