import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateBgmToOutputHandoff } from '../bgmToOutputHandoff.js';

function readyProject(){
  return {
    autoProduction:{mode:'production-request'},
    output:{subtitles:true,bgmEnabled:true},
    subtitleStyle:{enabled:true},
    bgm:{source:'procedural',procedural:{preset:'calm-documentary'}},
    scenes:[{
      id:'s1',
      durationSec:3,
      imageAssetId:'img-1',
      narration:{mediaRef:{id:'narr-1'}},
      subtitleEnabled:true,
      subtitleText:'字幕'
    }]
  };
}

test('continues when auto production image, narration, subtitles, BGM and duration are ready',()=>{
  assert.equal(evaluateBgmToOutputHandoff(readyProject()).canContinue,true);
});

test('blocks when Scene image or narration is missing',()=>{
  const imageMissing=readyProject(); delete imageMissing.scenes[0].imageAssetId;
  assert.match(evaluateBgmToOutputHandoff(imageMissing).reason,/画像未登録/);
  const narrationMissing=readyProject(); delete narrationMissing.scenes[0].narration;
  assert.match(evaluateBgmToOutputHandoff(narrationMissing).reason,/ナレーション未生成/);
});

test('blocks invalid Scene duration',()=>{
  const project=readyProject(); project.scenes[0].durationSec=0;
  assert.match(evaluateBgmToOutputHandoff(project).reason,/Scene尺が不正/);
});

test('blocks missing active subtitles but allows globally disabled subtitles',()=>{
  const missing=readyProject(); missing.scenes[0].subtitleText='';
  assert.match(evaluateBgmToOutputHandoff(missing).reason,/字幕未設定/);
  const disabled=readyProject(); disabled.output.subtitles=false; disabled.scenes[0].subtitleText='';
  assert.equal(evaluateBgmToOutputHandoff(disabled).canContinue,true);
});

test('blocks enabled missing BGM but accepts explicit no-BGM',()=>{
  const missing=readyProject(); missing.bgm={source:'upload',audioData:''};
  assert.match(evaluateBgmToOutputHandoff(missing).reason,/BGM/);
  const none=readyProject(); none.bgm={source:'none'};
  assert.equal(evaluateBgmToOutputHandoff(none).canContinue,true);
});

test('manual projects never use the automatic BGM-to-output handoff',()=>{
  const project=readyProject(); delete project.autoProduction;
  const result=evaluateBgmToOutputHandoff(project);
  assert.equal(result.canContinue,false);
  assert.match(result.reason,/自動制作/);
});
