import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerationStartController, projectExpectsVideoAudio } from '../videoGenerationStart.js';

test('シーン別ナレーションだけでも動画生成時にWeb Audioが必要と判定する', () => {
  assert.equal(projectExpectsVideoAudio({ output:{bgmEnabled:false}, scenes:[{narration:{audioData:'data:audio/wav;base64,AA=='}}] }), true);
  assert.equal(projectExpectsVideoAudio({ output:{bgmEnabled:false}, bgm:{audioData:'data:audio/wav;base64,AA=='}, scenes:[] }), false);
  assert.equal(projectExpectsVideoAudio({ output:{bgmEnabled:true}, bgm:{audioData:'data:audio/wav;base64,AA=='}, scenes:[] }), true);
});

test('アプリ内確認の承認操作でAudioContext生成とresumeを先に実行する', async () => {
  const order=[];
  class FakeAudioContext {
    constructor(){order.push('construct');this.state='running';}
    resume(){order.push('resume');return Promise.resolve();}
  }
  let payload=null;
  const controller=createGenerationStartController({
    expectsAudio:true,
    AudioContextClass:FakeAudioContext,
    onApprove:value=>{order.push('approve');payload=value;}
  });
  assert.equal(controller.approve(),true);
  assert.deepEqual(order,['construct','resume','approve']);
  assert.ok(payload.audioContext instanceof FakeAudioContext);
  assert.equal(await payload.audioResumeResult,null);
});

test('キャンセルではAudioContextを作らず生成承認もしない', () => {
  let constructed=0,approved=0,cancelled=0;
  class FakeAudioContext { constructor(){constructed++;} resume(){return Promise.resolve();} }
  const controller=createGenerationStartController({
    expectsAudio:true,
    AudioContextClass:FakeAudioContext,
    onApprove:()=>approved++,
    onCancel:()=>cancelled++
  });
  assert.equal(controller.cancel(),true);
  assert.equal(controller.approve(),false);
  assert.equal(constructed,0);
  assert.equal(approved,0);
  assert.equal(cancelled,1);
});

test('承認は二重実行されない', () => {
  let approved=0;
  const controller=createGenerationStartController({onApprove:()=>approved++});
  assert.equal(controller.approve(),true);
  assert.equal(controller.approve(),false);
  assert.equal(controller.cancel(),false);
  assert.equal(approved,1);
});
