import test from 'node:test';
import assert from 'node:assert/strict';
import { buildProductionChecklist, nextProductionDestination, preflightNavigation } from '../productionNavigator.js';

test('routes missing production work to the correct next screen', () => {
  const project={scenes:[{text:'本文',durationSec:3}],subtitleStyle:{enabled:true},bgm:{enabled:false}};
  assert.equal(nextProductionDestination(project).route,'scenes');
  const nav=preflightNavigation(project);
  assert.ok(nav.some(issue=>issue.code==='scene-image-missing'&&issue.route==='scenes'));
  assert.ok(nav.some(issue=>issue.code==='narration-missing'&&issue.route==='narration'));
});

test('moves to publish only after production inputs are ready', () => {
  const project={scenes:[{text:'本文',subtitleText:'字幕',durationSec:3,imageAssetId:'a',narration:{audioData:'data:audio/wav;base64,AA=='}}],subtitleStyle:{enabled:true},bgm:{enabled:false}};
  const checklist=buildProductionChecklist(project);
  assert.equal(checklist.find(x=>x.id==='output').done,true);
  assert.equal(nextProductionDestination(project).route,'publish');
});

test('recognizes the actual publish approval snapshot used by the publish screen', () => {
  const snapshot={title:'北斎',description:'概要',tags:'北斎,Shorts',thumbnailText:'90歳でも',visibility:'public'};
  const project={
    scenes:[{text:'本文',subtitleText:'字幕',durationSec:3,imageAssetId:'a',narration:{audioData:'data:audio/wav;base64,AA=='}}],
    subtitleStyle:{enabled:true},bgm:{enabled:false},
    publish:{...snapshot,approval:{approved:true,snapshot:{...snapshot},approvedAt:'2026-09-09T00:00:00.000Z'}}
  };
  const publish=buildProductionChecklist(project).find(x=>x.id==='publish');
  assert.equal(publish.done,true);
  assert.equal(nextProductionDestination(project).id,'complete');
});

test('editing approved publish metadata returns publish preparation to incomplete', () => {
  const snapshot={title:'北斎',description:'概要',tags:'北斎,Shorts',thumbnailText:'90歳でも',visibility:'public'};
  const project={
    scenes:[{text:'本文',subtitleText:'字幕',durationSec:3,imageAssetId:'a',narration:{audioData:'data:audio/wav;base64,AA=='}}],
    subtitleStyle:{enabled:true},bgm:{enabled:false},
    publish:{...snapshot,title:'変更後',approval:{approved:true,snapshot:{...snapshot},approvedAt:'2026-09-09T00:00:00.000Z'}}
  };
  assert.equal(buildProductionChecklist(project).find(x=>x.id==='publish').done,false);
  assert.equal(nextProductionDestination(project).route,'publish');
});

test('MediaRef narration and Creator OS standard BGM are complete in navigation',()=>{
  const project={
    scenes:[{
      text:'本文',
      subtitleText:'字幕',
      durationSec:3,
      imageAssetId:'a',
      narration:{mediaRef:{id:'narr-1'}}
    }],
    subtitleStyle:{enabled:true},
    output:{bgmEnabled:true},
    bgm:{source:'procedural',procedural:{preset:'calm-documentary'}}
  };
  const checklist=buildProductionChecklist(project);
  assert.equal(checklist.find(x=>x.id==='narration').done,true);
  assert.equal(checklist.find(x=>x.id==='bgm').done,true);
  assert.equal(checklist.find(x=>x.id==='output').done,true);
  assert.equal(nextProductionDestination(project).route,'publish');
});

test('still routes genuinely missing enabled BGM to the BGM screen',()=>{
  const project={
    scenes:[{
      text:'本文',
      subtitleText:'字幕',
      durationSec:3,
      imageAssetId:'a',
      narration:{mediaRef:{id:'narr-1'}}
    }],
    subtitleStyle:{enabled:true},
    output:{bgmEnabled:true},
    bgm:{source:'upload',audioData:''}
  };
  assert.equal(buildProductionChecklist(project).find(x=>x.id==='bgm').done,false);
  const nav=preflightNavigation(project);
  assert.ok(nav.some(issue=>issue.code==='bgm-missing'&&issue.route==='bgm'));
});
