const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

function sceneDuration(scene) {
  return Math.max(0, Number(scene?.durationSec) || 0);
}

function sceneText(scene) {
  return String(scene?.subtitleText || scene?.text || '').trim();
}

function punctuationScore(text) {
  let score = 0;
  if (/[！？!?]/.test(text)) score += 12;
  if (/[。]/.test(text)) score += 4;
  if (/「|」|“|”/.test(text)) score += 3;
  return score;
}

function hookScore(text) {
  const hooks = ['実は', 'なぜ', 'しかし', 'ところが', '結論', '一番', '最大', '意外', '知らない', '驚', '失敗', '成功', '理由', '秘密', 'もし', 'たった', 'わずか'];
  return hooks.reduce((score, word) => score + (text.includes(word) ? 5 : 0), 0);
}

function densityScore(text, durationSec) {
  if (!durationSec) return 0;
  const charsPerSec = Array.from(text.replace(/\s/g, '')).length / durationSec;
  if (charsPerSec >= 4 && charsPerSec <= 9) return 16;
  if (charsPerSec >= 2.5 && charsPerSec < 11) return 10;
  if (charsPerSec > 0) return 4;
  return 0;
}

function durationFitScore(durationSec, targetSec) {
  const diff = Math.abs(durationSec - targetSec);
  return Math.max(0, 30 - diff * 1.1);
}

function buildCandidate(scenes, startIndex, endIndex, targetSec) {
  const selected = scenes.slice(startIndex, endIndex + 1);
  const durationSec = selected.reduce((sum, scene) => sum + sceneDuration(scene), 0);
  const text = selected.map(sceneText).filter(Boolean).join(' ');
  const reasons = [];
  let score = durationFitScore(durationSec, targetSec);

  const punct = punctuationScore(text);
  score += punct;
  if (punct >= 10) reasons.push('問い・強調表現があり、冒頭や締めに使いやすい');

  const hook = hookScore(text);
  score += Math.min(20, hook);
  if (hook > 0) reasons.push('続きを見たくなる語句を含む');

  const density = densityScore(text, durationSec);
  score += density;
  if (density >= 10) reasons.push('字幕・セリフ密度がShorts向き');

  if (durationSec >= 20 && durationSec <= 60) reasons.push(`${Math.round(durationSec)}秒でShortsに収めやすい`);
  if (selected.length >= 2 && selected.length <= 6) {
    score += 8;
    reasons.push(`${selected.length}シーンで展開に変化を付けやすい`);
  }

  return {
    startIndex,
    endIndex,
    sceneNumbers: selected.map((_, i) => startIndex + i + 1),
    durationSec,
    score: Math.round(clamp(score, 0, 100)),
    reasons: reasons.length ? reasons : ['既存Sceneのまとまりとして切り出しやすい'],
    previewText: text.slice(0, 120)
  };
}

export function extractShortsHighlights(project, { targetSec = 45, minSec = 15, maxSec = 60, limit = 5 } = {}) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  if (!scenes.length) return [];

  const candidates = [];
  for (let start = 0; start < scenes.length; start++) {
    let total = 0;
    for (let end = start; end < scenes.length; end++) {
      total += sceneDuration(scenes[end]);
      if (total > maxSec + 5) break;
      if (total >= minSec && total <= maxSec) candidates.push(buildCandidate(scenes, start, end, targetSec));
    }
  }

  return candidates
    .sort((a, b) => b.score - a.score || Math.abs(a.durationSec - targetSec) - Math.abs(b.durationSec - targetSec) || a.startIndex - b.startIndex)
    .filter((candidate, index, all) => all.findIndex(other => other.startIndex === candidate.startIndex && other.endIndex === candidate.endIndex) === index)
    .slice(0, Math.max(1, limit));
}
