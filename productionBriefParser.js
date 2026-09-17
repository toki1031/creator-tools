const ASSET_TYPES = new Set(["historical-source", "ai-reconstruction", "modern-visual", "document", "other"]);

const emptyBrief = () => ({ objective: "", tone: "", globalRules: [], subtitleGuidance: [], narrationGuidance: [], bgmGuidance: [], seGuidance: [], sceneDirectives: [], qaCriteria: [] });
const clean = (value = "") => String(value).trim();
const linesOf = (value = "") => String(value).replace(/\r\n?/g, "\n").split("\n");
const bulletValue = (line) => clean(line).replace(/^[-*・]\s*/, "").replace(/^\d+[.)]\s*/, "");

const SECTION_ALIASES = [
  ["objective", /^(?:目的|objective)\s*[:：]?\s*(.*)$/i], ["tone", /^(?:トーン|tone)\s*[:：]?\s*(.*)$/i],
  ["globalRules", /^(?:全体ルール|global\s*rules?|禁止事項)\s*[:：]?\s*(.*)$/i], ["subtitleGuidance", /^(?:字幕(?:方針|ガイダンス)?|subtitle(?:\s*guidance)?)\s*[:：]?\s*(.*)$/i],
  ["narrationGuidance", /^(?:ナレーション(?:方針|ガイダンス)?|narration(?:\s*guidance)?)\s*[:：]?\s*(.*)$/i], ["bgmGuidance", /^(?:BGM(?:方針|ガイダンス)?|bgm(?:\s*guidance)?)\s*[:：]?\s*(.*)$/i],
  ["seGuidance", /^(?:SE(?:方針|ガイダンス)?|se(?:\s*guidance)?)\s*[:：]?\s*(.*)$/i], ["qaCriteria", /^(?:最終QA|QA(?:条件|基準|criteria)?)\s*[:：]?\s*(.*)$/i],
];
function detectSection(line) { const text = clean(line).replace(/^#{1,6}\s*/, ""); for (const [name, pattern] of SECTION_ALIASES) { const match = text.match(pattern); if (match) return { name, inline: clean(match[1]) }; } return null; }
function inferAssetType(text) { const value = text.toLowerCase(); const explicit = value.match(/asset\s*type\s*[:：]\s*([a-z-]+)/i)?.[1]; if (explicit && ASSET_TYPES.has(explicit)) return explicit; if (/実物|実際の.*史料|一次史料|historical[- ]source/.test(value)) return "historical-source"; if (/ai再現|ai[- ]reconstruction|再現場面|再現映像/.test(value)) return "ai-reconstruction"; if (/現代|modern[- ]visual/.test(value)) return "modern-visual"; if (/文書|書類|document/.test(value)) return "document"; return "other"; }
function isRule(line) { return /禁止|しない|使わない|描かない|作らない|扱わない|代用しない|避ける|不可|NG/i.test(line); }
function parseSceneBlock(sceneId, blockLines) {
  const body = blockLines.map(clean).filter(Boolean), joined = body.join("\n"), ruleLines = body.filter(isRule), rules = ruleLines.map(bulletValue);
  const purposeLine = body.find((line) => /^(?:目的|purpose)\s*[:：]/i.test(line));
  const motionLine = body.find((line) => /^(?:動き|motion(?:Guidance)?)\s*[:：]/i.test(line));
  const visualLines = body.filter((line) => line !== purposeLine && line !== motionLine && !ruleLines.includes(line) && !/^asset\s*type\s*[:：]/i.test(line));
  return { sceneId, visualDirection: visualLines.map(bulletValue).join("\n"), purpose: purposeLine ? clean(purposeLine.replace(/^[^:：]+[:：]\s*/, "")) : "", assetType: inferAssetType(joined), motionGuidance: motionLine ? clean(motionLine.replace(/^[^:：]+[:：]\s*/, "")) : "", rules };
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
