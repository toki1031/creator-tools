const DEFAULT_MOTIONS = new Set(['none','zoom-in','zoom-out','pan-left','pan-right']);

function clean(value = '') { return String(value ?? '').trim(); }
function sceneNumber(sceneId = '', fallback = 0) { const match = clean(sceneId).match(/(\d+)/); return match ? Number(match[1]) : fallback; }
function resolveMotion(guidance = '') {
  const value = clean(guidance).toLowerCase();
  if (/静か|固定|動かさない|none/.test(value)) return 'none';
  if (/zoom[- ]?out|ズームアウト/.test(value)) return 'zoom-out';
  if (/pan[- ]?left|左へ|左にパン/.test(value)) return 'pan-left';
  if (/pan[- ]?right|右へ|右にパン/.test(value)) return 'pan-right';
  if (/zoom[- ]?in|ズームイン/.test(value)) return 'zoom-in';
  return 'zoom-in';
}
function round2(value) { return Math.round(value * 100) / 100; }

/**
 * Converts an already-reviewed ProductionBrief into Creator OS runtime scenes.
 * This is intentionally pure: it never mutates an existing project or scene list.
 */
export function buildScenesFromProductionBrief(brief, options = {}) {
  const directives = Array.isArray(brief?.sceneDirectives) ? brief.sceneDirectives.filter(Boolean) : [];
  if (!directives.length) return [];
  const targetDurationSec = Math.max(5, Number(options.targetDurationSec) || 60);
  const durations = Array.isArray(options.sceneDurationsSec) ? options.sceneDurationsSec : [];
  const suppliedTotal = durations.slice(0, directives.length).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
  const equalDuration = round2(targetDurationSec / directives.length);

  return directives.map((directive, index) => {
    const explicitDuration = Math.max(0, Number(durations[index]) || 0);
    let durationSec = explicitDuration || equalDuration;
    if (suppliedTotal > 0 && explicitDuration > 0 && Math.abs(suppliedTotal - targetDurationSec) > 0.01) {
      durationSec = round2(explicitDuration * targetDurationSec / suppliedTotal);
    }
    const order = sceneNumber(directive.sceneId, index + 1) || index + 1;
    const text = clean(directive.purpose) || clean(directive.visualDirection);
    const motion = resolveMotion(directive.motionGuidance);
    return {
      id: clean(directive.sceneId) || `scene-${index + 1}`,
      order,
      text,
      speechText: text,
      durationSec,
      imageData: '',
      motion: DEFAULT_MOTIONS.has(motion) ? motion : 'zoom-in',
      transition: 'fade',
      productionDirection: {
        visualDirection: clean(directive.visualDirection),
        purpose: clean(directive.purpose),
        assetType: clean(directive.assetType) || 'other',
        motionGuidance: clean(directive.motionGuidance),
        rules: Array.isArray(directive.rules) ? directive.rules.map(clean).filter(Boolean) : []
      }
    };
  });
}

export function applyProductionBriefScenes(project, brief, options = {}) {
  if (!project || typeof project !== 'object') return project;
  const scenes = buildScenesFromProductionBrief(brief, { targetDurationSec: project.targetDurationSec, ...options });
  if (!scenes.length) return { ...project };
  return { ...project, productionBrief: brief, scenes };
}
