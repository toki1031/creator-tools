function clean(value = '') {
  return String(value ?? '').trim();
}

function list(value) {
  return Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
}

function evidence(candidate = {}) {
  const sourceUrl = clean(candidate.sourceUrl || candidate.sourcePage || candidate.pageUrl);
  return {
    sourceUrl,
    sourcePage: sourceUrl,
    previewUrl: clean(candidate.previewUrl || candidate.imageUrl || candidate.thumbnailUrl),
    provider: clean(candidate.provider),
    title: clean(candidate.title),
    rightsStatements: list(candidate.rightsStatements),
    rightsStatus: clean(candidate.rightsStatus),
    rightsCheck: candidate.rightsCheck && typeof candidate.rightsCheck === 'object'
      ? structuredClone(candidate.rightsCheck)
      : undefined,
    rights: clean(candidate.rights),
    rightsAdvisory: clean(candidate.rightsAdvisory),
    rightsUrl: clean(candidate.rightsUrl),
    license: clean(candidate.license),
    licenseUrl: clean(candidate.licenseUrl)
  };
}

export function buildAssetAdoptionPlan(scene, evaluatedCandidates) {
  const sceneId = clean(scene?.id);
  const order = Number(scene?.order) || 0;
  const entries = Array.isArray(evaluatedCandidates) ? evaluatedCandidates : [];
  const eligible = entries.filter((entry) => entry?.evaluation?.status === 'eligible');

  if (!sceneId) {
    return { sceneId: '', order, status: 'blocked', reason: 'Scene IDがありません', candidate: null };
  }

  if (eligible.length === 0) {
    const hasReview = entries.some((entry) => entry?.evaluation?.status === 'needs-review');
    return {
      sceneId,
      order,
      status: hasReview ? 'needs-review' : 'blocked',
      reason: hasReview ? '素材候補の追加確認が必要です' : '採用可能な素材候補がありません',
      candidate: null
    };
  }

  if (eligible.length > 1) {
    return {
      sceneId,
      order,
      status: 'needs-selection',
      reason: '複数の採用候補があります。自動で優劣を決めません',
      candidates: eligible.map((entry) => ({ ...evidence(entry.candidate), evaluation: { ...entry.evaluation } })),
      candidate: null
    };
  }

  const selected = eligible[0];
  return {
    sceneId,
    order,
    status: 'ready',
    reason: '',
    autoApply: selected.evaluation?.autoAdoptable === true,
    candidate: {
      ...evidence(selected.candidate),
      evaluation: { ...selected.evaluation }
    }
  };
}

export function buildAssetAdoptionPlans(sceneEntries) {
  if (!Array.isArray(sceneEntries)) return [];
  return sceneEntries.map((entry) => buildAssetAdoptionPlan(entry?.scene, entry?.evaluatedCandidates));
}
