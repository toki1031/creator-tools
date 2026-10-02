import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolveExportProfile } from '../videoRenderer.js';

const source = fs.readFileSync(new URL('../videoRenderer.js', import.meta.url), 'utf8');
const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1';

// Keep legacy/manual iPhone projects on the proven 720-class workload.
test('ordinary iPhone export keeps the 720-class safe profile', () => {
  const profile = resolveExportProfile({ output:{ width:1080, height:1920 } }, { userAgent:iphone });
  assert.equal(profile.width,720);
  assert.equal(profile.height,1280);
  assert.equal(profile.iosSafeMode,true);
  assert.equal(profile.iosHdMode,false);
});

// The dedicated compact production render job no longer carries the full editor project,
// so it can honor the requested Shorts resolution while retaining the iPhone 30fps/low-bitrate path.
test('compact production render job can honor 1080x1920 on iPhone', () => {
  const profile = resolveExportProfile({
    __renderJob:true,
    autoProduction:{ mode:'production-request' },
    output:{ width:1080, height:1920 }
  }, { userAgent:iphone });
  assert.equal(profile.width,1080);
  assert.equal(profile.height,1920);
  assert.equal(profile.iosSafeMode,true);
  assert.equal(profile.iosHdMode,true);
});

test('manual compact render job remains capped on iPhone', () => {
  const profile = resolveExportProfile({
    __renderJob:true,
    output:{ width:1080, height:1920 }
  }, { userAgent:iphone });
  assert.equal(profile.width,720);
  assert.equal(profile.height,1280);
  assert.equal(profile.iosHdMode,false);
});

test('compact production HD never exceeds the 1080x1920 pixel budget', () => {
  const profile = resolveExportProfile({
    __renderJob:true,
    autoProduction:{ mode:'production-request' },
    output:{ width:2160, height:3840 }
  }, { userAgent:iphone });
  assert.ok(profile.width * profile.height <= 720 * 1280 + 4096);
  assert.equal(profile.iosHdMode,false);
});

test('iPhone HD path retains the existing 30fps and safe bitrate policy', () => {
  assert.match(source, /exportProfile\.iosSafeMode \? 30 : 60/);
  assert.match(source, /if \(iosSafeMode\) return 3_000_000/);
  assert.match(source, /iPhone compact HD mode/);
});
