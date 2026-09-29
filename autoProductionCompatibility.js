import { inferAssetTypeFromText } from './productionBriefParser.js';

function clone(value) {
  if (value == null) return value;
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}
function clean(value = '') { return String(value ?? '').trim(); }
function isWorkflowMarkerOnly(value = '') {
  const compact = String(value ?? '').replace(/\s+/g, '');
  return Boolean(compact) && /^[↓→⇒⇩⇢⇣]+$/.test(compact);
}
function trimLeakedGlobalHeadings(value = '') {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  const index = lines.findIndex(line => /^■/.test(line.trim()));
  return { value: lines.slice(0, index >= 0 ? index : lines.length).join('\n').trim(), leaked: index >= 0 };
}
function normalizeDirection(direction = {}) {
  const next = { ...direction };
  const visual = trimLeakedGlobalHeadings(next.visualDirection);
  let changed = false;
  if (visual.value !== clean(next.visualDirection)) { next.visualDirection = visual.value; changed = true; }
  const rawType = clean(next.assetType);
  if (visual.leaked || !rawType || rawType === 'other') {
    const inferred = inferAssetTypeFromText([visual.value, clean(next.purpose)].filter(Boolean).join('\n'));
    if (inferred && inferred !== rawType) { next.assetType = inferred; changed = true; }
  }
  return { direction: next, changed };
}

export function normalizeLegacyAutoProductionProject(project) {
  if (!project || typeof project !== 'object' || project.autoProduction?.mode !== 'production-request') {
    return { project, changed: false, repairs: [] };
  }
  const next = clone(project);
  const repairs = [];
  const scenes = Array.isArray(next.scenes) ? next.scenes : [];
  for (const scene of scenes) {
    const normalized = normalizeDirection(scene.productionDirection || {});
    if (normalized.changed) {
      scene.productionDirection = normalized.direction;
      repairs.push(`${scene.id || 'scene'}:productionDirection`);
    }
    for (const key of ['text','speechText','subtitleText']) {
      if (isWorkflowMarkerOnly(scene[key])) {
        scene[key] = '';
        repairs.push(`${scene.id || 'scene'}:${key}`);
      }
    }
  }

  const brief = next.productionBrief;
  if (brief && typeof brief === 'object') {
    if (Array.isArray(brief.narrationGuidance)) {
      const filtered = brief.narrationGuidance.filter(item => !isWorkflowMarkerOnly(item));
      if (filtered.length !== brief.narrationGuidance.length) {
        brief.narrationGuidance = filtered;
        repairs.push('productionBrief:narrationGuidance');
      }
    }
    if (Array.isArray(brief.sceneDirectives)) {
      brief.sceneDirectives = brief.sceneDirectives.map(directive => {
        const normalized = normalizeDirection(directive || {});
        if (normalized.changed) repairs.push(`${directive?.sceneId || 'directive'}:brief`);
        return normalized.direction;
      });
    }
  }

  return { project: next, changed: repairs.length > 0, repairs };
}
