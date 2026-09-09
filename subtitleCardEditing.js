const normalize = value => String(value ?? '').replace(/\r\n?/g, '\n').trim();

export function readSubtitleCards(text = '') {
  const raw = normalize(text);
  if (!raw) return [];
  return raw.split(/\n\s*\n+/).map(card => card.trim()).filter(Boolean);
}

export function writeSubtitleCards(cards = []) {
  return (Array.isArray(cards) ? cards : [])
    .map(card => normalize(card))
    .filter(Boolean)
    .join('\n\n');
}

export function splitSubtitleCard(cards = [], index, offset) {
  const source = Array.isArray(cards) ? cards.map(card => normalize(card)) : [];
  const card = source[index];
  if (!card) return source;
  const chars = Array.from(card);
  const cut = Math.max(1, Math.min(chars.length - 1, Number(offset) || 0));
  if (chars.length < 2 || cut <= 0 || cut >= chars.length) return source;
  const left = chars.slice(0, cut).join('').trim();
  const right = chars.slice(cut).join('').trim();
  if (!left || !right) return source;
  return [...source.slice(0, index), left, right, ...source.slice(index + 1)];
}

export function splitSubtitleCardNaturally(cards = [], index) {
  const source = Array.isArray(cards) ? cards.map(card => normalize(card)) : [];
  const card = source[index];
  if (!card || Array.from(card).length < 2) return source;
  const chars = Array.from(card);
  const target = Math.floor(chars.length / 2);
  const punctuation = new Set(['、','。','，',',','！','!','？','?']);
  const candidates = [];
  chars.forEach((char, i) => {
    const cut = i + 1;
    if (punctuation.has(char) && cut > 0 && cut < chars.length) candidates.push(cut);
  });
  const cut = candidates.length
    ? candidates.reduce((best, value) => Math.abs(value - target) < Math.abs(best - target) ? value : best, candidates[0])
    : target;
  return splitSubtitleCard(source, index, cut);
}

export function mergeSubtitleCardWithNext(cards = [], index) {
  const source = Array.isArray(cards) ? cards.map(card => normalize(card)) : [];
  if (!source[index] || !source[index + 1]) return source;
  const merged = `${source[index]}${source[index + 1]}`.trim();
  return [...source.slice(0, index), merged, ...source.slice(index + 2)];
}

export function replaceSubtitleCard(cards = [], index, text = '') {
  const source = Array.isArray(cards) ? cards.map(card => normalize(card)) : [];
  if (index < 0 || index >= source.length) return source;
  const next = normalize(text);
  if (!next) return source;
  source[index] = next;
  return source;
}

export function subtitleCardTiming(sceneDurationSec, cardCount, index) {
  const duration = Math.max(0, Number(sceneDurationSec) || 0);
  const count = Math.max(1, Number(cardCount) || 1);
  const i = Math.max(0, Math.min(count - 1, Number(index) || 0));
  const startSec = duration * i / count;
  const endSec = duration * (i + 1) / count;
  return { startSec, endSec, durationSec: endSec - startSec };
}
