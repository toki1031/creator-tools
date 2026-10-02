const ASSET_TYPES = new Set(["historical-source", "ai-reconstruction", "modern-visual", "document", "other"]);

const emptyBrief = () => ({ objective: "", tone: "", globalRules: [], subtitleGuidance: [], narrationGuidance: [], bgmGuidance: [], seGuidance: [], sceneDirectives: [], qaCriteria: [] });
const clean = (value = "") => String(value).trim();
const linesOf = (value = "") => String(value).replace(/\r\n?/g, "\n").split("\n");
const bulletValue = (line) => clean(line).replace(/^[-*・]\s*/, "").replace(/^\d+[.)]\s*/, "");
const round2 = (value) => Math.round(Number(value) * 100) / 100;

const SECTION_ALIASES = [
  ["objective", /^(?:目的|objective)(?:\s*[:：]\s*(.*)|\s*)$/i], ["tone", /^(?:トーン|tone)(?:\s*[:：]\s*(.*)|\s*)$/i],
  ["globalRules", /^(?:全体ルール|global\s*rules?|禁止事項)(?:\s*[:：]\s*(.*)|\s*)$/i], ["subtitleGuidance", /^(?:字幕(?:方針|ガイダンス)?|subtitle(?:\s*guidance)?)(?:\s*[:：]\s*(.*)|\s*)$/i],
  ["narrationGuidance", /^(?:ナレーション(?:方針|ガイダンス)?|narration(?:\s*guidance)?)(?:\s*[:：]\s*(.*)|\s*)$/i], ["bgmGuidance", /^(?:BGM(?:方針|ガイダンス)?|bgm(?:\s*guidance)?)(?:\s*[:：]\s*(.*)|\s*)$/i],
  ["seGuidance", /^(?:SE(?:方針|ガイダンス)?|se(?:\s*guidance)?)(?:\s*[:：]\s*(.*)|\s*)$/i], ["qaCriteria", /^(?:最終QA|QA(?:条件|基準|criteria)?)(?:\s*[:：]\s*(.*)|\s*)$/i],
];
const SCENE_FIELD_ALIASES = [
  ["narrationText", /^(?:ナレーション|セリフ|読み上げ|narration|speech)(?:\s*[:：]\s*(.*)|\s*)$/i],
  ["subtitleText", /^(?:字幕|subtitle)(?:\s*[:：]\s*(.*)|\s*)$/i],
  ["visualDirection", /^(?:映像|画|ビジュアル|visual(?:\s*direction)?)(?:\s*[:：]\s*(.*)|\s*)$/i],
];

function detectSection(line) { const text = clean(line).replace(/^#{1,6}\s*/, ""); for (const [name, pattern] of SECTION_ALIASES) { const match = text.match(pattern); if (match) return { name, inline: clean(match[1]) }; } return null; }
function detectExtendedGlobalSection(line) {
  const text=clean(line).replace(/^#{1,6}\s*/,"").replace(/^■\s*/,"");
  const mappings=[
    ["globalRules",/^(?:禁止事項|半自動素材制作ルール|半自動進行)(?:\s*[:：]\s*(.*)|\s*)$/i],
    ["subtitleGuidance",/^字幕(?:\s*[:：]\s*(.*)|\s*)$/i],
    ["narrationGuidance",/^ナレーション(?:方針|ガイダンス)?(?:\s*[:：]\s*(.*)|\s*)$/i],
    ["bgmGuidance",/^(?:音声・BGM|BGM(?:方針|ガイダンス)?)(?:\s*[:：]\s*(.*)|\s*)$/i],
    ["qaCriteria",/^(?:完成条件|最終チェック)(?:\s*[:：]\s*(.*)|\s*)$/i]
  ];
  for(const [name,pattern] of mappings){const match=text.match(pattern);if(match)return{name,inline:clean(match[1])};}
  if(/^映像モーション\s*[:：]?/i.test(text))return{name:"globalRules",inline:text};
  if(/^■/.test(clean(line))&&text)return{name:"globalRules",inline:text};
  return null;
}
function detectSceneField(line) { for (const [name, pattern] of SCENE_FIELD_ALIASES) { const match = clean(line).match(pattern); if (match) return { name, inline: clean(match[1]) }; } return null; }
function detectSceneEndingGlobalSection(line) {
  const text=clean(line).replace(/^#{1,6}\s*/,"");
  const bracket=text.match(/^【\s*(画像・映像方針|映像方針|ナレーション|字幕|BGM|最終確認|最終QA)\s*】\s*(.*)$/i);
  if(bracket){
    const key=bracket[1].toLowerCase();
    const name=/ナレーション/.test(key)?"narrationGuidance":/字幕/.test(key)?"subtitleGuidance":/bgm/i.test(key)?"bgmGuidance":/(最終確認|最終qa)/i.test(key)?"qaCriteria":"globalRules";
    return {name,inline:clean(bracket[2])};
  }
  const match=text.match(/^(?:最終QA|QA(?:条件|基準|criteria)?|完成条件|最終チェック)(?:\s*[:：]\s*(.*)|\s*)$/i);
  return match?{name:"qaCriteria",inline:clean(match[1])}:null;
}
function extractTargetedSceneGuidance(lines) {
  const kept = [], targeted = new Map();
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
    if (target && /^■/.test(line)) { target = ''; kept.push(rawLine); continue; }
    if (target) { if (line) targeted.get(target).push(line); continue; }
    kept.push(rawLine);
  }
  return { lines: kept, targeted };
}
function applyTargetedSceneGuidance(brief, targeted) {
  for (const [sceneId, rawLines] of targeted.entries()) {
    const directive = brief.sceneDirectives.find(item => item?.sceneId === sceneId);
    if (!directive) continue;
    const values = rawLines.map(bulletValue).filter(Boolean);
    const rules = values.filter(line => isRule(line) || /確認できない場合|代替せず|利用条件|出典/.test(line));
    const searchLines = values.filter(line => !rules.includes(line));
    if (searchLines.length) directive.searchHint = searchLines.join(' ');
    if (rules.length) directive.rules = [...new Set([...(directive.rules || []), ...rules])];
  }
}
export function inferAssetTypeFromText(text) { const value = text.toLowerCase().replace(/\s+/g, ' '); const explicit = value.match(/asset\s*type\s*[:：]\s*([a-z-]+)/i)?.[1]; if (explicit && ASSET_TYPES.has(explicit)) return explicit; if (/ai再現|ai[- ]reconstruction|再現場面|再現映像|再現イメージ/.test(value)) return "ai-reconstruction"; if (/現代|今日できる|会議|説明場面|modern[- ]visual/.test(value)) return "modern-visual"; if (/実物|実際の.*史料|一次史料|確認可能な実物史料|historical[- ]source/.test(value)) return "historical-source"; if (/文書|書類|document/.test(value)) return "document"; if (/クリミア戦争期|19世紀.*病院|軍病院|病院内.*ナイチンゲール|ナイチンゲール.*記録|統計資料|死亡記録.*分析|軍衛生改革/.test(value)) return "ai-reconstruction"; if (/締め|印象的な.*映像|シンプル.*映像/.test(value)) return "modern-visual"; return "other"; }
function isRule(line) { return /禁止|しない|使わない|描かない|作らない|扱わない|代用しない|避ける|不可|NG/i.test(line); }
export function splitVisualDirectionAndRules(value = "") {
  const text=clean(value);
  if(!text)return { visualDirection:"", rules:[] };
  const parts=(text.match(/[^。！？!?]+[。！？!?]?/g)||[text]).map(clean).filter(Boolean);
  const visualParts=[],rules=[];
  for(const part of parts){
    if(isRule(part))rules.push(part);
    else visualParts.push(part);
  }
  return { visualDirection:visualParts.join("").trim(), rules };
}
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
    if (!activeField && !detectedField && !/^(?:目的|purpose|動き|motion|asset\s*type)\s*[:：]/i.test(line)) {
      const value = bulletValue(line);
      if (value) {
        const split = splitVisualDirectionAndRules(value);
        if (split.visualDirection) fields.visualDirection.push(split.visualDirection);
        rules.push(...split.rules);
      }
      continue;
    }
    if (detectedField) {
      activeField = detectedField.name;
      if (detectedField.inline) {
        const value=bulletValue(detectedField.inline);
        if(activeField==="visualDirection"){
          const split=splitVisualDirectionAndRules(value);
          if(split.visualDirection)fields.visualDirection.push(split.visualDirection);
          rules.push(...split.rules);
        } else fields[activeField].push(value);
      }
      continue;
    }

    const value = bulletValue(line);
    if (!value) continue;
    if (activeField === "visualDirection") {
      const split=splitVisualDirectionAndRules(value);
      if(split.visualDirection)fields.visualDirection.push(split.visualDirection);
      rules.push(...split.rules);
      continue;
    }

    const bulletRule = /^[-*・]\s*/.test(line) && isRule(line);
    const productionRule = isRule(line) && activeField !== "narrationText" && activeField !== "subtitleText" && activeField !== "visualDirection";
    if (bulletRule) { rules.push(value); continue; }
    if (productionRule) {
      const split=splitVisualDirectionAndRules(value);
      if(split.visualDirection){
        fields.visualDirection.push(split.visualDirection);
        rules.push(...split.rules);
      } else rules.push(value);
      continue;
    }

    if (activeField === "visualDirection") {
      const split=splitVisualDirectionAndRules(value);
      if(split.visualDirection)fields.visualDirection.push(split.visualDirection);
      rules.push(...split.rules);
      continue;
    }
    if (activeField) fields[activeField].push(value);
    else fields.visualDirection.push(value); // Backward-compatible unlabeled Scene text stays a visual direction.
  }

  const result = {
    sceneId,
    visualDirection: fields.visualDirection.join("\n"),
    purpose,
    assetType: inferAssetTypeFromText([fields.visualDirection.join("\n"), purpose, fields.narrationText.join("\n")].filter(Boolean).join("\n")),
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
  const extracted = extractTargetedSceneGuidance(linesOf(input));
  const lines = extracted.lines; let section = null, currentScene = null, sceneLines = [];
  const flushScene = () => { if (!currentScene) return; brief.sceneDirectives.push(parseSceneBlock(currentScene, sceneLines)); currentScene = null; sceneLines = []; };
  for (const rawLine of lines) {
    const line = clean(rawLine); if (!line) continue;
    const sceneMatch = line.match(/^(?:#{1,6}\s*)?(?:Scene|シーン)\s*[-#]?\s*(\d+)\s*[:：-]?\s*(.*)$/i);
    if (sceneMatch) { flushScene(); section = null; currentScene = `scene-${Number(sceneMatch[1])}`; if (clean(sceneMatch[2])) sceneLines.push(sceneMatch[2]); continue; }
    const extendedGlobal = /^■/.test(line) ? detectExtendedGlobalSection(line) : null;
    if (extendedGlobal) { if (currentScene) flushScene(); section=extendedGlobal.name; if(extendedGlobal.inline) brief[section].push(extendedGlobal.inline); continue; }
    const sceneEndingGlobal=currentScene?detectSceneEndingGlobalSection(line):null;
    if(sceneEndingGlobal){
      flushScene();
      section=sceneEndingGlobal.name;
      if(sceneEndingGlobal.inline)brief[section].push(sceneEndingGlobal.inline);
      continue;
    }
    // Plain labels inside Scene blocks are scene-local unless they are explicit global production headings.
    if (currentScene && !/^#{1,6}\s*/.test(line)) { sceneLines.push(line); continue; }
    const detected = detectSection(line);
    if (detected) { flushScene(); section = detected.name; if (detected.inline) { if (section === "objective" || section === "tone") brief[section] = detected.inline; else brief[section].push(detected.inline); } continue; }
    if (currentScene) { sceneLines.push(line); continue; }
    if (!section) continue; const value = bulletValue(line); if (!value) continue;
    if (section === "objective" || section === "tone") brief[section] = brief[section] ? `${brief[section]}\n${value}` : value; else brief[section].push(value);
  }
  flushScene(); applyTargetedSceneGuidance(brief, extracted.targeted); return brief;
}
