export function applyDictionaryEntries(text, entries = []) {
  return [...entries]
    .filter(item => item && item.from && item.to)
    .sort((a, b) => b.from.length - a.from.length)
    .reduce((result, item) => result.split(item.from).join(item.to), String(text ?? ''));
}

export function splitIntoScenes(text, targetDuration = 60) {
  const blocks = String(text ?? '').trim().split(/\n{2,}|(?<=[。！？])\s*/).map(x => x.trim()).filter(Boolean);
  if (!blocks.length) return [];
  const per = Math.max(2, Math.round(targetDuration / blocks.length));
  return blocks.map((sceneText, index) => ({
    id: globalThis.crypto?.randomUUID?.() || `scene-${Date.now()}-${index}`,
    order: index + 1,
    text: sceneText,
    speechText: sceneText,
    durationSec: per,
    imageData: '',
    motion: 'zoom-in',
    transition: 'fade'
  }));
}

export function splitSubtitleCards(value = '') {
  return String(value || '').replace(/\r\n?/g, '\n').trim().split(/\n\s*\n+/).map(card => card.trim()).filter(Boolean);
}

export function splitSubtitlePhrases(text, maxChars = 13) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return [];
  const manualBlocks = raw.split(/\n\s*\n+/).map(v => v.trim()).filter(Boolean);
  const hasManualBreak = /\n/.test(raw);

  const naturalSplit = value => {
    const normalized = String(value || '').replace(/[ \t]+/g, ' ').trim();
    if (!normalized) return [];
    const len = value => Array.from(value).length;
    const hardLimit = Math.max(maxChars + 6, Math.round(maxChars * 1.45));
    const minUseful = Math.max(4, Math.round(maxChars * .38));
    const particles = /^(?:は|が|を|に|へ|で|と|の|も|や|から|まで|より|って|ので|のに|なら|では|には|とは)/;
    const conjunctions = /^(?:しかし|でも|だから|そして|そこで|すると|つまり|一方|また|さらに|ただ|ところが|けれど|けれども|ですが|なので)/;
    const clauses = normalized.match(/[^。！？!?]+[。！？!?]?/g) || [normalized];
    const commaUnits = [];
    for (const clauseRaw of clauses) {
      const clause = clauseRaw.trim();
      if (!clause) continue;
      const units = clause.match(/[^、，,]+[、，,]?/g) || [clause];
      commaUnits.push(...units.map(x => x.trim()).filter(Boolean));
    }
    const semantic = [];
    for (const unit of commaUnits) {
      if (!semantic.length) { semantic.push(unit); continue; }
      const prev = semantic[semantic.length - 1];
      const combined = prev + unit;
      if (len(combined) <= hardLimit && (len(prev) < minUseful || len(unit) < minUseful || conjunctions.test(unit))) semantic[semantic.length - 1] = combined;
      else semantic.push(unit);
    }
    const splitLong = value => {
      if (len(value) <= hardLimit) return [value];
      const chars = Array.from(value);
      const candidates = [];
      const boundaryRe = /(?:から|まで|より|ので|のに|けれども|けれど|ですが|なので|なら|では|には|とは|って|は|が|を|に|へ|で|と|の|も|や)$/;
      for (let i = minUseful; i < chars.length - minUseful; i++) {
        const left = chars.slice(0, i).join('');
        const right = chars.slice(i).join('');
        if (boundaryRe.test(left) && !particles.test(right)) candidates.push(i);
      }
      const target = Math.min(maxChars, Math.round(chars.length / 2));
      let cut = candidates.length
        ? candidates.reduce((best, i) => Math.abs(i - target) < Math.abs(best - target) ? i : best, candidates[0])
        : Math.min(maxChars, chars.length - minUseful);
      while (cut < chars.length - minUseful && particles.test(chars.slice(cut).join(''))) cut++;
      return [chars.slice(0, cut).join(''), ...splitLong(chars.slice(cut).join(''))];
    };
    const phrases = semantic.flatMap(splitLong).map(x => x.trim()).filter(Boolean);
    const merged = [];
    for (const phrase of phrases) {
      if (merged.length && len(phrase) <= 3 && len(merged[merged.length - 1] + phrase) <= hardLimit) merged[merged.length - 1] += phrase;
      else merged.push(phrase);
    }
    if (merged.length > 1 && len(merged[merged.length - 1]) <= 3) merged[merged.length - 2] += merged.pop();
    return merged;
  };

  if (manualBlocks.length > 1) return manualBlocks.flatMap(block => block.includes('\n') ? [block] : naturalSplit(block));
  if (hasManualBreak) return [raw];
  return naturalSplit(raw);
}

export function calculateBgmLoopCount(videoDurationSec, bgmDurationSec, loopEnabled = true) {
  const videoDuration = Math.max(0, Number(videoDurationSec) || 0);
  const bgmDuration = Math.max(0, Number(bgmDurationSec) || 0);
  if (!videoDuration || !bgmDuration) return 0;
  if (!loopEnabled) return 1;
  return Math.max(1, Math.ceil(videoDuration / bgmDuration));
}
