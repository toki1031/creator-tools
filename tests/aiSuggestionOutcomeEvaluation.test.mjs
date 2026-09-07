import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateAiSuggestionOutcomes, evaluateCreatorAiSuggestions } from '../aiSuggestionOutcomeEvaluation.js';

function record(type, id, projectId, sceneId, label, text, index = 0) {
  const finalDecision = type === 'scene-motion' ? { motion: label } : { transition: label };
  return {
    id,
    decisionType: type,
    projectId,
    sceneId,
    context: { sceneText: text, sceneIndex: index, durationSec: 4, platform: 'youtube', aspectRatio: '9:16' },
    proposal: {},
    finalDecision,
    humanAction: { type: 'change' },
    source: { type: 'human', feature: 'scene-editor', version: 'test' },
    timestamp: '2026-09-07T00:00:00.000Z'
  };
}

function feedback(type, id, projectId, sceneId, suggested, finalValue, action, text, index = 0) {
  const motion = type === 'scene-motion-ai-feedback';
  return {
    id,
    decisionType: type,
    projectId,
    sceneId,
    context: { sceneText: text, sceneIndex: index, durationSec: 4, platform: 'youtube', aspectRatio: '9:16' },
    proposal: motion ? { motion: suggested } : { transition: suggested },
    finalDecision: motion ? { motion: finalValue } : { transition: finalValue },
    humanAction: { type: action },
    source: { type: 'human', feature: type, version: 'test' },
    timestamp: '2026-09-07T00:00:00.000Z'
  };
}

const motion = [
  record('scene-motion', 'm1', 'p1', 's1', 'zoom-in', '人物に寄る'),
  record('scene-motion', 'm2', 'p2', 's2', 'zoom-in', '人物を強調'),
  record('scene-motion', 'm3', 'p3', 's3', 'none', '静かな場面'),
  record('scene-motion', 'm4', 'p4', 's4', 'none', '落ち着いた場面')
];

const transition = [
  record('scene-transition', 't1', 'p1', 's1', 'fade', '静かに移る'),
  record('scene-transition', 't2', 'p2', 's2', 'fade', '余韻を残す'),
  record('scene-transition', 't3', 'p3', 's3', 'cut', 'テンポよく切る'),
  record('scene-transition', 't4', 'p4', 's4', 'cut', '場面を切り替える')
];

test('evaluates motion outcomes without training on the same project', () => {
  const result = evaluateAiSuggestionOutcomes(motion, 'scene-motion');
  assert.equal(result.evaluationVersion, '0.58');
  assert.equal(result.totalExamples, 4);
  assert.equal(result.evaluated + result.skipped, 4);
  assert.equal(result.matched + result.changed, result.evaluated);
  assert.ok(result.outcomes.every(outcome => ['matched', 'changed'].includes(outcome.outcome)));
});

test('evaluates transition outcomes and combined report', () => {
  const combined = evaluateCreatorAiSuggestions([...motion, ...transition]);
  assert.equal(combined.evaluationVersion, '0.58');
  assert.equal(combined.transition.totalExamples, 4);
  assert.equal(combined.motion.totalExamples, 4);
  assert.equal(combined.transition.evaluated + combined.transition.skipped, 4);
});

test('includes distinct AI feedback in the evaluated training population', () => {
  const extra = feedback('scene-motion-ai-feedback', 'f1', 'p5', 's5', 'zoom-in', 'pan-left', 'corrected', '横へ動かす');
  const result = evaluateAiSuggestionOutcomes([...motion, extra], 'scene-motion');
  assert.equal(result.totalExamples, 5);
  assert.equal(result.evaluated + result.skipped, 5);
  assert.ok(result.outcomes.some(outcome => outcome.decisionId === 'f1') || result.skipped > 0);
});

test('does not double-evaluate feedback duplicated by the base human decision', () => {
  const base = record('scene-motion', 'm5', 'p5', 's5', 'pan-left', '同じ場面', 1);
  const duplicate = feedback('scene-motion-ai-feedback', 'f5', 'p5', 's5', 'zoom-in', 'pan-left', 'corrected', '同じ場面', 1);
  const result = evaluateAiSuggestionOutcomes([...motion, base, duplicate], 'scene-motion');
  assert.equal(result.totalExamples, 5);
});

test('returns unevaluable result for insufficient or unknown data', () => {
  const one = evaluateAiSuggestionOutcomes([motion[0]], 'scene-motion');
  assert.equal(one.evaluated, 0);
  assert.equal(one.skipped, 1);
  assert.equal(one.accuracy, null);
  const unknown = evaluateAiSuggestionOutcomes(motion, 'unknown');
  assert.equal(unknown.evaluated, 0);
  assert.equal(unknown.accuracy, null);
});

test('same-project-only records are skipped to prevent leakage', () => {
  const sameProject = [
    record('scene-transition', 'x1', 'p1', 's1', 'fade', 'a'),
    record('scene-transition', 'x2', 'p1', 's2', 'cut', 'b')
  ];
  const result = evaluateAiSuggestionOutcomes(sameProject, 'scene-transition');
  assert.equal(result.evaluated, 0);
  assert.equal(result.skipped, 2);
});
