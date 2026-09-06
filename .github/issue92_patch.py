from pathlib import Path

decision = Path('decisionLog.js')
main = Path('main.js')
tests = Path('tests/decisionLog.test.mjs')

d = decision.read_text()
marker = "export function moveSceneWithDecision(project, index, direction, options = {}) {"
assert marker in d, 'decisionLog insertion marker missing'
assert 'recordPublishMetadataApproval' not in d, 'v0.29 helper already exists'
helper = r'''const PUBLISH_VISIBILITIES = new Set(['private', 'unlisted', 'public']);

export function normalizePublishVisibility(value) {
  const normalized = stringOr(value).trim();
  return PUBLISH_VISIBILITIES.has(normalized) ? normalized : null;
}

export function snapshotPublishMetadata(value) {
  const source = isRecord(value) ? value : {};
  return {
    title: stringOr(source.title),
    description: stringOr(source.description).replace(/\r\n?/g, '\n'),
    tags: stringOr(source.tags),
    thumbnailText: stringOr(source.thumbnailText),
    visibility: normalizePublishVisibility(source.visibility)
  };
}

function validPublishMetadataSnapshot(value) {
  const snapshot = snapshotPublishMetadata(value);
  return Boolean(snapshot.title.trim()) && snapshot.visibility !== null;
}

export function publishMetadataApprovalMatches(approval, currentState) {
  if (!isRecord(approval) || approval.approved !== true) return false;
  const approved = snapshotPublishMetadata(approval.snapshot);
  const current = snapshotPublishMetadata(currentState);
  if (!validPublishMetadataSnapshot(approved) || !validPublishMetadataSnapshot(current)) return false;
  return JSON.stringify(approved) === JSON.stringify(current);
}

export function recordPublishMetadataApproval(project, {
  beforeApproval,
  finalState,
  hasFinalReviewApproval
}, options = {}) {
  const finalMetadata = snapshotPublishMetadata(finalState);
  if (!validPublishMetadataSnapshot(finalMetadata)) return null;
  if (publishMetadataApprovalMatches(beforeApproval, finalMetadata)) return null;

  const previousMetadata = isRecord(beforeApproval) && beforeApproval.approved === true
    ? snapshotPublishMetadata(beforeApproval.snapshot)
    : null;
  const proposal = previousMetadata && validPublishMetadataSnapshot(previousMetadata)
    ? previousMetadata
    : null;
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const targetDuration = Number(project?.targetDurationSec);
  const projectDurationSec = scenes.reduce((sum, scene) => sum + (Number(scene?.durationSec) || 0), 0);
  const hasNarration = Boolean(project?.narration?.audioData)
    || scenes.some(scene => Boolean(scene?.narration?.audioData));

  return appendDecision(project, {
    decisionType: 'publish-metadata-approval',
    sceneId: '',
    context: {
      platform: stringOr(project?.platform),
      genre: stringOr(project?.genre),
      aspectRatio: stringOr(project?.aspectRatio),
      targetDurationSec: Number.isFinite(targetDuration) ? targetDuration : null,
      projectDurationSec,
      sceneCount: scenes.length,
      hasFinalReviewApproval: Boolean(hasFinalReviewApproval),
      hasBgm: Boolean(project?.bgm?.audioData),
      hasNarration,
      subtitleEnabled: project?.subtitleStyle?.enabled !== false
    },
    proposal,
    alternatives: [],
    humanAction: { type: 'approve-publish-metadata' },
    finalDecision: finalMetadata,
    reasonCode: '',
    reasonNote: '',
    source: { type: 'human', feature: 'publish-editor', version: '0.29' },
    assetIds: [],
    rights: {}
  }, options);
}

'''
d = d.replace(marker, helper + marker, 1)
decision.write_text(d)

m = main.read_text()
old_import = "recordSubtitleBackgroundColorChange, recordFinalReviewApproval, recordSubtitleMaxCharsChange"
new_import = "recordSubtitleBackgroundColorChange, recordFinalReviewApproval, recordPublishMetadataApproval, recordSubtitleMaxCharsChange"
assert old_import in m, 'main record import marker missing'
m = m.replace(old_import, new_import, 1)
old_snapshot = "snapshotSubtitleBackgroundColor, snapshotFinalReviewApproval, snapshotSubtitleMaxLines"
new_snapshot = "snapshotSubtitleBackgroundColor, snapshotFinalReviewApproval, snapshotPublishMetadata, publishMetadataApprovalMatches, snapshotSubtitleMaxLines"
assert old_snapshot in m, 'main snapshot import marker missing'
m = m.replace(old_snapshot, new_snapshot, 1)

old_start = "  const project=await getProject(id);if(!project){goHome();return;}ensureProjectSettings(project);const p=project.publish;\n"
new_start = "  const project=await getProject(id);if(!project){goHome();return;}ensureProjectSettings(project);const p=project.publish;\n  const publishMetadataApproved=publishMetadataApprovalMatches(p.approval,p);\n"
assert old_start in m, 'renderPublish start marker missing'
m = m.replace(old_start, new_start, 1)

old_markup = r'''<div class=\"tool-row\"><button id=\"copyTitle\">タイトルをコピー</button><button id=\"copyDescription\">概要欄をコピー</button><button id=\"copyAll\" class=\"primary\">全部コピー</button></div></section><section class=\"actions\">'''
new_markup = r'''<div class=\"tool-row\"><button id=\"copyTitle\">タイトルをコピー</button><button id=\"copyDescription\">概要欄をコピー</button><button id=\"copyAll\" class=\"primary\">全部コピー</button></div><div class=\"tool-row\"><button id=\"approvePublishMetadata\" class=\"primary\">${publishMetadataApproved?'✓ 投稿情報は確定済み':'✓ この投稿情報を確定'}</button></div><p id=\"publishApprovalNote\" class=\"notice\">${publishMetadataApproved?'現在の投稿情報は確定済みです。編集すると未確定に戻ります。':'入力途中は自動保存されます。完成したらこのボタンで確定してください。'}</p></section><section class=\"actions\">'''
assert old_markup in m, 'publish markup marker missing'
m = m.replace(old_markup, new_markup, 1)

old_handlers = r'''  const {scheduleSave:save,flushSave}=createSaveController({delay:400,persist,setStatus:text=>root.querySelector('#saveState').textContent=text});
  bindSavedNavigation(root.querySelector('#back'),flushSave,()=>goOutput(id));
  bindSavedNavigation(root.querySelector('#backOutput'),flushSave,()=>goOutput(id));
  bindSavedNavigation(root.querySelector('#done'),flushSave,()=>goStudio(studioForGenre(project.genre)));
  ['publishTitle','description','tags','thumbnailText','visibility'].forEach(k=>root.querySelector('#'+k).oninput=save);
'''
new_handlers = r'''  const {scheduleSave:save,flushSave}=createSaveController({delay:400,persist,setStatus:text=>root.querySelector('#saveState').textContent=text});
  const currentPublishMetadata=()=>snapshotPublishMetadata({
    title:root.querySelector('#publishTitle').value,
    description:root.querySelector('#description').value,
    tags:root.querySelector('#tags').value,
    thumbnailText:root.querySelector('#thumbnailText').value,
    visibility:root.querySelector('#visibility').value
  });
  const refreshPublishApproval=()=>{
    const approved=publishMetadataApprovalMatches(p.approval,currentPublishMetadata());
    root.querySelector('#approvePublishMetadata').textContent=approved?'✓ 投稿情報は確定済み':'✓ この投稿情報を確定';
    root.querySelector('#publishApprovalNote').textContent=approved?'現在の投稿情報は確定済みです。編集すると未確定に戻ります。':'入力途中は自動保存されます。完成したらこのボタンで確定してください。';
    return approved;
  };
  bindSavedNavigation(root.querySelector('#back'),flushSave,()=>goOutput(id));
  bindSavedNavigation(root.querySelector('#backOutput'),flushSave,()=>goOutput(id));
  bindSavedNavigation(root.querySelector('#done'),flushSave,()=>goStudio(studioForGenre(project.genre)));
  ['publishTitle','description','tags','thumbnailText','visibility'].forEach(k=>root.querySelector('#'+k).oninput=()=>{save();refreshPublishApproval();});
  root.querySelector('#approvePublishMetadata').onclick=async()=>{
    try{
      await flushSave();
      const finalState=snapshotPublishMetadata(p);
      if(!finalState.title.trim()){alert('投稿タイトルを入力してください。');return;}
      if(!finalState.visibility){alert('公開設定を確認してください。');return;}
      if(publishMetadataApprovalMatches(p.approval,finalState)){refreshPublishApproval();return;}
      const beforeApproval=p.approval;
      const previousUpdatedAt=project.updatedAt;
      const decisionCount=ensureLearningState(project).decisions.length;
      const finalReviewApproved=Boolean(project.finalReview?.approved&&project.finalReview?.signature===finalReviewSignature(project));
      const record=recordPublishMetadataApproval(project,{beforeApproval,finalState,hasFinalReviewApproval:finalReviewApproved});
      if(!record){alert('投稿情報を確定できませんでした。入力内容を確認してください。');return;}
      p.approval={approved:true,snapshot:finalState,approvedAt:new Date().toISOString()};
      project.updatedAt=new Date().toISOString();
      try{await saveProject(project);}
      catch(error){
        ensureLearningState(project).decisions.splice(decisionCount);
        if(beforeApproval===undefined)delete p.approval;else p.approval=beforeApproval;
        project.updatedAt=previousUpdatedAt;
        throw error;
      }
      root.querySelector('#saveState').textContent='保存済み';
      refreshPublishApproval();
    }catch(error){console.error(error);alert(`投稿情報を確定できませんでした：${error.message}`);}
  };
'''
assert old_handlers in m, 'publish handler marker missing'
m = m.replace(old_handlers, new_handlers, 1)
main.write_text(m)

t = tests.read_text()
norm_marker = "  normalizeFinalReviewApproval,\n"
assert norm_marker in t, 'test normalize import marker missing'
t = t.replace(norm_marker, norm_marker + "  normalizePublishVisibility,\n", 1)
record_marker = "  recordFinalReviewApproval,\n"
assert record_marker in t, 'test record import marker missing'
t = t.replace(record_marker, record_marker + "  recordPublishMetadataApproval,\n", 1)
snap_marker = "  snapshotFinalReviewApproval,\n"
assert snap_marker in t, 'test snapshot import marker missing'
t = t.replace(snap_marker, snap_marker + "  snapshotPublishMetadata,\n  publishMetadataApprovalMatches,\n", 1)

t += r'''

test('publish metadata snapshot preserves final text and normalizes CRLF and visibility', () => {
  assert.equal(normalizePublishVisibility('private'), 'private');
  assert.equal(normalizePublishVisibility(' public '), 'public');
  assert.equal(normalizePublishVisibility('draft'), null);
  assert.deepEqual(snapshotPublishMetadata({
    title:' 最終タイトル ',
    description:'1行目\r\n2行目\r3行目',
    tags:'偉人,名言',
    thumbnailText:'最後まで伸びる',
    visibility:'unlisted'
  }),{
    title:' 最終タイトル ',
    description:'1行目\n2行目\n3行目',
    tags:'偉人,名言',
    thumbnailText:'最後まで伸びる',
    visibility:'unlisted'
  });
});

test('publish metadata approval matching is exact and becomes stale after any metadata edit', () => {
  const snapshot=snapshotPublishMetadata({title:'完成',description:'説明',tags:'A,B',thumbnailText:'文字',visibility:'private'});
  const approval={approved:true,snapshot};
  assert.equal(publishMetadataApprovalMatches(approval,snapshot),true);
  assert.equal(publishMetadataApprovalMatches(approval,{...snapshot,title:'完成版'}),false);
  assert.equal(publishMetadataApprovalMatches(approval,{...snapshot,visibility:'public'}),false);
  assert.equal(publishMetadataApprovalMatches({approved:false,snapshot},snapshot),false);
  assert.equal(publishMetadataApprovalMatches({approved:true,snapshot:{...snapshot,visibility:'invalid'}},snapshot),false);
});

test('publish-metadata-approval records one explicit final package with compact project context', () => {
  const project={
    id:'p-publish',platform:'youtube-shorts',genre:'great-person',aspectRatio:'9:16',targetDurationSec:60,learning:{decisions:[]},
    scenes:[
      {id:'s1',durationSec:4,narration:{audioData:'data:audio/wav;base64,SHOULD_NOT_COPY'}},
      {id:'s2',durationSec:6}
    ],
    narration:{audioData:''},
    bgm:{audioData:'data:audio/wav;base64,BGM_SHOULD_NOT_COPY'},
    subtitleStyle:{enabled:true},
    displayScript:'SCRIPT_SHOULD_NOT_COPY',
    finalReview:{signature:'SIGNATURE_SHOULD_NOT_COPY'}
  };
  const finalState={title:'北斎は何歳まで伸びたのか',description:'最終説明\n出典は概要欄へ',tags:'葛飾北斎,偉人,Shorts',thumbnailText:'90歳でも上達',visibility:'public'};
  const record=recordPublishMetadataApproval(project,{beforeApproval:null,finalState,hasFinalReviewApproval:true},{createId:()=> 'd-publish-1',now:()=> '2026-09-06T15:00:00.000Z'});
  assert.equal(record.decisionType,'publish-metadata-approval');
  assert.equal(record.sceneId,'');
  assert.equal(record.proposal,null);
  assert.deepEqual(record.finalDecision,finalState);
  assert.deepEqual(record.alternatives,[]);
  assert.deepEqual(record.humanAction,{type:'approve-publish-metadata'});
  assert.deepEqual(record.source,{type:'human',feature:'publish-editor',version:'0.29'});
  assert.deepEqual(record.assetIds,[]);
  assert.deepEqual(record.rights,{});
  assert.deepEqual(record.context,{
    platform:'youtube-shorts',genre:'great-person',aspectRatio:'9:16',targetDurationSec:60,projectDurationSec:10,sceneCount:2,
    hasFinalReviewApproval:true,hasBgm:true,hasNarration:true,subtitleEnabled:true
  });
  const serialized=JSON.stringify(record);
  assert.equal(serialized.includes('SHOULD_NOT_COPY'),false);
  assert.equal(serialized.includes('SIGNATURE_SHOULD_NOT_COPY'),false);
  assert.equal(project.learning.decisions.length,1);
});

test('publish-metadata-approval reuses previous approved package as proposal and rejects noise', () => {
  const project={id:'p',learning:{decisions:[]},scenes:[],subtitleStyle:{},bgm:{}};
  const previous={title:'旧タイトル',description:'旧説明',tags:'old',thumbnailText:'旧',visibility:'private'};
  const beforeApproval={approved:true,snapshot:previous,approvedAt:'2026-09-06T14:00:00.000Z'};
  const next={title:'新タイトル',description:'新説明',tags:'new',thumbnailText:'新',visibility:'public'};
  const record=recordPublishMetadataApproval(project,{beforeApproval,finalState:next,hasFinalReviewApproval:false});
  assert.deepEqual(record.proposal,previous);
  assert.deepEqual(record.finalDecision,next);
  assert.equal(project.learning.decisions.length,1);

  assert.equal(recordPublishMetadataApproval(project,{beforeApproval:{approved:true,snapshot:next},finalState:next,hasFinalReviewApproval:false}),null);
  assert.equal(recordPublishMetadataApproval(project,{beforeApproval:null,finalState:{...next,title:'   '},hasFinalReviewApproval:false}),null);
  assert.equal(recordPublishMetadataApproval(project,{beforeApproval:null,finalState:{...next,visibility:'draft'},hasFinalReviewApproval:false}),null);
  assert.equal(project.learning.decisions.length,1);
});
'''
tests.write_text(t)
