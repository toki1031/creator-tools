const SPECS = {
  'scene-motion-ai-feedback': {
    key: 'motion',
    labels: new Set(['none', 'zoom-in', 'zoom-out', 'pan-left', 'pan-right'])
  },
  'scene-transition-ai-feedback': {
    key: 'transition',
    labels: new Set(['fade', 'cut'])
  }
};

function text(value) {
  const result = String(value ?? '').trim();
  if (!result || result.startsWith('data:') || result.startsWith('blob:')) return '';
  return result;
}

function emptyTypeSummary(decisionType) {
  return {
    decisionType,
    totalRecords: 0,
    validRecords: 0,
    invalidRecords: 0,
    accepted: 0,
    corrected: 0,
    acceptanceRate: null,
    projects: 0,
    scenes: 0,
    proposalLabels: {},
    finalLabels: {},
    corrections: {}
  };
}

function increment(map, key) {
  map[key] = (map[key] || 0) + 1;
}

function summarizeType(records, decisionType) {
  const spec = SPECS[decisionType];
  const summary = emptyTypeSummary(decisionType);
  const projects = new Set();
  const scenes = new Set();

  for (const record of records) {
    if (record?.decisionType !== decisionType) continue;
    summary.totalRecords += 1;

    const projectId = text(record?.projectId);
    const sceneId = text(record?.sceneId);
    const proposal = text(record?.proposal?.[spec.key]);
    const finalDecision = text(record?.finalDecision?.[spec.key]);
    const action = text(record?.humanAction?.type);
    const validAction = action === 'accepted' || action === 'corrected';
    const consistentAction = validAction && ((proposal === finalDecision) === (action === 'accepted'));

    if (!projectId || !sceneId || !spec.labels.has(proposal) || !spec.labels.has(finalDecision) || !consistentAction) {
      summary.invalidRecords += 1;
      continue;
    }

    summary.validRecords += 1;
    summary[action] += 1;
    projects.add(projectId);
    scenes.add(`${projectId}:${sceneId}`);
    increment(summary.proposalLabels, proposal);
    increment(summary.finalLabels, finalDecision);
    if (action === 'corrected') increment(summary.corrections, `${proposal}->${finalDecision}`);
  }

  summary.projects = projects.size;
  summary.scenes = scenes.size;
  summary.acceptanceRate = summary.validRecords > 0 ? summary.accepted / summary.validRecords : null;
  return summary;
}

export function summarizeAiFeedbackLearning(records = []) {
  const safeRecords = Array.isArray(records) ? records : [];
  const motion = summarizeType(safeRecords, 'scene-motion-ai-feedback');
  const transition = summarizeType(safeRecords, 'scene-transition-ai-feedback');
  return {
    summaryVersion: '0.55',
    totalFeedbackRecords: motion.totalRecords + transition.totalRecords,
    validFeedbackRecords: motion.validRecords + transition.validRecords,
    invalidFeedbackRecords: motion.invalidRecords + transition.invalidRecords,
    feedbackTypes: {
      'scene-motion-ai-feedback': motion,
      'scene-transition-ai-feedback': transition
    }
  };
}
