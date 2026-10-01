import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source=await readFile(new URL('../main.js',import.meta.url),'utf8');

test('production-request Scene UI offers one explicit asset-to-narration action',()=>{
  assert.match(source,/素材取得 → ナレーションへ/);
  assert.doesNotMatch(source,/Sceneごとに素材を自動取得します。[\s\S]*続けますか？/);
});

test('asset acquisition only navigates to Voice Lab after safe handoff evaluation',()=>{
  assert.match(source,/evaluateAssetToVoiceHandoff\(project,result\)/);
  assert.match(source,/if\(handoff\.canContinue\)[\s\S]*voice-lab\.html\?project=/);
  assert.match(source,/素材処理は完了しましたが、\$\{handoff\.reason\}/);
});

test('manual Voice Lab link remains available as fallback',()=>{
  assert.match(source,/シーン別ナレーションを作成/);
  assert.match(source,/voice-lab\.html\?project=\$\{encodeURIComponent\(project\.id\)\}/);
});
