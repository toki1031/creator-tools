import fs from 'node:fs';

function replaceOnce(text, before, after, label) {
  const index = text.indexOf(before);
  if (index < 0) throw new Error(`${label}: replacement target not found`);
  if (text.indexOf(before, index + before.length) >= 0) throw new Error(`${label}: replacement target is not unique`);
  return text.slice(0, index) + after + text.slice(index + before.length);
}

let main = fs.readFileSync('main.js', 'utf8');
main = replaceOnce(
  main,
  'import { applyDictionaryEntries, splitIntoScenes, splitSubtitleCards } from "./qualityLogic.js";\n',
  'import { applyDictionaryEntries, splitIntoScenes, splitSubtitleCards } from "./qualityLogic.js";\nimport { ensureLearningState, moveSceneWithDecision } from "./decisionLog.js";\n',
  'main import'
);
main = replaceOnce(
  main,
  'function ensureProjectSettings(project) {\n  ensureMediaLibrary(project);\n',
  'function ensureProjectSettings(project) {\n  ensureMediaLibrary(project);\n  ensureLearningState(project);\n',
  'learning fallback'
);
main = replaceOnce(
  main,
  '    root.querySelectorAll("[data-up]").forEach(el=>el.onclick=()=>{const i=Number(el.dataset.up);[project.scenes[i-1],project.scenes[i]]=[project.scenes[i],project.scenes[i-1]];save();renderList();});\n    root.querySelectorAll("[data-down]").forEach(el=>el.onclick=()=>{const i=Number(el.dataset.down);[project.scenes[i+1],project.scenes[i]]=[project.scenes[i],project.scenes[i+1]];save();renderList();});\n',
  '    root.querySelectorAll("[data-up]").forEach(el=>el.onclick=()=>{const record=moveSceneWithDecision(project,Number(el.dataset.up),"up");if(!record)return;save();renderList();});\n    root.querySelectorAll("[data-down]").forEach(el=>el.onclick=()=>{const record=moveSceneWithDecision(project,Number(el.dataset.down),"down");if(!record)return;save();renderList();});\n',
  'scene move handlers'
);
fs.writeFileSync('main.js', main);

let backup = fs.readFileSync('projectBackup.js', 'utf8');
backup = replaceOnce(
  backup,
  "import { findMediaAsset, isImageDataUrl, normalizeMediaLibrary, resolveSceneImageSource } from './mediaLibrary.js';\n",
  "import { findMediaAsset, isImageDataUrl, normalizeMediaLibrary, resolveSceneImageSource } from './mediaLibrary.js';\nimport { normalizeLearningState } from './decisionLog.js';\n",
  'backup import'
);
backup = replaceOnce(
  backup,
  '  source.promptLibrary = Array.isArray(source.promptLibrary) ? source.promptLibrary : [];\n  source.displayScript = stringOr(source.displayScript);\n',
  '  source.promptLibrary = Array.isArray(source.promptLibrary) ? source.promptLibrary : [];\n  source.learning = normalizeLearningState(source.learning);\n  source.displayScript = stringOr(source.displayScript);\n',
  'backup learning normalize'
);
backup = replaceOnce(
  backup,
  '  const payload = safeClone(project);\n  payload.pronunciationDictionary = normalizeDictionary(pronunciationDictionary);\n',
  '  const payload = safeClone(project);\n  payload.learning = normalizeLearningState(payload.learning);\n  payload.pronunciationDictionary = normalizeDictionary(pronunciationDictionary);\n',
  'backup payload learning'
);
fs.writeFileSync('projectBackup.js', backup);

console.log('Dataset Capture v0.1 integration applied.');
