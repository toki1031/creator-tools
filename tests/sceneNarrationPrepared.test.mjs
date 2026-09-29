import test from 'node:test';
import assert from 'node:assert/strict';
import { validatePreparedAudioForExport } from '../videoRenderer.js';

test('accepts lazy MediaRef Scene narration as prepared without embedding audio buffers',()=>{
 const project={output:{},scenes:[{narration:{mediaRef:{id:'audio-1'},durationSec:2}}]};
 const prepared={sceneNarrations:[{available:true,lazy:true}]};
 assert.deepEqual(validatePreparedAudioForExport(project,prepared),[]);
});

test('blocks export when a declared Scene narration is not available',()=>{
 const project={output:{},scenes:[{narration:{mediaRef:{id:'audio-missing'},durationSec:2}}]};
 const errors=validatePreparedAudioForExport(project,{sceneNarrations:[null]});
 assert.equal(errors.length,1); assert.match(errors[0],/シーン1/);
});
