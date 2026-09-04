import fs from 'node:fs';

function replaceOnce(text, from, to, label) {
  const parts = text.split(from);
  if (parts.length !== 2) throw new Error(`${label}: expected exactly one match, got ${parts.length - 1}`);
  return parts[0] + to + parts[1];
}

function replaceLineStarting(text, prefix, replacement, label) {
  const lines = text.split('\n');
  const matches = lines.map((line, index) => line.startsWith(prefix) ? index : -1).filter(index => index >= 0);
  if (matches.length !== 1) throw new Error(`${label}: expected exactly one line, got ${matches.length}`);
  lines[matches[0]] = replacement;
  return lines.join('\n');
}

function edit(path, transform) {
  const before = fs.readFileSync(path, 'utf8');
  const after = transform(before);
  if (after === before) throw new Error(`${path}: no change produced`);
  fs.writeFileSync(path, after);
}

edit('decisionLog.js', text => {
  text = replaceOnce(
    text,
    "import { consumePromotedLegacyAssetId, isImageDataUrl } from './mediaLibrary.js';\n",
    "import { consumePromotedLegacyAssetId, isImageDataUrl } from './mediaLibrary.js';\nimport { normalizeSubtitleOffset } from './subtitlePosition.js';\n",
    'decisionLog subtitlePosition import'
  );

  const marker = "export function moveSceneWithDecision(project, index, direction, options = {}) {";
  const helper = `const SCENE_SUBTITLE_POSITIONS = new Set(['top', 'center', 'bottom']);\n\nexport function snapshotSceneSubtitlePosition(scene) {\n  const position = stringOr(scene?.subtitlePosition).trim();\n  if (!position) return { mode: 'inherit', position: null, offsetPercent: null };\n  if (!SCENE_SUBTITLE_POSITIONS.has(position)) return null;\n  return {\n    mode: 'override',\n    position,\n    offsetPercent: normalizeSubtitleOffset(scene?.subtitlePositionOffsetPercent)\n  };\n}\n\nfunction normalizeSceneSubtitlePositionState(value) {\n  if (!isRecord(value)) return null;\n  const mode = stringOr(value.mode).trim();\n  if (mode === 'inherit') return { mode: 'inherit', position: null, offsetPercent: null };\n  const position = stringOr(value.position).trim();\n  if (mode !== 'override' || !SCENE_SUBTITLE_POSITIONS.has(position)) return null;\n  return { mode: 'override', position, offsetPercent: normalizeSubtitleOffset(value.offsetPercent) };\n}\n\nexport function recordSceneSubtitlePositionChange(project, {\n  sceneId,\n  beforeState,\n  afterState,\n  sceneIndex\n}, options = {}) {\n  if (!sceneId) return null;\n  const before = normalizeSceneSubtitlePositionState(beforeState);\n  const after = normalizeSceneSubtitlePositionState(afterState);\n  if (!before || !after || JSON.stringify(before) === JSON.stringify(after)) return null;\n\n  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];\n  const requestedIndex = Number(sceneIndex);\n  const resolvedIndex = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < scenes.length\n    && String(scenes[requestedIndex]?.id || '') === String(sceneId)\n    ? requestedIndex\n    : scenes.findIndex(scene => String(scene?.id || '') === String(sceneId));\n  const scene = resolvedIndex >= 0 ? scenes[resolvedIndex] : null;\n  if (!scene) return null;\n\n  const globalStyle = isRecord(project?.subtitleStyle) ? project.subtitleStyle : {};\n  const globalStylePosition = stringOr(globalStyle.position).trim();\n  const outputPosition = stringOr(project?.output?.subtitlePosition).trim();\n  const globalSubtitlePosition = SCENE_SUBTITLE_POSITIONS.has(globalStylePosition)\n    ? globalStylePosition\n    : SCENE_SUBTITLE_POSITIONS.has(outputPosition) ? outputPosition : 'bottom';\n\n  const assets = validImageAssetMap(project);\n  const imageAssetId = stringOr(scene.imageAssetId).trim();\n  const imageAsset = assets.get(imageAssetId);\n  const context = {\n    sceneText: stringOr(scene.text),\n    sceneIndex: resolvedIndex,\n    durationSec: Number.isFinite(Number(scene.durationSec)) ? Number(scene.durationSec) : null,\n    platform: stringOr(project?.platform),\n    aspectRatio: stringOr(project?.aspectRatio),\n    globalSubtitlePosition,\n    globalSubtitleOffsetPercent: normalizeSubtitleOffset(globalStyle.positionOffsetPercent)\n  };\n  if (imageAsset) context.imageAssetId = imageAssetId;\n\n  return appendDecision(project, {\n    decisionType: 'scene-subtitle-position',\n    sceneId: String(sceneId),\n    context,\n    proposal: before,\n    alternatives: [],\n    humanAction: { type: 'set-scene-subtitle-position' },\n    finalDecision: after,\n    reasonCode: '',\n    reasonNote: '',\n    source: { type: 'human', feature: 'subtitle-editor', version: '0.7' },\n    assetIds: imageAsset ? [imageAssetId] : [],\n    rights: imageAsset ? imageAssetRights(imageAsset) : {}\n  }, options);\n}\n\n`;
  return replaceOnce(text, marker, helper + marker, 'decisionLog v0.7 helper insertion');
});

edit('main.js', text => {
  text = replaceOnce(
    text,
    'import { ensureLearningState, moveSceneWithDecision, recordSceneDurationChange, recordSceneImageSelection, recordSceneMotionChange, recordSceneTransitionChange, recordSubtitleContentChange } from "./decisionLog.js";',
    'import { ensureLearningState, moveSceneWithDecision, recordSceneDurationChange, recordSceneImageSelection, recordSceneMotionChange, recordSceneSubtitlePositionChange, recordSceneTransitionChange, recordSubtitleContentChange, snapshotSceneSubtitlePosition } from "./decisionLog.js";',
    'main decisionLog import'
  );

  text = replaceLineStarting(
    text,
    "    list.querySelectorAll('[data-sub-position]').forEach(el=>el.onchange=()=>",
    "    list.querySelectorAll('[data-sub-position]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.subPosition),scene=scenes[i];if(!scene)return;const before=snapshotSceneSubtitlePosition(scene);if(el.value){scene.subtitlePosition=el.value;scene.subtitlePositionOffsetPercent=0;}else{delete scene.subtitlePosition;delete scene.subtitlePositionOffsetPercent;}const after=snapshotSceneSubtitlePosition(scene);recordSceneSubtitlePositionChange(project,{sceneId:scene.id,beforeState:before,afterState:after,sceneIndex:i});renderSubtitleEditor();renderSubtitlePreview();save();});",
    'main position handler'
  );

  text = replaceLineStarting(
    text,
    "    list.querySelectorAll('[data-sub-offset]').forEach(el=>el.oninput=()=>",
    "    const subtitleOffsetBeforeByElement=new WeakMap();\n    const rememberSubtitleOffsetBefore=el=>{if(subtitleOffsetBeforeByElement.has(el))return;const i=Number(el.dataset.subOffset),scene=scenes[i];if(scene)subtitleOffsetBeforeByElement.set(el,snapshotSceneSubtitlePosition(scene));};\n    const commitSubtitleOffsetDecision=el=>{if(!subtitleOffsetBeforeByElement.has(el))return;const i=Number(el.dataset.subOffset),scene=scenes[i],before=subtitleOffsetBeforeByElement.get(el);subtitleOffsetBeforeByElement.delete(el);if(!scene)return;const after=snapshotSceneSubtitlePosition(scene);const record=recordSceneSubtitlePositionChange(project,{sceneId:scene.id,beforeState:before,afterState:after,sceneIndex:i});if(record)save();};\n    list.querySelectorAll('[data-sub-offset]').forEach(el=>{el.onpointerdown=()=>rememberSubtitleOffsetBefore(el);el.onfocus=()=>rememberSubtitleOffsetBefore(el);el.onkeydown=()=>rememberSubtitleOffsetBefore(el);el.oninput=()=>{const i=Number(el.dataset.subOffset);scenes[i].subtitlePositionOffsetPercent=normalizeSubtitleOffset(el.value);list.querySelector('[data-sub-offset-value=\"'+i+'\"]').textContent=(scenes[i].subtitlePositionOffsetPercent>0?'+':'')+scenes[i].subtitlePositionOffsetPercent+'%';const effective=resolveEffectiveSubtitlePosition(scenes[i],st,project.output?.subtitlePosition);list.querySelector('[data-sub-effective=\"'+i+'\"]').textContent='個別設定：'+({top:'上',center:'中央',bottom:'下'})[effective.position]+' / '+(effective.offsetPercent>0?'+':'')+effective.offsetPercent+'%';if(Number(root.querySelector('#previewScene').value)===i)renderSubtitlePreview();save();};el.onblur=()=>commitSubtitleOffsetDecision(el);});",
    'main offset handler'
  );

  return replaceLineStarting(
    text,
    "    list.querySelectorAll('[data-sub-offset-reset]').forEach(el=>el.onclick=()=>",
    "    list.querySelectorAll('[data-sub-offset-reset]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.subOffsetReset),scene=scenes[i];if(!scene)return;const before=snapshotSceneSubtitlePosition(scene);scene.subtitlePositionOffsetPercent=0;const after=snapshotSceneSubtitlePosition(scene);recordSceneSubtitlePositionChange(project,{sceneId:scene.id,beforeState:before,afterState:after,sceneIndex:i});renderSubtitleEditor();if(Number(root.querySelector('#previewScene').value)===i)renderSubtitlePreview();save();});",
    'main offset reset handler'
  );
});

edit('tests/decisionLog.test.mjs', text => {
  text = replaceOnce(
    text,
    "  recordSceneMotionChange,\n  recordSceneTransitionChange,\n",
    "  recordSceneMotionChange,\n  recordSceneSubtitlePositionChange,\n  recordSceneTransitionChange,\n  snapshotSceneSubtitlePosition,\n",
    'tests decisionLog imports'
  );

  return text + `\n\ntest('scene-subtitle-position records inherit to override with normalized context', () => {\n  const project = { id:'p', platform:'youtube-shorts', aspectRatio:'9:16', learning:{decisions:[]}, subtitleStyle:{position:'bottom',positionOffsetPercent:4}, output:{subtitlePosition:'top'}, scenes:[{id:'s1',text:'字幕位置',durationSec:6}] };\n  const record=recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'inherit'},afterState:{mode:'override',position:'top',offsetPercent:0},sceneIndex:0},{createId:()=> 'd1',now:()=> '2026-09-04T13:00:00.000Z'});\n  assert.equal(record.decisionType,'scene-subtitle-position');\n  assert.deepEqual(record.proposal,{mode:'inherit',position:null,offsetPercent:null});\n  assert.deepEqual(record.finalDecision,{mode:'override',position:'top',offsetPercent:0});\n  assert.equal(record.context.sceneText,'字幕位置');\n  assert.equal(record.context.sceneIndex,0);\n  assert.equal(record.context.durationSec,6);\n  assert.equal(record.context.globalSubtitlePosition,'bottom');\n  assert.equal(record.context.globalSubtitleOffsetPercent,4);\n  assert.deepEqual(record.humanAction,{type:'set-scene-subtitle-position'});\n  assert.deepEqual(record.source,{type:'human',feature:'subtitle-editor',version:'0.7'});\n});\n\ntest('scene-subtitle-position records override changes, inherit, offset normalization and reset', () => {\n  const project={id:'p',learning:{decisions:[]},subtitleStyle:{position:'bottom'},scenes:[{id:'s1',text:'scene'}]};\n  const moved=recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'override',position:'top',offsetPercent:0},afterState:{mode:'override',position:'center',offsetPercent:99},sceneIndex:0});\n  const inherited=recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'override',position:'center',offsetPercent:5},afterState:{mode:'inherit'},sceneIndex:0});\n  const reset=recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'override',position:'bottom',offsetPercent:5},afterState:{mode:'override',position:'bottom',offsetPercent:0},sceneIndex:0});\n  assert.deepEqual(moved.finalDecision,{mode:'override',position:'center',offsetPercent:15});\n  assert.deepEqual(inherited.finalDecision,{mode:'inherit',position:null,offsetPercent:null});\n  assert.equal(reset.proposal.offsetPercent,5);\n  assert.equal(reset.finalDecision.offsetPercent,0);\n});\n\ntest('scene-subtitle-position ignores same, invalid, missing id and missing scene', () => {\n  const project={id:'p',learning:{decisions:[]},scenes:[{id:'s1'}]};\n  const same={mode:'override',position:'top',offsetPercent:0};\n  assert.equal(recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:same,afterState:same,sceneIndex:0}),null);\n  assert.equal(recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'override',position:'wipe',offsetPercent:0},afterState:same,sceneIndex:0}),null);\n  assert.equal(recordSceneSubtitlePositionChange(project,{sceneId:'',beforeState:{mode:'inherit'},afterState:same,sceneIndex:0}),null);\n  assert.equal(recordSceneSubtitlePositionChange(project,{sceneId:'missing',beforeState:{mode:'inherit'},afterState:same,sceneIndex:0}),null);\n  assert.equal(project.learning.decisions.length,0);\n});\n\ntest('scene-subtitle-position global context falls back to output then bottom', () => {\n  const a={id:'a',learning:{decisions:[]},subtitleStyle:{position:'invalid',positionOffsetPercent:-99},output:{subtitlePosition:'center'},scenes:[{id:'s'}]};\n  const ar=recordSceneSubtitlePositionChange(a,{sceneId:'s',beforeState:{mode:'inherit'},afterState:{mode:'override',position:'top',offsetPercent:0},sceneIndex:0});\n  assert.equal(ar.context.globalSubtitlePosition,'center');\n  assert.equal(ar.context.globalSubtitleOffsetPercent,-15);\n  const b={id:'b',learning:{decisions:[]},subtitleStyle:{position:'invalid'},output:{subtitlePosition:'invalid'},scenes:[{id:'s'}]};\n  const br=recordSceneSubtitlePositionChange(b,{sceneId:'s',beforeState:{mode:'inherit'},afterState:{mode:'override',position:'top',offsetPercent:0},sceneIndex:0});\n  assert.equal(br.context.globalSubtitlePosition,'bottom');\n});\n\ntest('scene-subtitle-position snapshots scene state and only connects valid image rights', () => {\n  const project={id:'p',learning:{decisions:[]},subtitleStyle:{position:'bottom'},mediaLibrary:[{id:'img',type:'image',data:imageData,license:'CC BY',rights:{attributionRequired:true}}],scenes:[{id:'s',text:'scene',imageAssetId:'img',subtitlePosition:'center',subtitlePositionOffsetPercent:3}]};\n  assert.deepEqual(snapshotSceneSubtitlePosition(project.scenes[0]),{mode:'override',position:'center',offsetPercent:3});\n  assert.deepEqual(snapshotSceneSubtitlePosition({}),{mode:'inherit',position:null,offsetPercent:null});\n  assert.equal(snapshotSceneSubtitlePosition({subtitlePosition:'wipe'}),null);\n  const record=recordSceneSubtitlePositionChange(project,{sceneId:'s',beforeState:{mode:'inherit'},afterState:snapshotSceneSubtitlePosition(project.scenes[0]),sceneIndex:0});\n  assert.equal(record.context.imageAssetId,'img');\n  assert.deepEqual(record.assetIds,['img']);\n  assert.deepEqual(record.rights,{attributionRequired:true,license:'CC BY'});\n});\n`;
});

console.log('Issue #46 patch v2 applied safely.');
