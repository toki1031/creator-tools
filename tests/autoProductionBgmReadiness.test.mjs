import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVideoProject } from '../videoRenderer.js';
import { createProceduralBgmSettings } from '../proceduralBgm.js';

test('production-request accepts procedural BGM without an uploaded audio file',()=>{
  const project={
    id:'p1',
    autoProduction:{mode:'production-request'},
    output:{bgmEnabled:true,subtitles:false},
    bgm:createProceduralBgmSettings(['静かなドキュメンタリーBGM']),
    scenes:[{
      id:'scene-1',
      durationSec:5,
      imageData:'data:image/png;base64,AA==',
      narration:{mediaRef:{id:'n1'}}
    }]
  };
  const result=validateVideoProject(project);
  assert.ok(!result.errors.some(message=>message.includes('BGM')));
  assert.ok(!result.warnings.some(message=>message.includes('音源ファイル')));
  assert.equal(result.sceneNarrationCount,1);
});

test('production-request still blocks an ordinary enabled BGM with no audio file',()=>{
  const project={
    id:'p2',
    autoProduction:{mode:'production-request'},
    output:{bgmEnabled:true,subtitles:false},
    bgm:{source:'free',title:'missing',audioData:''},
    scenes:[{
      id:'scene-1',
      durationSec:5,
      imageData:'data:image/png;base64,AA==',
      narration:{mediaRef:{id:'n1'}}
    }]
  };
  const result=validateVideoProject(project);
  assert.ok(result.errors.some(message=>message.includes('BGM')));
});
