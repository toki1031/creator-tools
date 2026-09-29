import test from 'node:test';
import assert from 'node:assert/strict';
import { validateVideoProject } from '../videoRenderer.js';

const scene=(extra={})=>({id:'s',durationSec:2,text:'x',subtitleText:'x',...extra});

test('production-request reports exact missing image and narration scenes',()=>{
 const p={autoProduction:{mode:'production-request'},output:{subtitles:true,bgmEnabled:false},bgm:{source:'none'},scenes:[scene({id:'1'}),scene({id:'2',imageData:'data:image/png;base64,AA',narration:{mediaRef:{id:'a'},durationSec:2}})]};
 const v=validateVideoProject(p);
 assert.ok(v.errors.some(x=>/画像未登録：シーン1/.test(x)));
 assert.ok(v.errors.some(x=>/ナレーション未生成：シーン1/.test(x)));
});

test('production-request blocks enabled BGM without an audio file',()=>{
 const p={autoProduction:{mode:'production-request'},output:{bgmEnabled:true},bgm:{source:'free'},scenes:[scene({imageData:'data:image/png;base64,AA',narration:{mediaRef:{id:'a'},durationSec:2}})]};
 assert.ok(validateVideoProject(p).errors.some(x=>/BGM.*未登録/.test(x)));
});

test('manual projects keep legacy warning-only behavior for missing media',()=>{
 const p={output:{bgmEnabled:true},bgm:{source:'free'},scenes:[scene()]};
 const v=validateVideoProject(p); assert.equal(v.errors.length,0); assert.ok(v.warnings.length>0);
});
