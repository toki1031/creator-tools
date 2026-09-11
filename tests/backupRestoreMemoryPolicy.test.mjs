import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../projectBackup.js', import.meta.url), 'utf8');

test('backup restore avoids a second full deep clone after normalization', () => {
  const start = source.indexOf('export function createRestoredProject');
  const end = source.indexOf('export function createProjectBackupPayload', start);
  assert.ok(start >= 0 && end > start);
  const restoredSection = source.slice(start, end);
  assert.match(restoredSection, /const project = \{ \.\.\.normalizedProject \};/);
  assert.doesNotMatch(restoredSection, /safeClone\(normalizedProject\)/);
});

test('already-sanitized scene and settings branches are shallow-copied during normalization', () => {
  assert.match(source, /const scene = \{ \.\.\.item \};/);
  assert.match(source, /const bgmSource = isRecord\(source\.bgm\) \? \{ \.\.\.source\.bgm \} : \{\};/);
  assert.match(source, /const subtitleSource = isRecord\(source\.subtitleStyle\) \? \{ \.\.\.source\.subtitleStyle \} : \{\};/);
  assert.match(source, /const outputSource = isRecord\(source\.output\) \? \{ \.\.\.source\.output \} : \{\};/);
  assert.match(source, /const publishSource = isRecord\(source\.publish\) \? \{ \.\.\.source\.publish \} : \{\};/);
});
