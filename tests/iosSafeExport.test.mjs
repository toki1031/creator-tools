import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveExportProfile } from '../videoRenderer.js';
import fs from 'node:fs';
const source = fs.readFileSync(new URL('../videoRenderer.js', import.meta.url), 'utf8');
const iphone='Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1';

test('ordinary iPhone 1080 request stays on 720-class safe profile',()=>{
  const profile=resolveExportProfile({output:{width:1080,height:1920}},{userAgent:iphone});
  assert.deepEqual([profile.width,profile.height],[720,1280]);
  assert.equal(profile.iosSafeMode,true);
});

test('dedicated production-request Render Job may honor 1080x1920 on iPhone',()=>{
  const profile=resolveExportProfile({
    __renderJob:true,
    autoProduction:{mode:'production-request'},
    output:{width:1080,height:1920}
  },{userAgent:iphone});
  assert.deepEqual([profile.width,profile.height],[1080,1920]);
  assert.equal(profile.iosSafeMode,true);
});

test('manual compact Render Job remains 720-class on iPhone',()=>{
  const profile=resolveExportProfile({__renderJob:true,output:{width:1080,height:1920}},{userAgent:iphone});
  assert.deepEqual([profile.width,profile.height],[720,1280]);
  assert.equal(profile.iosSafeMode,true);
});

test('oversized production request remains capped by iPhone safe profile',()=>{
  const profile=resolveExportProfile({
    __renderJob:true,
    autoProduction:{mode:'production-request'},
    output:{width:2160,height:3840}
  },{userAgent:iphone});
  assert.ok(profile.width*profile.height <= 720*1280+4);
  assert.equal(profile.iosSafeMode,true);
});

test('production-request 1080p keeps iPhone encoding safety enabled',()=>{
  const profile=resolveExportProfile({
    __renderJob:true,
    autoProduction:{mode:'production-request'},
    output:{width:1080,height:1920,fps:60}
  },{userAgent:iphone});
  assert.deepEqual([profile.width,profile.height],[1080,1920]);
  assert.equal(profile.iosSafeMode,true);
});

test('iPhone safety still caps fps and safe-mode bitrate',()=>{
  assert.match(source,/exportProfile\.iosSafeMode \? 30 : 60/);
  assert.match(source,/if \(iosSafeMode\) return 3_000_000/);
});
