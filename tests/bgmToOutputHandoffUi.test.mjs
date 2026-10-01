import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const main=await readFile(new URL('../main.js',import.meta.url),'utf8');
const voice=await readFile(new URL('../voice-lab.html',import.meta.url),'utf8');

test('one-click Voice Lab return marks the BGM page for output continuation',()=>{
  assert.match(voice,/index\.html\?autoContinue=output#\/project\/\$\{encodeURIComponent\(projectId\)\}\/bgm/);
});

test('BGM page consumes the one-time autoContinue marker before handoff',()=>{
  assert.match(main,/new URLSearchParams\(location\.search\)\.get\('autoContinue'\)==='output'/);
  assert.match(main,/url\.searchParams\.delete\('autoContinue'\)/);
  assert.match(main,/history\.replaceState/);
});

test('BGM page only goes to output after readiness passes',()=>{
  assert.match(main,/evaluateBgmToOutputHandoff\(project\)/);
  assert.match(main,/if\(handoff\.canContinue\)[\s\S]*goOutput\(id\)/);
  assert.match(main,/自動制作をここで停止しました/);
});

test('manual BGM navigation remains available while automatic output stays gated',()=>{
  assert.match(main,/id="nextOutput">次へ：出力設定/);
  const start=main.indexOf('async function renderBgm(id)');
  const end=main.indexOf('\nasync function renderOutput(id)',start);
  const renderBgm=main.slice(start,end);
  assert.match(renderBgm,/bindSavedNavigation\(root\.querySelector\('#nextOutput'\),flushSave,\(\)=>goOutput\(id\)\)/);
  const gate=renderBgm.indexOf('if(autoContinueToOutput)');
  const readiness=renderBgm.indexOf('if(handoff.canContinue)',gate);
  const autoGo=renderBgm.indexOf('goOutput(id);',readiness);
  assert.ok(gate>=0&&readiness>gate&&autoGo>readiness);
});
