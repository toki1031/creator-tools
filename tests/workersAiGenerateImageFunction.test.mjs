import test from 'node:test';
import assert from 'node:assert/strict';
import {onRequestPost} from '../functions/api/generate-image.js';

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
