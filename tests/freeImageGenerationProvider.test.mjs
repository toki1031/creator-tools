import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFreeImagePrompt,FREE_IMAGE_PROMPT_MAX_CHARS,planFreeImageGeneration,requestFreeGeneratedImage} from '../freeImageGenerationProvider.js';

test('only reconstruction and modern visuals may use free generation',()=>{
  assert.equal(planFreeImageGeneration({requestedType:'ai-reconstruction'}).status,'ready');
  assert.equal(planFreeImageGeneration({requestedType:'modern-visual'}).status,'ready');
  assert.equal(planFreeImageGeneration({requestedType:'historical-source'}).status,'blocked');
});

test('free quota exhaustion never falls back to paid generation',()=>{
  const r=planFreeImageGeneration({requestedType:'modern-visual'},{dailyQuotaAvailable:false});
  assert.equal(r.status,'free-quota-exhausted');
  assert.equal(r.paidFallback,false);
});

test('generation provider is server-side only',()=>{
  const r=planFreeImageGeneration({requestedType:'modern-visual'});
  assert.equal(r.serverSideOnly,true);
  assert.equal(r.paidFallback,false);
});

test('historical reconstruction prompt keeps Nightingale scene intent and blocks fantasy drift',()=>{
  const prompt=buildFreeImagePrompt({
    requestedType:'ai-reconstruction',
    queryHint:'19世紀の軍病院。フローレンス・ナイチンゲールが患者の記録と報告書を確認している。',
    prohibitedContent:['文字は描かない','実在する写真として扱わない']
  });
  assert.match(prompt,/photorealistic historical documentary reconstruction/i);
  assert.match(prompt,/Florence Nightingale/i);
  assert.match(prompt,/19th-century/i);
  assert.match(prompt,/hospital ward/i);
  assert.match(prompt,/paper records and reports/i);
  assert.match(prompt,/ナイチンゲール/);
  assert.match(prompt,/fantasy/i);
  assert.match(prompt,/monsters/i);
  assert.match(prompt,/文字は描かない/);
  assert.match(prompt,/readable text/i);
  assert.ok(Array.from(prompt).length<=FREE_IMAGE_PROMPT_MAX_CHARS);
});

test('statistical papers on a desk stay documentary rather than fantasy objects',()=>{
  const prompt=buildFreeImagePrompt({
    requestedType:'ai-reconstruction',
    queryHint:'ナイチンゲールが机の上の統計資料と死亡記録を比較し、分析している場面。'
  });
  assert.match(prompt,/Florence Nightingale/i);
  assert.match(prompt,/statistical papers and charts/i);
  assert.match(prompt,/desk with papers/i);
  assert.match(prompt,/surreal substitutions/i);
  assert.match(prompt,/fantasy weapons/i);
});

test('modern meeting prompt explicitly asks for realistic contemporary imagery',()=>{
  const prompt=buildFreeImagePrompt({
    requestedType:'modern-visual',
    queryHint:'現代の会議。説明資料を見ながら複数人が議論し、数字・具体例・比較を使って説明を改善する。'
  });
  assert.match(prompt,/photorealistic contemporary documentary/i);
  assert.match(prompt,/meeting or discussion/i);
  assert.match(prompt,/present-day people/i);
  assert.match(prompt,/anime/i);
  assert.match(prompt,/historical costumes/i);
  assert.match(prompt,/現代の会議/);
});

test('generation request sends the structured prompt instead of raw queryHint',async()=>{
  let sent=null;
  const fetchImpl=async(_url,options)=>{
    sent=JSON.parse(options.body);
    return new Response(JSON.stringify({id:'g1',data:'data:image/jpeg;base64,AA'}),{status:200,headers:{'content-type':'application/json'}});
  };
  const raw='現代の会議で説明資料を改善する。';
  const r=await requestFreeGeneratedImage({requestedType:'modern-visual',queryHint:raw,prohibitedContent:['文字は描かない']},{fetchImpl});
  assert.notEqual(sent.prompt,raw);
  assert.match(sent.prompt,/SCENE TO DEPICT/);
  assert.match(sent.prompt,/現代の会議/);
  assert.match(sent.prompt,/文字は描かない/);
  assert.equal(sent.requestedType,'modern-visual');
  assert.equal(r.status,'resolved');
  assert.equal(r.asset.requestedType,'modern-visual');
});


test('historical reconstruction generically rejects modern anachronisms without topic hardcoding',()=>{
  const prompt=buildFreeImagePrompt({
    requestedType:'ai-reconstruction',
    queryHint:'江戸時代の商家で帳簿を確認している人物。木造建築と当時の道具。'
  });
  assert.match(prompt,/Historical authenticity overrides generic contemporary visual defaults/i);
  assert.match(prompt,/ANACHRONISMS TO AVOID/i);
  assert.match(prompt,/fluorescent lighting/i);
  assert.match(prompt,/modern hospital equipment/i);
  assert.match(prompt,/computers/i);
  assert.match(prompt,/江戸時代/);
  assert.doesNotMatch(prompt,/Florence Nightingale/i);
  assert.doesNotMatch(prompt,/19th-century/i);
  assert.ok(Array.from(prompt).length<=FREE_IMAGE_PROMPT_MAX_CHARS);
});

test('modern visual prompt does not inherit historical anachronism constraints',()=>{
  const prompt=buildFreeImagePrompt({
    requestedType:'modern-visual',
    queryHint:'現代のオフィスでPCを使いながら会議している。'
  });
  assert.doesNotMatch(prompt,/Period authenticity is a hard constraint/i);
  assert.doesNotMatch(prompt,/Exclude anachronisms/i);
  assert.match(prompt,/present-day people/i);
  assert.match(prompt,/PC/);
});


test('historical scene intent is placed before generic styling and anachronism rules',()=>{
  const raw='中世ヨーロッパの修道院で写本を作る書記。羊皮紙と木製机。';
  const prompt=buildFreeImagePrompt({requestedType:'ai-reconstruction',queryHint:raw});
  assert.ok(prompt.indexOf(raw) < prompt.indexOf('ANACHRONISMS TO AVOID'));
  assert.match(prompt,/Historical authenticity overrides generic contemporary visual defaults/i);
  assert.match(prompt,/Do not silently modernize/i);
  assert.match(prompt,/contemporary clothing or protective equipment/i);
});

test('historical prompt keeps the actual scene within the 2048 character budget',()=>{
  const raw='古代ローマの工房で職人が道具を使って作業している。'+ '時代背景の詳細。'.repeat(250);
  const prompt=buildFreeImagePrompt({requestedType:'ai-reconstruction',queryHint:raw});
  assert.match(prompt,/古代ローマの工房/);
  assert.match(prompt,/ANACHRONISMS TO AVOID/);
  assert.ok(Array.from(prompt).length<=FREE_IMAGE_PROMPT_MAX_CHARS);
});
