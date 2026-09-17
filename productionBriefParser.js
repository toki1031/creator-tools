const ASSET_TYPES = new Set(["historical-source", "ai-reconstruction", "modern-visual", "document", "other"]);

const emptyBrief = () => ({ objective: "", tone: "", globalRules: [], subtitleGuidance: [], narrationGuidance: [], bgmGuidance: [], seGuidance: [], sceneDirectives: [], qaCriteria: [] });
const clean = (value = "") => String(value).trim();
const linesOf = (value = "") => String(value).replace(/\r\n?/g, "\n").split("\n");
const bulletValue = (line) => clean(line).replace(/^[-*・]\s*/, "").replace(/^\d+[.)]\s*/, "");
const round2 = (value) => Math.round(Number(value) * 100) / 100;

const SECTION_ALIASES = [
  ["objective", /^(?:目的|objective)\s*[:：]?\s*(.*)$/i], ["tone", /^(?:トーン|tone)\s*[:：]?\s*(.*)$/i],
  ["globalRules", /^(?:全体ルール|global\s*rules?|禁止事項)\s*[:：]?\s*(.*)$/i], ["subtitleGuidance", /^(?:字幕(?:方針|ガイダンス)?|subtitle(?:\s*guidance)?)\s*[:：]?\s*(.*)$/i],
  ["narrationGuidance", /^(?:ナレーション(?:方針|ガイダンス)?|narration(?:\s*guidance)?)\s*[:：]?\s*(.*)$/i], ["bgmGuidance", /^(?:BGM(?:方針|ガイダンス)?|bgm(?:\s*guidance)?)\s*[:：]?\s*(.*)$/i],
  ["seGuidance", /^(?:SE(?:方針|ガイダンス)?|se(?:\s*guidance)?)\s*[:：]?\s*(.*)$/i], ["qaCriteria", /^(?:最終QA|QA(?:条件|基準|criteria)?)\s*[:：]?\s*(.*)$/i],
];
const SCENE_FIELD_ALIASES = [
  ["narrationText", /^(?:ナレーション|セリフ|読み上げ|narration|speech)\s*[:：]?\s*(.*)$/i],
  ["subtitleText", /^(?:字幕|subtitle)\s*[:：]?\s*(.*)$/i],
  ["visualDirection", /^(?:映像|画|ビジュアル|visual(?:\s*direction)?)\s*[:：]?\s*(.*)$/i],
];

function detectSection(line) { const text = clean(line).replace(/^#{1,6}\s*/, ""); for (const [name, pattern] of SECTION_ALIASES) { const match = text.match(pattern); if (match) return { name, inline: clean(match[1]) }; } return null; }
function detectSceneField(line) { for (const [name, pattern] of SCENE_FIELD_ALIASES) { const match = clean(line).match(pattern); if (match) return { name, inline: clean(match[1]) }; } return null; }
function inferAssetType(text) { const value = text.toLowerCase(); const explicit = value.match(/asset\s*type\s*[:：]\s*([a-z-]+)/i)?.[1]; if (explicit && ASSET_TYPES.has(explicit)) return explicit; if (/実物|実際の.*史料|一次史料|historical[- ]source/.test(value)) return "historical-source"; if (/ai再現|ai[- ]reconstruction|再現場面|再現映像/.test(value)) return "ai-reconstruction"; if (/現代|modern[- ]visual/.test(value)) return "modern-visual"; if (/文書|書類|document/.test(value)) return "document"; return "other"; }
function isRule(line) { return /禁止|しない|使わない|描かない|作らない|扱わない|代用しない|避ける|不可|NG/i.test(line); }
function stripWrappingQuotes(value = "") {
  const text = clean(value);
  const pairs = [["「","」"],["『","』"],["“","”"],["\"","\""]];
  for (const [start, end] of pairs) if (text.startsWith(start) && text.endsWith(end) && text.length >= 2) return clean(text.slice(start.length, -end.length));
  return text;
}
function clockToSeconds(value = "") {
  const parts = clean(value).split(":").map(Number);
  if (parts.length < 2 || parts.length > 3 || parts.some(part => !Number.isFinite(part) || part < 0)) return null;
  if (parts.length === 2) return round2(parts[0] * 60 + parts[1]);
  return round2(parts[0] * 3600 + parts[1] * 60 + parts[2]);
}
function parseTimeRange(line) {
  const text = clean(line).replace(/^\|\s*/, "").replace(/^(?:時間|タイミング|time)\s*[:：]\s*/i, "");
  const match = text.match(/^(\d{1,2}:\d{2}(?:\.\d+)?)\s*(?:-|–|—|〜|～|~|→|to)\s*(\d{1,2}:\d{2}(?:\.\d+)?)$/i);
  if (!match) return null;
  const startSec = clockToSeconds(match[1]), endSec = clockToSeconds(match[2]);
  if (startSec === null || endSec === null || endSec <= startSec) return null;
  return { startSec, endSec, durationSec: round2(endSec - startSec) };
}
function parseDuration(line) {
  const match = clean(line).match(/^(?:尺|長さ|duration)\s*[:：]\s*(\d+(?:\.\d+)?)\s*(?:秒|s|sec(?:onds?)?)?$/i);
  if (!match) return null;
  const value = round2(Number(match[1]));
  return value > 0 ? value : null;
}
function parseSceneBlock(sceneId, blockLines) {
  const body = blockLines.map(clean).filter(Boolean), joined = body.join("\n");
  const fields = { narrationText: [], subtitleText: [], visualDirection: [] };
  const rules = [];
  let purpose = "", motionGuidance = "", activeField = null, startSec, endSec, durationSec;

  for (const line of body) {
    const timeRange = parseTimeRange(line);
    if (timeRange) { ({ startSec, endSec, durationSec } = timeRange); activeField = null; continue; }
    const explicitDuration = parseDuration(line);
    if (explicitDuration !== null) { durationSec = explicitDuration; activeField = null; continue; }

    const purposeMatch = line.match(/^(?:目的|purpose)\s*[:：]\s*(.*)$/i);
    if (purposeMatch) { purpose = clean(purposeMatch[1]); activeField = null; continue; }
    const motionMatch = line.match(/^(?:動き|motion(?:Guidance)?)\s*[:：]\s*(.*)$/i);
    if (motionMatch) { motionGuidance = clean(motionMatch[1]); activeField = null; continue; }
    if (/^asset\s*type\s*[:：]/i.test(line)) { activeField = null; continue; }

    const detectedField = detectSceneField(line);
    if (detectedField) {
      activeField = detectedField.name;
      if (detectedField.inline) fields[activeField].push(bulletValue(detectedField.inline));
      continue;
    }

    const bulletRule = /^[-*・]\s*/.test(line) && isRule(line);
    const productionRule = isRule(line) && activeField !== "narrationText" && activeField !== "subtitleText";
    if (bulletRule || productionRule) { rules.push(bulletValue(line)); continue; }

    const value = bulletValue(line);
    if (!value) continue;
    if (activeField) fields[activeField].push(value);
    else fields.visualDirection.push(value); // Backward-compatible unlabeled Scene text stays a visual direction.
  }

  const result = {
    sceneId,
    visualDirection: fields.visualDirection.join("\n"),
    purpose,
    assetType: inferAssetType(joined),
    motionGuidance,
    rules,
    narrationText: stripWrappingQuotes(fields.narrationText.join("\n")),
    subtitleText: stripWrappingQuotes(fields.subtitleText.join("\n")),
  };
  if (Number.isFinite(startSec)) result.startSec = startSec;
  if (Number.isFinite(endSec)) result.endSec = endSec;
  if (Number.isFinite(durationSec) && durationSec > 0) result.durationSec = durationSec;
  return result;
}
export function parseProductionRequest(input) {
  const brief = emptyBrief(); if (typeof input !== "string" || !input.trim()) return brief;
  const lines = linesOf(input); let section = null, currentScene = null, sceneLines = [];
  const flushScene = () => { if (!currentScene) return; brief.sceneDirectives.push(parseSceneBlock(currentScene, sceneLines)); currentScene = null; sceneLines = []; };
  for (const rawLine of lines) {
    const line = clean(rawLine); if (!line) continue;
    const sceneMatch = line.match(/^(?:#{1,6}\s*)?(?:Scene|シーン)\s*[-#]?\s*(\d+)\s*[:：-]?\s*(.*)$/i);
    if (sceneMatch) { flushScene(); section = null; currentScene = `scene-${Number(sceneMatch[1])}`; if (clean(sceneMatch[2])) sceneLines.push(sceneMatch[2]); continue; }
    // Plain labels inside Scene blocks are scene-local. A heading marker starts a global section.
    if (currentScene && !/^#{1,6}\s*/.test(line)) { sceneLines.push(line); continue; }
    const detected = detectSection(line);
    if (detected) { flushScene(); section = detected.name; if (detected.inline) { if (section === "objective" || section === "tone") brief[section] = detected.inline; else brief[section].push(detected.inline); } continue; }
    if (currentScene) { sceneLines.push(line); continue; }
    if (!section) continue; const value = bulletValue(line); if (!value) continue;
    if (section === "objective" || section === "tone") brief[section] = brief[section] ? `${brief[section]}\n${value}` : value; else brief[section].push(value);
  }
  flushScene(); return brief;
}
