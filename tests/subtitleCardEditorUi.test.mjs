import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../subtitleCardEditorUi.js', import.meta.url), 'utf8');
const boot = fs.readFileSync(new URL('../bootLoader.js', import.meta.url), 'utf8');

test('subtitle card editor is optional and scoped to subtitles-bgm', () => {
  assert.match(boot, /subtitleCardEditorUi\.js/);
  assert.match(source, /subtitles-bgm/);
  assert.match(source, /保存するまでプロジェクト本体は変更しません/);
});

test('subtitle card edits do not rewrite scene count duration or media', () => {
  assert.match(source, /currentScene\.subtitleText = nextText/);
  assert.doesNotMatch(source, /current\.scenes\s*=/);
  assert.doesNotMatch(source, /durationSec\s*=/);
  assert.doesNotMatch(source, /imageAssetId\s*=/);
  assert.doesNotMatch(source, /audioData\s*=/);
});
