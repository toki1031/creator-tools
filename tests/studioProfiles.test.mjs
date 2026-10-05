import test from 'node:test';
import assert from 'node:assert/strict';
import { getStudioProfile, studioProfileIdForProject } from '../studioProfiles.js';
import { buildFreeImagePrompt } from '../freeImageGenerationProvider.js';

test('selects Studio profile from persisted selection with genre fallback',()=>{
  assert.equal(studioProfileIdForProject({studioProfileId:'education',genre:'great-person'}),'education');
  assert.equal(studioProfileIdForProject({genre:'fortune'}),'fortune');
  assert.equal(studioProfileIdForProject({genre:'unknown'}),'sns');
});

test('Studio changes visual direction without replacing scene intent',()=>{
  const req={requestedType:'modern-visual',queryHint:'parent and baby playing safely on a floor'};
  const edu=buildFreeImagePrompt(req,{studioProfile:getStudioProfile('education')});
  const great=buildFreeImagePrompt(req,{studioProfile:getStudioProfile('great-person')});
  assert.match(edu,/warm educational editorial/i);
  assert.match(great,/historical documentary/i);
  assert.match(edu,/parent and baby playing safely on a floor/i);
  assert.match(great,/parent and baby playing safely on a floor/i);
  assert.notEqual(edu,great);
});

test('historical reconstruction keeps period safety while accepting Studio profile',()=>{
  const prompt=buildFreeImagePrompt({requestedType:'ai-reconstruction',queryHint:'19th-century hospital ward'},{studioProfile:getStudioProfile('great-person')});
  assert.match(prompt,/STRICT PERIOD RECONSTRUCTION/);
  assert.match(prompt,/period-authentic/i);
  assert.match(prompt,/ANACHRONISMS TO AVOID/);
});
