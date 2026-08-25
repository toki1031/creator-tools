const BASE_RATIOS = Object.freeze({ top:0.20, center:0.50, bottom:0.82 });
const VALID_POSITIONS = new Set(Object.keys(BASE_RATIOS));

export function normalizeSubtitleOffset(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(15, Math.max(-15, Math.round(number))) : 0;
}

export function resolveEffectiveSubtitlePosition(scene, globalStyle = {}, globalOutputPosition) {
  const overridden = VALID_POSITIONS.has(scene?.subtitlePosition);
  if (overridden) return {
    position:scene.subtitlePosition,
    offsetPercent:normalizeSubtitleOffset(scene.subtitlePositionOffsetPercent),
    overridden:true
  };
  const globalPosition = VALID_POSITIONS.has(globalStyle?.position)
    ? globalStyle.position
    : VALID_POSITIONS.has(globalOutputPosition) ? globalOutputPosition : 'bottom';
  return {
    position:globalPosition,
    offsetPercent:normalizeSubtitleOffset(globalStyle?.positionOffsetPercent),
    overridden:false
  };
}

export function resolveSubtitleYRatio(position, offsetPercent, halfBoxRatio = 0, safeMarginRatio = 0.04) {
  const base = BASE_RATIOS[position] ?? BASE_RATIOS.bottom;
  const offset = normalizeSubtitleOffset(offsetPercent) / 100;
  const half = Math.max(0, Number(halfBoxRatio) || 0);
  const margin = Math.max(0, Number(safeMarginRatio) || 0);
  const min = Math.min(0.5, margin + half);
  const max = Math.max(0.5, 1 - margin - half);
  return Math.min(max, Math.max(min, base + offset));
}
