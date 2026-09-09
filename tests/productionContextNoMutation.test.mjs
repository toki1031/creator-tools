import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionContext } from '../productionContext.js';
test('production context leaves project unchanged', () => { const p={scenes:[{text:'x',durationSec:2}]}; const before=JSON.stringify(p); buildProductionContext(p); assert.equal(JSON.stringify(p),before); });
