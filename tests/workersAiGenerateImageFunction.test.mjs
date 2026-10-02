import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestGet,onRequestPost} from '../functions/api/generate-image.js';

const request=(body)=>new Request('https://example.test/api/generate-image',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});

test('FLUX base64 is returned as JPEG data URI',async()=>{
  const env={AI:{run:async()=>({image:'ZmFrZWpwZWc='})}};
  const res=await onRequestPost({request:request({requestedType:'modern-visual',prompt:'modern meeting'}),env});
  assert.equal(res.status,200);
  const body=await res.json();
  assert.equal(body.data,'data:image/jpeg;base64,ZmFrZWpwZWc=');
  assert.equal(body.generated,true);
});

test('historical source never calls generation',async()=>{
  let called=false;
  const env={AI:{run:async()=>{called=true;return {image:'x'}}}};
  const res=await onRequestPost({request:request({requestedType:'historical-source',prompt:'archive'}),env});
  assert.equal(res.status,400);
  assert.equal(called,false);
});

test('server never sends a prompt longer than the FLUX 2048 character limit',async()=>{
  let seen='';
  const env={AI:{run:async(_model,input)=>{seen=input.prompt;return {image:'ZmFrZWpwZWc='}}}};
  const res=await onRequestPost({request:request({requestedType:'modern-visual',prompt:'あ'.repeat(3000)}),env});
  assert.equal(res.status,200);
  assert.equal(Array.from(seen).length,2048);
});

test('GET diagnostic reports binding availability without invoking AI',async()=>{let called=false;const env={AI:{run:async()=>{called=true}}};const res=await onRequestGet({request:new Request('https://preview.example/api/generate-image'),env});assert.equal(res.status,200);const body=await res.json();assert.deepEqual(body,{endpoint:'creator-os-generate-image',diagnosticVersion:1,aiBindingAvailable:true,host:'preview.example'});assert.equal(called,false)});
test('GET diagnostic safely reports missing binding',async()=>{const res=await onRequestGet({request:new Request('https://production.example/api/generate-image'),env:{}});const body=await res.json();assert.equal(body.aiBindingAvailable,false);assert.equal(body.endpoint,'creator-os-generate-image')});
