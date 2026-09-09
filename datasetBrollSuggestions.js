const normalize = value => String(value ?? '').toLowerCase().normalize('NFKC').replace(/\s+/g, ' ').trim();

function grams(value) {
  const text = normalize(value).replace(/\s/g, '');
  const result = new Set();
  for (let i = 0; i < Math.max(0, text.length - 1); i++) result.add(text.slice(i, i + 2));
  return result;
}

function similarity(a, b) {
  const left = grams(a), right = grams(b);
  if (!left.size || !right.size) return 0;
  let hit = 0;
  for (const item of left) if (right.has(item)) hit++;
  return hit / Math.max(left.size, right.size);
}

function assetMetadata(asset) {
  if (!asset || typeof asset !== 'object') return null;
  const id = String(asset.id || '').trim();
  if (!id || asset.type !== 'image') return null;
  return {
    id,
    fileName: String(asset.fileName || asset.name || asset.title || '画像素材'),
    title: String(asset.title || ''),
    tags: Array.isArray(asset.tags) ? asset.tags.map(String).filter(Boolean) : String(asset.tags || '').split(',').map(v => v.trim()).filter(Boolean),
    note: String(asset.note || asset.description || ''),
    source: String(asset.source || asset.sourceName || '')
  };
}

function assetLabel(meta) {
  const parts = [meta?.title, ...(meta?.tags || []), meta?.note, meta?.fileName].map(normalize).filter(Boolean);
  return [...new Set(parts)].join('・');
}

export function collectImageSelectionEvidence(projects = []) {
  const evidence = [];
  for (const project of Array.isArray(projects) ? projects : []) {
    const assets = new Map((Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : []).map(asset => assetMetadata(asset)).filter(Boolean).map(meta => [meta.id, meta]));
    const decisions = Array.isArray(project?.learning?.decisions) ? project.learning.decisions : [];
    for (const decision of decisions) {
      if (decision?.decisionType !== 'scene-image-selection') continue;
      const selectedId = String(decision?.finalDecision?.imageAssetId || '').trim();
      const meta = assets.get(selectedId);
      const sceneText = String(decision?.context?.sceneText || '').trim();
      if (!selectedId || !meta || !sceneText) continue;
      evidence.push({
        projectId: String(project?.id || ''),
        projectTitle: String(project?.title || ''),
        sceneId: String(decision?.sceneId || ''),
        sceneText,
        platform: String(decision?.context?.platform || project?.platform || ''),
        aspectRatio: String(decision?.context?.aspectRatio || project?.aspectRatio || ''),
        asset: meta,
        timestamp: String(decision?.timestamp || '')
      });
    }
  }
  return evidence;
}

export function suggestBrollFromDataset(targetProject, targetScene, projects = [], { limit = 5 } = {}) {
  const targetText = [targetScene?.text, targetScene?.speechText, targetScene?.subtitleText].filter(Boolean).join(' ').trim();
  if (!targetText) return [];
  const currentAssets = new Map((Array.isArray(targetProject?.mediaLibrary) ? targetProject.mediaLibrary : []).map(asset => assetMetadata(asset)).filter(Boolean).map(meta => [meta.id, meta]));
  const evidence = collectImageSelectionEvidence(projects);
  return evidence
    .map(item => {
      let score = similarity(targetText, item.sceneText) * 100;
      if (item.platform && item.platform === targetProject?.platform) score += 6;
      if (item.aspectRatio && item.aspectRatio === targetProject?.aspectRatio) score += 4;
      const reusableAsset = currentAssets.get(item.asset.id) || null;
      if (reusableAsset) score += 10;
      return {
        score: Math.round(score),
        evidenceProjectId: item.projectId,
        evidenceProjectTitle: item.projectTitle,
        evidenceSceneId: item.sceneId,
        evidenceSceneText: item.sceneText,
        assetId: item.asset.id,
        assetLabel: assetLabel(item.asset) || item.asset.fileName,
        assetSource: item.asset.source,
        reusableInCurrentProject: Boolean(reusableAsset),
        reason: reusableAsset
          ? '似たSceneで過去に採用され、同じ素材がこのプロジェクトにもあります。'
          : '似たSceneで過去に採用されたB-rollの傾向です。素材そのものはコピーしません。'
      };
    })
    .filter(item => item.score >= 12)
    .sort((a, b) => b.score - a.score || b.evidenceSceneText.length - a.evidenceSceneText.length)
    .slice(0, Math.max(1, Number(limit) || 5));
}
