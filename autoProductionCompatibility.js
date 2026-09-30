import { inferAssetTypeFromText } from './productionBriefParser.js';
import { createProceduralBgmSettings } from './proceduralBgm.js';

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
function extractLeakedTargetedGuidance(value = '') {
  const lines = String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
  const targeted = new Map();
  let target = '';
  for (const rawLine of lines) {
    const line = clean(rawLine);
    const match = line.match(/^■\s*(?:Scene|シーン)\s*[-#]?\s*(\d+)\s*(?:の[^:：]*)?\s*[:：]?\s*(.*)$/i);
    if (match) {
      target = `scene-${Number(match[1])}`;
      if (!targeted.has(target)) targeted.set(target, []);
      const inline = clean(match[2]);
      if (inline) targeted.get(target).push(inline);
      continue;
    }
    if (target && /^■/.test(line)) { target = ''; continue; }
    if (target && line) targeted.get(target).push(line);
  }
  return targeted;
}
function applyRecoveredTargetedGuidance(direction = {}, values = []) {
  if (!values.length) return { direction, changed: false };
  const next = { ...direction };
  const rules = values.filter(line => /禁止|しない|使わない|描かない|作らない|扱わない|代用しない|避ける|不可|NG|確認できない場合|代替せず|利用条件|出典/i.test(line));
  const searchLines = values.filter(line => !rules.includes(line));
  let changed = false;
  if (!clean(next.searchHint) && searchLines.length) { next.searchHint = searchLines.join(' '); changed = true; }
  if (rules.length) {
    const merged = [...new Set([...(Array.isArray(next.rules) ? next.rules : []), ...rules])];
    if (JSON.stringify(merged) !== JSON.stringify(next.rules || [])) { next.rules = merged; changed = true; }
  }
  return { direction: next, changed };
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
  const recovered = new Map();
  const collectRecovered = direction => {
    for (const [sceneId, values] of extractLeakedTargetedGuidance(direction?.visualDirection).entries()) {
      const list = recovered.get(sceneId) || [];
      recovered.set(sceneId, [...new Set([...list, ...values])]);
    }
  };
  scenes.forEach(scene => collectRecovered(scene?.productionDirection));
  const sourceDirectives = Array.isArray(next.productionBrief?.sceneDirectives) ? next.productionBrief.sceneDirectives : [];
  sourceDirectives.forEach(collectRecovered);
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

  for (const scene of scenes) {
    const speech = clean(scene?.speechText);
    if (speech && !clean(scene?.subtitleText)) {
      scene.subtitleText = speech;
      repairs.push(`${scene.id || 'scene'}:subtitleFromSpeech`);
    }
    if (speech && !clean(scene?.text)) {
      scene.text = clean(scene.subtitleText) || speech;
      repairs.push(`${scene.id || 'scene'}:textFromSpeech`);
    }
  }

  const narrationScript = scenes.map(scene => clean(scene?.speechText)).filter(Boolean).join('\n\n');
  const displayScript = scenes.map(scene => clean(scene?.subtitleText || scene?.text || scene?.speechText)).filter(Boolean).join('\n\n');
  if (!clean(next.speechScript) && narrationScript) {
    next.speechScript = narrationScript;
    repairs.push('project:speechScriptFromScenes');
  }
  if (!clean(next.displayScript) && (displayScript || narrationScript)) {
    next.displayScript = displayScript || narrationScript;
    repairs.push('project:displayScriptFromScenes');
  }

  for (const scene of scenes) {
    const values = recovered.get(scene?.id) || [];
    if (!values.length) continue;
    const applied = applyRecoveredTargetedGuidance(scene.productionDirection || {}, values);
    if (applied.changed) { scene.productionDirection = applied.direction; repairs.push(`${scene.id}:targetedGuidance`); }
  }

  const brief = next.productionBrief;
  if (brief && typeof brief === 'object') {
    const existingBgmSource = clean(next.bgm?.source).toLowerCase();
    const hasExistingBgmAudio = Boolean(clean(next.bgm?.audioData));
    const canAdoptAutoBgm = !next.bgm || ((!existingBgmSource || existingBgmSource === 'none') && !hasExistingBgmAudio);
    if (canAdoptAutoBgm) {
      const autoBgm = createProceduralBgmSettings(brief.bgmGuidance);
      if (autoBgm) {
        next.bgm = autoBgm;
        repairs.push('productionBrief:bgmGuidance');
      }
    }
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
        let direction = normalized.direction;
        if (normalized.changed) repairs.push(`${directive?.sceneId || 'directive'}:brief`);
        const applied = applyRecoveredTargetedGuidance(direction, recovered.get(directive?.sceneId) || []);
        if (applied.changed) { direction = applied.direction; repairs.push(`${directive?.sceneId || 'directive'}:briefTargetedGuidance`); }
        return direction;
      });
    }
  }

  return { project: next, changed: repairs.length > 0, repairs };
}
