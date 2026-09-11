import assert from 'node:assert/strict';
import fs from 'node:fs';

const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');

assert.match(main, /import \{ createRenderJob \} from ["']\.\/renderJob\.js["'];/);
assert.match(main, /const renderJob=createRenderJob\(project\);/);
assert.match(main, /prepareVideoProject\(renderJob,/);
assert.match(main, /exportProjectVideo\(renderJob,assets,canvas,/);
assert.match(main, /prepared=null;\s*preparedPromise=null;/);
