import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject } from '../projectFactory.js';
import { normalizeSubtitleContentForSync } from '../qualityLogic.js';
import {
  appendDecision,
  ensureLearningState,
  moveSceneWithDecision,
  normalizeDecisionRecord,
  normalizeLearningState,
  normalizeBgmVolume,
  normalizeNarrationVoiceId,
  recordBgmVolumeChange,
  recordNarrationVoiceDecision,
  recordGlobalSubtitlePositionChange,
  recordSubtitleSceneSyncDecision,
  recordSceneDurationChange,
  recordSceneImageSelection,
  recordSceneMotionChange,
  recordSceneSubtitlePositionChange,
  recordSceneTransitionChange,
  snapshotGlobalSubtitlePosition,
  snapshotSceneSubtitlePosition,
  recordSceneOrderChange,
  recordSubtitleContentChange,
  snapshotSceneOrder
} from '../decisionLog.js';

const imageData = 'data:image/png;base64,QQ==';

test('new project starts with an empty learning decision list', () => {
  const project = createProject('QA', 'great-person', 'youtube-shorts');
  assert.deepEqual(project.learning, { decisions: [] });
});

test('old or malformed learning state is safely normalized', () => {
  const project = { id: 'p1', learning: 'invalid' };
  const learning = ensureLearningState(project);
  assert.deepEqual(learning, { decisions: [] });

  const normalized = normalizeLearningState({ decisions: [null, {}, { decisionType: 'scene-order', projectId: 'p1' }] });
  assert.equal(normalized.decisions.length, 1);
  assert.equal(normalized.decisions[0].decisionType, 'scene-order');
});

test('appendDecision fills stable id, project id and timestamp', () => {
  const project = { id: 'project-1', learning: { decisions: [] } };
  const record = appendDecision(project, { decisionType: 'scene-order' }, {
    createId: () => 'decision-1',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  assert.equal(record.id, 'decision-1');
  assert.equal(record.projectId, 'project-1');
  assert.equal(record.timestamp, '2026-08-31T00:00:00.000Z');
  assert.equal(project.learning.decisions.length, 1);
});

test('snapshotSceneOrder preserves scene ids, order and text', () => {
  const snapshot = snapshotSceneOrder({ scenes: [
    { id: 's1', text: 'first' },
    { id: 's2', text: 'second' }
  ]});
  assert.deepEqual(snapshot, [
    { sceneId: 's1', order: 1, text: 'first' },
    { sceneId: 's2', order: 2, text: 'second' }
  ]);
});

test('recordSceneOrderChange stores before and after order only when order changes', () => {
  const project = { id: 'p1', scenes: [], learning: { decisions: [] } };
  const before = [
    { sceneId: 's1', order: 1, text: 'one' },
    { sceneId: 's2', order: 2, text: 'two' }
  ];
  const unchanged = recordSceneOrderChange(project, { sceneId: 's2', direction: 'up', before, after: before }, {
    createId: () => 'ignored',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  assert.equal(unchanged, null);
  assert.equal(project.learning.decisions.length, 0);

  const after = [
    { sceneId: 's2', order: 1, text: 'two' },
    { sceneId: 's1', order: 2, text: 'one' }
  ];
  const record = recordSceneOrderChange(project, { sceneId: 's2', direction: 'up', before, after }, {
    createId: () => 'decision-reorder',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  assert.equal(record.id, 'decision-reorder');
  assert.equal(record.decisionType, 'scene-order');
  assert.equal(record.sceneId, 's2');
  assert.equal(record.humanAction.direction, 'up');
  assert.deepEqual(record.proposal.map(item => item.sceneId), ['s1', 's2']);
  assert.deepEqual(record.finalDecision.map(item => item.sceneId), ['s2', 's1']);
  assert.equal(project.learning.decisions.length, 1);
});

test('moveSceneWithDecision reorders one scene and stores exactly one decision', () => {
  const project = {
    id: 'p1',
    learning: { decisions: [] },
    scenes: [
      { id: 's1', text: 'one', imageAssetId: 'a1', subtitleText: 'sub1', narration: { audioData: 'data:audio/wav;base64,AA==' } },
      { id: 's2', text: 'two', imageAssetId: 'a2', subtitleText: 'sub2', narration: { audioData: 'data:audio/wav;base64,BB==' } }
    ]
  };
  const record = moveSceneWithDecision(project, 1, 'up', {
    createId: () => 'decision-up',
    now: () => '2026-08-31T00:00:00.000Z'
  });
  assert.equal(record.id, 'decision-up');
  assert.equal(record.sceneId, 's2');
  assert.equal(record.humanAction.direction, 'up');
  assert.deepEqual(project.scenes.map(scene => scene.id), ['s2', 's1']);
  assert.equal(project.scenes[0].imageAssetId, 'a2');
  assert.equal(project.scenes[0].subtitleText, 'sub2');
  assert.equal(project.scenes[0].narration.audioData, 'data:audio/wav;base64,BB==');
  assert.equal(project.learning.decisions.length, 1);
});

test('moveSceneWithDecision ignores invalid or non-moving operations', () => {
  const project = { id: 'p1', scenes: [{ id: 's1', text: 'one' }, { id: 's2', text: 'two' }] };
  assert.equal(moveSceneWithDecision(project, 0, 'up'), null);
  assert.equal(moveSceneWithDecision(project, 1, 'down'), null);
  assert.equal(moveSceneWithDecision(project, 0, 'sideways'), null);
  assert.deepEqual(project.scenes.map(scene => scene.id), ['s1', 's2']);
  assert.equal(project.learning.decisions.length, 0);
});

test('normalizeDecisionRecord rejects records without type or project id', () => {
  assert.equal(normalizeDecisionRecord({ projectId: 'p1' }), null);
  assert.equal(normalizeDecisionRecord({ decisionType: 'scene-order' }), null);
  assert.equal(normalizeDecisionRecord(null), null);
});


test('scene-duration stores one committed duration decision with editing context', () => {
  const project = {
    id: 'p-duration',
    targetDurationSec: 60,
    learning: { decisions: [] },
    scenes: [
      { id: 's1', text: 'intro', durationSec: 8, imageAssetId: 'asset-1', subtitleText: 'subtitle', narration: { audioData: 'audio' } },
      { id: 's2', text: 'next', durationSec: 5 }
    ]
  };
  const record = recordSceneDurationChange(project, {
    sceneId: 's1',
    beforeDurationSec: 5,
    afterDurationSec: 8,
    sceneIndex: 0,
    totalDurationBefore: 10
  }, {
    createId: () => 'decision-duration',
    now: () => '2026-08-31T13:30:00.000Z'
  });

  assert.equal(record.id, 'decision-duration');
  assert.equal(record.decisionType, 'scene-duration');
  assert.equal(record.sceneId, 's1');
  assert.deepEqual(record.proposal, { durationSec: 5 });
  assert.deepEqual(record.finalDecision, { durationSec: 8 });
  assert.equal(record.humanAction.type, 'set-duration');
  assert.equal(record.context.sceneIndex, 0);
  assert.equal(record.context.sceneNumber, 1);
  assert.equal(record.context.sceneText, 'intro');
  assert.equal(record.context.targetDurationSec, 60);
  assert.equal(record.context.projectTotalDurationSecBefore, 10);
  assert.equal(record.source.version, '0.2');
  assert.equal(project.learning.decisions.length, 1);
  assert.equal(project.scenes[0].imageAssetId, 'asset-1');
  assert.equal(project.scenes[0].subtitleText, 'subtitle');
  assert.equal(project.scenes[0].narration.audioData, 'audio');
});

test('scene-duration ignores same or invalid values and does not create noise', () => {
  const project = { id: 'p-duration', targetDurationSec: 60, learning: { decisions: [] }, scenes: [{ id: 's1', text: 'intro', durationSec: 5 }] };
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 5, afterDurationSec: 5, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 0, afterDurationSec: 5, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: 's1', beforeDurationSec: 5, afterDurationSec: Number.NaN, sceneIndex: 0 }), null);
  assert.equal(recordSceneDurationChange(project, { sceneId: '', beforeDurationSec: 5, afterDurationSec: 8, sceneIndex: 0 }), null);
  assert.equal(project.learning.decisions.length, 0);
});

test('subtitle-content stores one committed edit with text, forced break and card split structure', () => {
  const project = {
    id: 'p-subtitle',
    learning: { decisions: [] },
    scenes: [{
      id: 's1', text: 'scene body', durationSec: 12,
      subtitleText: 'これは字幕テストです。', imageAssetId: 'asset-1', narration: { audioData: 'audio' }
    }]
  };
  const finalText = 'これは字幕テストです。\nここは同じカードです。\n\nここから次のカードです。';
  project.scenes[0].subtitleText = finalText;
  const record = recordSubtitleContentChange(project, {
    sceneId: 's1',
    beforeText: 'これは字幕テストです。',
    afterText: finalText,
    sceneIndex: 0,
    maxCharsPerLine: 16,
    maxLines: 2
  }, {
    createId: () => 'decision-subtitle',
    now: () => '2026-09-01T16:00:00.000Z'
  });

  assert.equal(record.id, 'decision-subtitle');
  assert.equal(record.decisionType, 'subtitle-content');
  assert.equal(record.sceneId, 's1');
  assert.equal(record.proposal.text, 'これは字幕テストです。');
  assert.equal(record.proposal.cardCount, 1);
  assert.equal(record.proposal.forcedLineBreakCount, 0);
  assert.equal(record.finalDecision.text, finalText);
  assert.equal(record.finalDecision.cardCount, 2);
  assert.equal(record.finalDecision.forcedLineBreakCount, 1);
  assert.deepEqual(record.finalDecision.cards, ['これは字幕テストです。\nここは同じカードです。', 'ここから次のカードです。']);
  assert.equal(record.humanAction.type, 'edit-subtitle');
  assert.ok(record.humanAction.changeKinds.includes('text'));
  assert.ok(record.humanAction.changeKinds.includes('forced-line-break'));
  assert.ok(record.humanAction.changeKinds.includes('card-split'));
  assert.equal(record.context.screen, 'subtitle-editor');
  assert.equal(record.context.sceneText, 'scene body');
  assert.equal(record.context.durationSec, 12);
  assert.equal(record.context.maxCharsPerLine, 16);
  assert.equal(record.context.maxLines, 2);
  assert.equal(record.source.version, '0.3');
  assert.equal(project.learning.decisions.length, 1);
  assert.equal(project.scenes[0].text, 'scene body');
  assert.equal(project.scenes[0].durationSec, 12);
  assert.equal(project.scenes[0].imageAssetId, 'asset-1');
  assert.equal(project.scenes[0].narration.audioData, 'audio');
});

test('subtitle-content distinguishes a forced line break without treating it as text change', () => {
  const project = { id: 'p-subtitle', learning: { decisions: [] }, scenes: [{ id: 's1', text: 'ABCD', subtitleText: 'AB\nCD', durationSec: 5 }] };
  const record = recordSubtitleContentChange(project, {
    sceneId: 's1', beforeText: 'ABCD', afterText: 'AB\nCD', sceneIndex: 0
  });
  assert.deepEqual(record.humanAction.changeKinds, ['forced-line-break']);
  assert.equal(record.finalDecision.cardCount, 1);
  assert.equal(record.finalDecision.forcedLineBreakCount, 1);
});

test('subtitle-content treats the iPhone QA Japanese newline-only edit as layout-only', () => {
  const project = { id: 'p-subtitle', learning: { decisions: [] }, scenes: [{ id: 's1', text: 'これは元の文章です。', subtitleText: 'これは元の\n文章です。', durationSec: 5 }] };
  const record = recordSubtitleContentChange(project, {
    sceneId: 's1', beforeText: 'これは元の文章です。', afterText: 'これは元の\n文章です。', sceneIndex: 0
  });
  assert.ok(record);
  assert.deepEqual(record.humanAction.changeKinds, ['forced-line-break']);
  assert.equal(record.humanAction.changeKinds.includes('text'), false);
  assert.equal(project.learning.decisions.length, 1);
});

test('subtitle-content distinguishes card split and normalizes CRLF without duplicate noise', () => {
  const project = { id: 'p-subtitle', learning: { decisions: [] }, scenes: [{ id: 's1', text: 'line', subtitleText: '前半\n\n後半', durationSec: 5 }] };
  const record = recordSubtitleContentChange(project, {
    sceneId: 's1', beforeText: '前半\n後半', afterText: '前半\n\n後半', sceneIndex: 0
  });
  assert.ok(record.humanAction.changeKinds.includes('forced-line-break'));
  assert.ok(record.humanAction.changeKinds.includes('card-split'));
  assert.equal(record.finalDecision.cardCount, 2);
  assert.equal(record.finalDecision.forcedLineBreakCount, 0);

  const unchanged = recordSubtitleContentChange(project, {
    sceneId: 's1', beforeText: '前半\r\n\r\n後半', afterText: '前半\n\n後半', sceneIndex: 0
  });
  assert.equal(unchanged, null);
  assert.equal(project.learning.decisions.length, 1);
});

test('scene-image-selection records null to asset with scene context and no inferred rights', () => {
  const project = {
    id: 'p-image', platform: 'youtube-shorts', aspectRatio: '9:16', learning: { decisions: [] },
    mediaLibrary: [{ id: 'asset-a', type: 'image', data: imageData }],
    scenes: [{ id: 'scene-a', text: '採用する画像のシーン' }]
  };
  const record = recordSceneImageSelection(project, {
    sceneId: 'scene-a', beforeAssetId: null, afterAssetId: 'asset-a', sceneIndex: 0
  }, { createId: () => 'decision-image-a', now: () => '2026-09-04T00:00:00.000Z' });

  assert.equal(record.decisionType, 'scene-image-selection');
  assert.equal(record.sceneId, 'scene-a');
  assert.equal(record.context.sceneText, '採用する画像のシーン');
  assert.equal(record.context.sceneIndex, 0);
  assert.equal(record.context.platform, 'youtube-shorts');
  assert.equal(record.context.aspectRatio, '9:16');
  assert.deepEqual(record.proposal, { imageAssetId: null });
  assert.deepEqual(record.finalDecision, { imageAssetId: 'asset-a' });
  assert.deepEqual(record.assetIds, ['asset-a']);
  assert.deepEqual(record.rights, {});
  assert.equal(record.humanAction.type, 'select-image-asset');
  assert.equal(record.source.type, 'human');
  assert.equal(project.learning.decisions.length, 1);
});

test('scene-image-selection records asset replacement once and ignores the same asset', () => {
  const project = {
    id: 'p-image', learning: { decisions: [] },
    mediaLibrary: [
      { id: 'asset-a', type: 'image', data: imageData },
      { id: 'asset-b', type: 'image', data: imageData }
    ],
    scenes: [{ id: 'scene-a', text: 'scene', imageAssetId: 'asset-b' }]
  };
  const record = recordSceneImageSelection(project, {
    sceneId: 'scene-a', beforeAssetId: 'asset-a', afterAssetId: 'asset-b', sceneIndex: 0
  });
  assert.deepEqual(record.proposal, { imageAssetId: 'asset-a' });
  assert.deepEqual(record.finalDecision, { imageAssetId: 'asset-b' });
  assert.equal(recordSceneImageSelection(project, {
    sceneId: 'scene-a', beforeAssetId: 'asset-b', afterAssetId: 'asset-b', sceneIndex: 0
  }), null);
  assert.equal(project.learning.decisions.length, 1);
});

test('scene-image-selection filters invalid duplicate asset ids and only copies existing rights metadata', () => {
  const project = {
    id: 'p-image', learning: { decisions: [] },
    mediaLibrary: [
      { id: 'asset-a', type: 'image', data: imageData },
      { id: 'asset-b', type: 'image', data: imageData, license: 'CC BY', source: 'Example', rights: { attributionRequired: true } }
    ],
    scenes: [{ id: 'scene-a', text: 'scene' }]
  };
  const record = recordSceneImageSelection(project, {
    sceneId: 'scene-a', beforeAssetId: 'missing', afterAssetId: 'asset-b', sceneIndex: 0,
    candidateAssetIds: [null, 'asset-a', 'asset-a', 'missing', 'asset-b']
  });
  assert.deepEqual(record.alternatives, [{ imageAssetId: 'asset-a' }]);
  assert.deepEqual(record.assetIds, ['asset-b', 'asset-a']);
  assert.deepEqual(record.rights, { attributionRequired: true, license: 'CC BY', source: 'Example' });
});

test('scene-motion records one human motion selection with scene context', () => {
  const project = {
    id: 'p-motion', schemaVersion: 4, platform: 'youtube-shorts', aspectRatio: '9:16', learning: { decisions: [] },
    scenes: [{ id: 'scene-motion', text: '動きを選ぶシーン', durationSec: 6, motion: 'zoom-out' }]
  };
  const record = recordSceneMotionChange(project, {
    sceneId: 'scene-motion', beforeMotion: 'zoom-in', afterMotion: 'zoom-out', sceneIndex: 0
  }, { createId: () => 'decision-motion', now: () => '2026-09-04T12:00:00.000Z' });

  assert.equal(record.decisionType, 'scene-motion');
  assert.equal(record.sceneId, 'scene-motion');
  assert.equal(record.context.sceneText, '動きを選ぶシーン');
  assert.equal(record.context.sceneIndex, 0);
  assert.equal(record.context.durationSec, 6);
  assert.equal(record.context.platform, 'youtube-shorts');
  assert.equal(record.context.aspectRatio, '9:16');
  assert.deepEqual(record.proposal, { motion: 'zoom-in' });
  assert.deepEqual(record.finalDecision, { motion: 'zoom-out' });
  assert.deepEqual(record.alternatives, []);
  assert.deepEqual(record.assetIds, []);
  assert.deepEqual(record.rights, {});
  assert.deepEqual(record.humanAction, { type: 'select-scene-motion' });
  assert.deepEqual(record.source, { type: 'human', feature: 'scene-editor', version: '0.5' });
  assert.equal(record.timestamp, '2026-09-04T12:00:00.000Z');
  assert.equal(project.learning.decisions.length, 1);
  assert.equal(project.schemaVersion, 4);
});

test('scene-motion ignores the same motion value', () => {
  const project = {
    id: 'p-motion', learning: { decisions: [] },
    scenes: [{ id: 'scene-motion', text: '同値', durationSec: 5, motion: 'zoom-in' }]
  };
  const record = recordSceneMotionChange(project, {
    sceneId: 'scene-motion', beforeMotion: 'zoom-in', afterMotion: 'zoom-in', sceneIndex: 0
  });
  assert.equal(record, null);
  assert.equal(project.learning.decisions.length, 0);
});

test('scene-transition records fade to cut with scene context and valid image rights', () => {
  const project = {
    id: 'p-transition', schemaVersion: 4, platform: 'youtube-shorts', aspectRatio: '9:16', learning: { decisions: [] },
    mediaLibrary: [{
      id: 'asset-image', type: 'image', data: imageData,
      license: 'CC BY', rights: { attributionRequired: true }
    }],
    scenes: [{
      id: 'scene-transition', text: '切り替えを選ぶシーン', durationSec: 7,
      imageAssetId: 'asset-image', transition: 'cut'
    }]
  };
  const record = recordSceneTransitionChange(project, {
    sceneId: 'scene-transition', beforeTransition: 'fade', afterTransition: 'cut', sceneIndex: 0
  }, { createId: () => 'decision-transition', now: () => '2026-09-04T12:00:00.000Z' });

  assert.equal(record.decisionType, 'scene-transition');
  assert.equal(record.sceneId, 'scene-transition');
  assert.deepEqual(record.context, {
    sceneText: '切り替えを選ぶシーン', sceneIndex: 0, durationSec: 7,
    platform: 'youtube-shorts', aspectRatio: '9:16', imageAssetId: 'asset-image'
  });
  assert.deepEqual(record.proposal, { transition: 'fade' });
  assert.deepEqual(record.alternatives, []);
  assert.deepEqual(record.humanAction, { type: 'select-scene-transition' });
  assert.deepEqual(record.finalDecision, { transition: 'cut' });
  assert.deepEqual(record.source, { type: 'human', feature: 'scene-editor', version: '0.6' });
  assert.deepEqual(record.assetIds, ['asset-image']);
  assert.deepEqual(record.rights, { attributionRequired: true, license: 'CC BY' });
  assert.equal(record.timestamp, '2026-09-04T12:00:00.000Z');
  assert.equal(project.learning.decisions.length, 1);
  assert.equal(project.schemaVersion, 4);
});

test('scene-transition records cut to fade without invalid image metadata', () => {
  const project = {
    id: 'p-transition', platform: 'instagram-reels', aspectRatio: '9:16', learning: { decisions: [] },
    mediaLibrary: [{ id: 'not-an-image', type: 'video', data: 'data:video/mp4;base64,QQ==' }],
    scenes: [{ id: 'scene-transition', text: 'カットからフェード', durationSec: 4, imageAssetId: 'not-an-image' }]
  };
  const record = recordSceneTransitionChange(project, {
    sceneId: 'scene-transition', beforeTransition: 'cut', afterTransition: 'fade', sceneIndex: 0
  });

  assert.deepEqual(record.proposal, { transition: 'cut' });
  assert.deepEqual(record.finalDecision, { transition: 'fade' });
  assert.equal('imageAssetId' in record.context, false);
  assert.deepEqual(record.assetIds, []);
  assert.deepEqual(record.rights, {});
  assert.equal(project.learning.decisions.length, 1);
});

test('scene-transition ignores unchanged, invalid, or missing scene selections', () => {
  const project = {
    id: 'p-transition', learning: { decisions: [] },
    scenes: [{ id: 'scene-transition', text: '記録しない', durationSec: 5 }]
  };

  assert.equal(recordSceneTransitionChange(project, {
    sceneId: 'scene-transition', beforeTransition: 'fade', afterTransition: 'fade', sceneIndex: 0
  }), null);
  assert.equal(recordSceneTransitionChange(project, {
    sceneId: 'scene-transition', beforeTransition: 'none', afterTransition: 'cut', sceneIndex: 0
  }), null);
  assert.equal(recordSceneTransitionChange(project, {
    sceneId: 'scene-transition', beforeTransition: 'cut', afterTransition: 'wipe', sceneIndex: 0
  }), null);
  assert.equal(recordSceneTransitionChange(project, {
    sceneId: '', beforeTransition: 'fade', afterTransition: 'cut', sceneIndex: 0
  }), null);
  assert.equal(recordSceneTransitionChange(project, {
    sceneId: 'missing', beforeTransition: 'fade', afterTransition: 'cut', sceneIndex: 0
  }), null);
  assert.equal(project.learning.decisions.length, 0);
});

test('scene-transition treats an unset scene transition as the UI default fade before cut', () => {
  const project = {
    id: 'p-transition-default', learning: { decisions: [] },
    scenes: [{ id: 'scene-transition-default', text: '未設定の切り替え', durationSec: 5 }]
  };
  const scene = project.scenes[0];
  const before = scene.transition === 'cut' ? 'cut' : 'fade';
  const after = 'cut';
  scene.transition = after;
  const record = recordSceneTransitionChange(project, {
    sceneId: scene.id, beforeTransition: before, afterTransition: after, sceneIndex: 0
  });

  assert.deepEqual(record.proposal, { transition: 'fade' });
  assert.deepEqual(record.finalDecision, { transition: 'cut' });
  assert.equal(project.learning.decisions.length, 1);
});


test('scene-subtitle-position records inherit to override with normalized context', () => {
  const project = { id:'p', platform:'youtube-shorts', aspectRatio:'9:16', learning:{decisions:[]}, subtitleStyle:{position:'bottom',positionOffsetPercent:4}, output:{subtitlePosition:'top'}, scenes:[{id:'s1',text:'字幕位置',durationSec:6}] };
  const record=recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'inherit'},afterState:{mode:'override',position:'top',offsetPercent:0},sceneIndex:0},{createId:()=> 'd1',now:()=> '2026-09-04T13:00:00.000Z'});
  assert.equal(record.decisionType,'scene-subtitle-position');
  assert.deepEqual(record.proposal,{mode:'inherit',position:null,offsetPercent:null});
  assert.deepEqual(record.finalDecision,{mode:'override',position:'top',offsetPercent:0});
  assert.equal(record.context.sceneText,'字幕位置');
  assert.equal(record.context.sceneIndex,0);
  assert.equal(record.context.durationSec,6);
  assert.equal(record.context.globalSubtitlePosition,'bottom');
  assert.equal(record.context.globalSubtitleOffsetPercent,4);
  assert.deepEqual(record.humanAction,{type:'set-scene-subtitle-position'});
  assert.deepEqual(record.source,{type:'human',feature:'subtitle-editor',version:'0.7'});
});

test('scene-subtitle-position records override changes, inherit, offset normalization and reset', () => {
  const project={id:'p',learning:{decisions:[]},subtitleStyle:{position:'bottom'},scenes:[{id:'s1',text:'scene'}]};
  const moved=recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'override',position:'top',offsetPercent:0},afterState:{mode:'override',position:'center',offsetPercent:99},sceneIndex:0});
  const inherited=recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'override',position:'center',offsetPercent:5},afterState:{mode:'inherit'},sceneIndex:0});
  const reset=recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'override',position:'bottom',offsetPercent:5},afterState:{mode:'override',position:'bottom',offsetPercent:0},sceneIndex:0});
  assert.deepEqual(moved.finalDecision,{mode:'override',position:'center',offsetPercent:15});
  assert.deepEqual(inherited.finalDecision,{mode:'inherit',position:null,offsetPercent:null});
  assert.equal(reset.proposal.offsetPercent,5);
  assert.equal(reset.finalDecision.offsetPercent,0);
});

test('scene-subtitle-position ignores same, invalid, missing id and missing scene', () => {
  const project={id:'p',learning:{decisions:[]},scenes:[{id:'s1'}]};
  const same={mode:'override',position:'top',offsetPercent:0};
  assert.equal(recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:same,afterState:same,sceneIndex:0}),null);
  assert.equal(recordSceneSubtitlePositionChange(project,{sceneId:'s1',beforeState:{mode:'override',position:'wipe',offsetPercent:0},afterState:same,sceneIndex:0}),null);
  assert.equal(recordSceneSubtitlePositionChange(project,{sceneId:'',beforeState:{mode:'inherit'},afterState:same,sceneIndex:0}),null);
  assert.equal(recordSceneSubtitlePositionChange(project,{sceneId:'missing',beforeState:{mode:'inherit'},afterState:same,sceneIndex:0}),null);
  assert.equal(project.learning.decisions.length,0);
});

test('scene-subtitle-position global context falls back to output then bottom', () => {
  const a={id:'a',learning:{decisions:[]},subtitleStyle:{position:'invalid',positionOffsetPercent:-99},output:{subtitlePosition:'center'},scenes:[{id:'s'}]};
  const ar=recordSceneSubtitlePositionChange(a,{sceneId:'s',beforeState:{mode:'inherit'},afterState:{mode:'override',position:'top',offsetPercent:0},sceneIndex:0});
  assert.equal(ar.context.globalSubtitlePosition,'center');
  assert.equal(ar.context.globalSubtitleOffsetPercent,-15);
  const b={id:'b',learning:{decisions:[]},subtitleStyle:{position:'invalid'},output:{subtitlePosition:'invalid'},scenes:[{id:'s'}]};
  const br=recordSceneSubtitlePositionChange(b,{sceneId:'s',beforeState:{mode:'inherit'},afterState:{mode:'override',position:'top',offsetPercent:0},sceneIndex:0});
  assert.equal(br.context.globalSubtitlePosition,'bottom');
});

test('scene-subtitle-position snapshots scene state and only connects valid image rights', () => {
  const project={id:'p',learning:{decisions:[]},subtitleStyle:{position:'bottom'},mediaLibrary:[{id:'img',type:'image',data:imageData,license:'CC BY',rights:{attributionRequired:true}}],scenes:[{id:'s',text:'scene',imageAssetId:'img',subtitlePosition:'center',subtitlePositionOffsetPercent:3}]};
  assert.deepEqual(snapshotSceneSubtitlePosition(project.scenes[0]),{mode:'override',position:'center',offsetPercent:3});
  assert.deepEqual(snapshotSceneSubtitlePosition({}),{mode:'inherit',position:null,offsetPercent:null});
  assert.equal(snapshotSceneSubtitlePosition({subtitlePosition:'wipe'}),null);
  const record=recordSceneSubtitlePositionChange(project,{sceneId:'s',beforeState:{mode:'inherit'},afterState:snapshotSceneSubtitlePosition(project.scenes[0]),sceneIndex:0});
  assert.equal(record.context.imageAssetId,'img');
  assert.deepEqual(record.assetIds,['img']);
  assert.deepEqual(record.rights,{attributionRequired:true,license:'CC BY'});
});


test('global-subtitle-position records explicit global position with context', () => {
  const project={
    id:'p-global-subtitle',platform:'youtube-shorts',aspectRatio:'9:16',learning:{decisions:[]},
    subtitleStyle:{position:'top',positionOffsetPercent:2,preset:'minimal',enabled:true},
    scenes:[{id:'a'},{id:'b',subtitlePosition:'bottom'},{id:'c',subtitlePosition:'wipe'}]
  };
  const before=snapshotGlobalSubtitlePosition(project);
  project.subtitleStyle.position='center';
  project.subtitleStyle.positionOffsetPercent=-3;
  const after=snapshotGlobalSubtitlePosition(project);
  const record=recordGlobalSubtitlePositionChange(project,{beforeState:before,afterState:after},{createId:()=> 'd-global',now:()=> '2026-09-04T14:00:00.000Z'});
  assert.equal(record.decisionType,'global-subtitle-position');
  assert.equal(record.sceneId,'');
  assert.deepEqual(record.proposal,{position:'top',offsetPercent:2});
  assert.deepEqual(record.finalDecision,{position:'center',offsetPercent:-3});
  assert.deepEqual(record.humanAction,{type:'set-global-subtitle-position'});
  assert.deepEqual(record.source,{type:'human',feature:'subtitle-editor',version:'0.8'});
  assert.equal(record.context.platform,'youtube-shorts');
  assert.equal(record.context.aspectRatio,'9:16');
  assert.equal(record.context.subtitlePreset,'minimal');
  assert.equal(record.context.subtitleEnabled,true);
  assert.equal(record.context.sceneCount,3);
  assert.equal(record.context.sceneOverrideCount,1);
  assert.equal(record.context.inheritedSceneCount,2);
  assert.deepEqual(record.assetIds,[]);
  assert.deepEqual(record.rights,{});
});

test('global-subtitle-position normalizes offset and records reset', () => {
  const project={id:'p',learning:{decisions:[]},subtitleStyle:{position:'bottom',positionOffsetPercent:99},scenes:[]};
  const moved=recordGlobalSubtitlePositionChange(project,{beforeState:{position:'bottom',offsetPercent:99},afterState:{position:'top',offsetPercent:-99}});
  assert.deepEqual(moved.proposal,{position:'bottom',offsetPercent:15});
  assert.deepEqual(moved.finalDecision,{position:'top',offsetPercent:-15});
  const reset=recordGlobalSubtitlePositionChange(project,{beforeState:{position:'top',offsetPercent:-5},afterState:{position:'top',offsetPercent:0}});
  assert.equal(reset.proposal.offsetPercent,-5);
  assert.equal(reset.finalDecision.offsetPercent,0);
});

test('global-subtitle-position ignores same normalized state and invalid positions', () => {
  const project={id:'p',learning:{decisions:[]},subtitleStyle:{position:'bottom'},scenes:[]};
  assert.equal(recordGlobalSubtitlePositionChange(project,{beforeState:{position:'top',offsetPercent:99},afterState:{position:'top',offsetPercent:15}}),null);
  assert.equal(recordGlobalSubtitlePositionChange(project,{beforeState:{position:'wipe',offsetPercent:0},afterState:{position:'top',offsetPercent:0}}),null);
  assert.equal(recordGlobalSubtitlePositionChange(project,{beforeState:{position:'top',offsetPercent:0},afterState:{position:'invalid',offsetPercent:0}}),null);
  assert.equal(project.learning.decisions.length,0);
});

test('snapshotGlobalSubtitlePosition follows current visible global state', () => {
  const project={subtitleStyle:{position:'center',positionOffsetPercent:-99}};
  assert.deepEqual(snapshotGlobalSubtitlePosition(project),{position:'center',offsetPercent:-15});
  assert.equal(snapshotGlobalSubtitlePosition({subtitleStyle:{position:'wipe',positionOffsetPercent:0}}),null);
  assert.equal(snapshotGlobalSubtitlePosition({}),null);
});


test('subtitle-scene-sync records explicit sync-to-scene choice with context', () => {
  const subtitleTextAfter='新しい\n字幕\n\nカード';
  const sceneTextCandidate=normalizeSubtitleContentForSync(subtitleTextAfter);
  const project={
    id:'p-sync',platform:'youtube-shorts',aspectRatio:'9:16',learning:{decisions:[]},
    scenes:[{id:'s1',text:'旧本文',speechText:'旧本文',durationSec:5,narration:{audioData:'data:audio/wav;base64,QQ=='}}]
  };
  const record=recordSubtitleSceneSyncDecision(project,{
    sceneId:'s1',sceneIndex:0,sceneTextBefore:'旧本文',subtitleTextAfter,sceneTextCandidate,
    syncToScene:true,speechTextFollowsScene:true,hadNarration:true
  },{createId:()=> 'd-sync',now:()=> '2026-09-04T14:50:00.000Z'});
  assert.equal(record.decisionType,'subtitle-scene-sync');
  assert.equal(record.sceneId,'s1');
  assert.deepEqual(record.proposal,{syncToScene:false});
  assert.deepEqual(record.alternatives,[{syncToScene:true}]);
  assert.deepEqual(record.finalDecision,{syncToScene:true});
  assert.deepEqual(record.humanAction,{type:'choose-subtitle-scene-sync'});
  assert.deepEqual(record.source,{type:'human',feature:'subtitle-editor',version:'0.9'});
  assert.equal(record.context.sceneIndex,0);
  assert.equal(record.context.sceneTextBefore,'旧本文');
  assert.equal(record.context.subtitleTextAfter,subtitleTextAfter);
  assert.equal(record.context.sceneTextCandidate,'新しい字幕カード');
  assert.equal(record.context.durationSec,5);
  assert.equal(record.context.platform,'youtube-shorts');
  assert.equal(record.context.aspectRatio,'9:16');
  assert.equal(record.context.speechTextFollowsScene,true);
  assert.equal(record.context.hadNarration,true);
  assert.deepEqual(record.assetIds,[]);
  assert.deepEqual(record.rights,{});
});

test('subtitle-scene-sync records explicit subtitle-only choice even when final matches proposal', () => {
  const project={id:'p',learning:{decisions:[]},scenes:[{id:'s1',text:'旧本文',durationSec:4}]};
  const record=recordSubtitleSceneSyncDecision(project,{
    sceneId:'s1',sceneIndex:0,sceneTextBefore:'旧本文',subtitleTextAfter:'新本文',sceneTextCandidate:'新本文',
    syncToScene:false,speechTextFollowsScene:false,hadNarration:false
  });
  assert.deepEqual(record.proposal,{syncToScene:false});
  assert.deepEqual(record.finalDecision,{syncToScene:false});
  assert.equal(project.learning.decisions.length,1);
});

test('subtitle-scene-sync resolves Scene by id and preserves decision context flags', () => {
  const project={id:'p',platform:'instagram-reels',aspectRatio:'9:16',learning:{decisions:[]},scenes:[{id:'a'},{id:'b',durationSec:7}]};
  const record=recordSubtitleSceneSyncDecision(project,{
    sceneId:'b',sceneIndex:0,sceneTextBefore:'A',subtitleTextAfter:'B',sceneTextCandidate:'B',
    syncToScene:true,speechTextFollowsScene:false,hadNarration:false
  });
  assert.equal(record.context.sceneIndex,1);
  assert.equal(record.context.durationSec,7);
  assert.equal(record.context.speechTextFollowsScene,false);
  assert.equal(record.context.hadNarration,false);
});

test('subtitle-scene-sync ignores dismissed or invalid choices and missing Scene', () => {
  const project={id:'p',learning:{decisions:[]},scenes:[{id:'s1'}]};
  const base={sceneIndex:0,sceneTextBefore:'A',subtitleTextAfter:'B',sceneTextCandidate:'B',speechTextFollowsScene:true,hadNarration:false};
  assert.equal(recordSubtitleSceneSyncDecision(project,{...base,sceneId:'s1',syncToScene:'dismissed'}),null);
  assert.equal(recordSubtitleSceneSyncDecision(project,{...base,sceneId:'',syncToScene:true}),null);
  assert.equal(recordSubtitleSceneSyncDecision(project,{...base,sceneId:'missing',syncToScene:true}),null);
  assert.equal(project.learning.decisions.length,0);
});


test('bgm-volume records one committed volume decision with compact context', () => {
  const project={
    id:'p-bgm',platform:'youtube-shorts',aspectRatio:'9:16',learning:{decisions:[]},
    bgm:{source:'upload',category:'calm',volume:0.12,ducking:true,loop:true,audioData:'data:audio/wav;base64,QQ==',title:'secret title',fileName:'private.wav',license:'private license',credit:'private credit'},
    narration:{audioData:''},
    scenes:[{id:'s1',narration:{audioData:'data:audio/wav;base64,AA=='}},{id:'s2'}]
  };
  const record=recordBgmVolumeChange(project,{
    beforeVolume:0.12,afterVolume:0.2,bgmSource:'upload',bgmCategory:'history',ducking:false,loop:true
  },{createId:()=> 'd-bgm',now:()=> '2026-09-04T15:30:00.000Z'});
  assert.equal(record.decisionType,'bgm-volume');
  assert.equal(record.sceneId,'');
  assert.deepEqual(record.proposal,{volume:0.12});
  assert.deepEqual(record.finalDecision,{volume:0.2});
  assert.deepEqual(record.humanAction,{type:'set-bgm-volume'});
  assert.deepEqual(record.source,{type:'human',feature:'bgm-editor',version:'0.10'});
  assert.deepEqual(record.alternatives,[]);
  assert.deepEqual(record.assetIds,[]);
  assert.deepEqual(record.rights,{});
  assert.deepEqual(record.context,{
    platform:'youtube-shorts',aspectRatio:'9:16',bgmSource:'upload',bgmCategory:'history',
    hasBgmAudio:true,ducking:false,loop:true,sceneCount:2,hasNarration:true
  });
  const serialized=JSON.stringify(record);
  assert.equal(serialized.includes('secret title'),false);
  assert.equal(serialized.includes('private.wav'),false);
  assert.equal(serialized.includes('private license'),false);
  assert.equal(serialized.includes('private credit'),false);
  assert.equal(serialized.includes('data:audio'),false);
});

test('normalizeBgmVolume clamps and rounds to the visible 0.01 range', () => {
  assert.equal(normalizeBgmVolume(0),0);
  assert.equal(normalizeBgmVolume(0.5),0.5);
  assert.equal(normalizeBgmVolume(-1),0);
  assert.equal(normalizeBgmVolume(1),0.5);
  assert.equal(normalizeBgmVolume(0.126),0.13);
  assert.equal(normalizeBgmVolume('0.234'),0.23);
  assert.equal(normalizeBgmVolume('not-a-number'),null);
  assert.equal(normalizeBgmVolume(undefined),null);
});

test('bgm-volume ignores invalid and same normalized values without noise', () => {
  const project={id:'p',learning:{decisions:[]},bgm:{source:'none',volume:0.12},scenes:[]};
  assert.equal(recordBgmVolumeChange(project,{beforeVolume:0.12,afterVolume:0.124}),null);
  assert.equal(recordBgmVolumeChange(project,{beforeVolume:'bad',afterVolume:0.2}),null);
  assert.equal(recordBgmVolumeChange(project,{beforeVolume:0.2,afterVolume:Number.NaN}),null);
  assert.equal(project.learning.decisions.length,0);
});

test('bgm-volume falls back to project context and detects global narration', () => {
  const project={
    id:'p',platform:'instagram-reels',aspectRatio:'1:1',learning:{decisions:[]},
    bgm:{source:'free',category:'emotion',ducking:true,loop:false,audioData:''},
    narration:{audioData:'data:audio/wav;base64,AA=='},scenes:[{id:'s1'}]
  };
  const record=recordBgmVolumeChange(project,{beforeVolume:0,afterVolume:0.5});
  assert.equal(record.context.bgmSource,'free');
  assert.equal(record.context.bgmCategory,'emotion');
  assert.equal(record.context.hasBgmAudio,false);
  assert.equal(record.context.ducking,true);
  assert.equal(record.context.loop,false);
  assert.equal(record.context.sceneCount,1);
  assert.equal(record.context.hasNarration,true);
});


test('narration-voice records first Kokoro voice adoption without audio payload', () => {
  const project={id:'p-voice',platform:'youtube-shorts',aspectRatio:'9:16',learning:{decisions:[]},narration:{audioData:'',voiceId:'legacy-browser-voice'},scenes:[{id:'s1',narration:{audioData:'data:audio/wav;base64,AA=='}},{id:'s2'}]};
  const record=recordNarrationVoiceDecision(project,{beforeVoiceId:'legacy-browser-voice',afterVoiceId:'jf_alpha',generationMode:'scenes',hadProjectNarration:false,sceneNarrationCountBefore:1},{createId:()=> 'd-voice-1',now:()=> '2026-09-05T00:00:00.000Z'});
  assert.equal(record.decisionType,'narration-voice');
  assert.equal(record.sceneId,'');
  assert.deepEqual(record.proposal,{voiceId:null});
  assert.deepEqual(record.finalDecision,{voiceId:'jf_alpha'});
  assert.deepEqual(record.humanAction,{type:'choose-narration-voice',generationMode:'scenes'});
  assert.deepEqual(record.source,{type:'human',feature:'voice-lab',version:'0.11'});
  assert.equal(record.context.engine,'kokoro-js-jp');
  assert.equal(record.context.generationMode,'scenes');
  assert.equal(record.context.sceneCount,2);
  assert.equal(record.context.hadProjectNarration,false);
  assert.equal(record.context.sceneNarrationCountBefore,1);
  assert.equal(record.alternatives.length,4);
  assert.equal(record.alternatives.some(item=>item.voiceId==='jf_alpha'),false);
  assert.equal(JSON.stringify(record).includes('data:audio'),false);
});

test('narration-voice records a changed accepted voice in full mode', () => {
  const project={id:'p-voice',platform:'instagram-reels',aspectRatio:'1:1',learning:{decisions:[]},narration:{audioData:'data:audio/wav;base64,OLD',voiceId:'jf_alpha',fileName:'old.wav'},scenes:[{id:'s1'}]};
  const record=recordNarrationVoiceDecision(project,{beforeVoiceId:'jf_alpha',afterVoiceId:'jm_kumo',generationMode:'full',hadProjectNarration:true,sceneNarrationCountBefore:0});
  assert.deepEqual(record.proposal,{voiceId:'jf_alpha'});
  assert.deepEqual(record.finalDecision,{voiceId:'jm_kumo'});
  assert.equal(record.context.generationMode,'full');
  assert.equal(record.context.hadProjectNarration,true);
  assert.equal(record.alternatives.some(item=>item.voiceId==='jf_alpha'),true);
  assert.equal(record.alternatives.some(item=>item.voiceId==='jm_kumo'),false);
  const serialized=JSON.stringify(record);
  assert.equal(serialized.includes('OLD'),false);
  assert.equal(serialized.includes('old.wav'),false);
});

test('narration voice normalization only accepts current Kokoro Voice Lab ids', () => {
  for(const id of ['jf_alpha','jf_gongitsune','jf_nezumi','jf_tebukuro','jm_kumo']) assert.equal(normalizeNarrationVoiceId(id),id);
  assert.equal(normalizeNarrationVoiceId(''),null);
  assert.equal(normalizeNarrationVoiceId('legacy'),null);
  assert.equal(normalizeNarrationVoiceId(undefined),null);
});

test('narration-voice ignores same voice, invalid final voice and invalid generation mode', () => {
  const project={id:'p',learning:{decisions:[]},narration:{},scenes:[]};
  assert.equal(recordNarrationVoiceDecision(project,{beforeVoiceId:'jf_alpha',afterVoiceId:'jf_alpha',generationMode:'full'}),null);
  assert.equal(recordNarrationVoiceDecision(project,{beforeVoiceId:null,afterVoiceId:'invalid',generationMode:'full'}),null);
  assert.equal(recordNarrationVoiceDecision(project,{beforeVoiceId:null,afterVoiceId:'jf_alpha',generationMode:'preview'}),null);
  assert.equal(project.learning.decisions.length,0);
});
