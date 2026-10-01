import test from 'node:test';
import assert from 'node:assert/strict';
import { hasReadyProjectBgm, hasReadySceneNarration, isProjectBgmEnabled } from '../productionReadiness.js';

test('Scene narration is ready with either embedded audio or MediaRef',()=>{
  assert.equal(hasReadySceneNarration({narration:{audioData:'data:audio/wav;base64,AA=='}}),true);
  assert.equal(hasReadySceneNarration({narration:{mediaRef:{id:'audio-1'}}}),true);
  assert.equal(hasReadySceneNarration({narration:{mediaRef:{id:''}}}),false);
  assert.equal(hasReadySceneNarration({}),false);
});

test('modern output bgmEnabled takes priority over legacy bgm.enabled',()=>{
  assert.equal(isProjectBgmEnabled({output:{bgmEnabled:true},bgm:{enabled:false,source:'procedural'}}),true);
  assert.equal(isProjectBgmEnabled({output:{bgmEnabled:false},bgm:{enabled:true,source:'upload'}}),false);
  assert.equal(isProjectBgmEnabled({bgm:{enabled:true,source:'upload'}}),true);
  assert.equal(isProjectBgmEnabled({bgm:{enabled:false,source:'upload'}}),false);
});

test('Creator OS standard procedural BGM is ready without audioData',()=>{
  const project={
    output:{bgmEnabled:true},
    bgm:{source:'procedural',procedural:{preset:'calm-documentary'}}
  };
  assert.equal(hasReadyProjectBgm(project),true);
});

test('uploaded BGM remains ready and enabled missing audio remains blocked',()=>{
  assert.equal(hasReadyProjectBgm({output:{bgmEnabled:true},bgm:{source:'upload',audioData:'data:audio/wav;base64,AA=='}}),true);
  assert.equal(hasReadyProjectBgm({output:{bgmEnabled:true},bgm:{source:'upload',audioData:''}}),false);
});

test('disabled or explicit no-BGM project is ready',()=>{
  assert.equal(hasReadyProjectBgm({output:{bgmEnabled:false},bgm:{source:'upload'}}),true);
  assert.equal(hasReadyProjectBgm({output:{bgmEnabled:true},bgm:{source:'none'}}),true);
});
