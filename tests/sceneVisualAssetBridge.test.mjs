import assert from 'node:assert/strict';
import { visualTypeSearchTerms, findAssetsForVisualType, findDatasetExamplesForVisualType, buildVisualAssetBridge } from '../sceneVisualAssetBridge.js';

const scene={id:'s1',text:'北斎が絵を描く手元の作業を見せる'};
const suggestion={typeId:'hands',label:'手元・作業',matchedKeywords:['手元','作業']};
const project={id:'p1',title:'current',platform:'YouTube',aspectRatio:'9:16',mediaLibrary:[
  {id:'a1',type:'image',fileName:'hokusai-hands.jpg',tags:['手元','制作']},
  {id:'a2',type:'image',fileName:'mountain.jpg',tags:['風景']}
],learning:{decisions:[]}};
const historical={id:'p2',title:'past',platform:'YouTube',aspectRatio:'9:16',mediaLibrary:[{id:'h1',type:'image',fileName:'brush.jpg',tags:['手元','職人']}],learning:{decisions:[{
  decisionType:'scene-image-selection',sceneId:'old1',timestamp:'2026-09-01T00:00:00Z',context:{sceneText:'職人の手元で絵を描く制作工程',platform:'YouTube',aspectRatio:'9:16'},finalDecision:{imageAssetId:'h1'}
}]}};
const terms=visualTypeSearchTerms(suggestion);
assert.ok(terms.includes('手元'));
assert.ok(terms.includes('制作'));
const current=findAssetsForVisualType(project,scene,suggestion,{limit:4});
assert.equal(current[0].assetId,'a1');
assert.ok(current.every(item=>!('data' in item)));
const dataset=findDatasetExamplesForVisualType(project,scene,suggestion,[project,historical],{limit:4});
assert.equal(dataset[0].assetId,'h1');
assert.equal(dataset[0].source,'dataset');
const bridge=buildVisualAssetBridge(project,scene,suggestion,[project,historical],{limit:4});
assert.equal(bridge.visualType.typeId,'hands');
assert.equal(bridge.currentAssets[0].assetId,'a1');
assert.equal(bridge.datasetExamples[0].assetId,'h1');
assert.equal(project.scenes,undefined);
assert.equal(historical.mediaLibrary[0].id,'h1');
console.log('sceneVisualAssetBridge tests passed');
