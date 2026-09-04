import { findMediaAsset, isImageDataUrl, normalizeMediaLibrary, resolveSceneImageSource } from './mediaLibrary.js';
import { normalizeLearningState } from './decisionLog.js';
import { normalizeAudioAssetId } from './audioAssetIdentity.js';

export const CURRENT_PROJECT_SCHEMA_VERSION = 4;
export const LARGE_BACKUP_WARNING_BYTES = 25 * 1024 * 1024;

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const GENRES = new Set(['great-person', 'education', 'fortune', 'bgm', 'other']);
const PLATFORMS = new Set(['youtube-shorts', 'instagram-reels', 'tiktok']);
const isRecord = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const stringOr = (value, fallback = '') => typeof value === 'string' ? value : fallback;
const finiteOr = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const booleanOr = (value, fallback) => typeof value === 'boolean' ? value : fallback;
const newId = (prefix, createId) => String(createId?.() || globalThis.crypto?.randomUUID?.() || `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`);

function safeClone(value, depth = 0) {
  if (depth > 40) throw new Error('バックアップの階層が深すぎます。');
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value;
  if (Array.isArray(value)) return value.map(item => safeClone(item, depth + 1));
  if (!isRecord(value)) return undefined;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key)) continue;
    const cloned = safeClone(item, depth + 1);
    if (cloned !== undefined) result[key] = cloned;
  }
  return result;
}

function cleanDataUrl(value, prefix, label, warnings) {
  if (value == null || value === '') return '';
  if (typeof value === 'string' && value.toLowerCase().startsWith(`data:${prefix}/`) && value.includes(',')) return value;
  warnings.push(`${label}を無効なデータとして除外しました。`);
  return '';
}

function normalizeNarration(value, warnings, label) {
  const source = isRecord(value) ? safeClone(value) : {};
  if (value != null && !isRecord(value)) warnings.push(`${label}の設定を安全な初期値へ補正しました。`);
  return {
    ...source,
    voiceURI:stringOr(source.voiceURI), rate:finiteOr(source.rate, .92), pitch:finiteOr(source.pitch, .94),
    volume:finiteOr(source.volume, 1), source:stringOr(source.source, 'browser'),
    audioData:cleanDataUrl(source.audioData, 'audio', `${label}音声`, warnings),
    fileName:stringOr(source.fileName), mimeType:stringOr(source.mimeType)
  };
}

function validateProjectShape(value) {
  if (!isRecord(value)) throw new Error('JSONのルートはプロジェクトオブジェクトである必要があります。');
  if (Object.hasOwn(value, 'scripts') && Object.hasOwn(value, 'subtitles') && !Object.hasOwn(value, 'displayScript')) {
    throw new Error('これは制作プランJSONです。プロジェクトバックアップJSONを選択してください。');
  }
  if (!Object.hasOwn(value, 'genre') || !Object.hasOwn(value, 'platform')) {
    throw new Error('これはプロジェクトバックアップJSONではありません。');
  }
  if (typeof value.title !== 'string' || !value.title.trim()) throw new Error('プロジェクト名がありません。');
  if (typeof value.genre !== 'string' || typeof value.platform !== 'string') throw new Error('ジャンルまたは投稿先の形式が不正です。');
  if (value.scenes != null && !Array.isArray(value.scenes)) throw new Error('scenesは配列である必要があります。');
  if (Array.isArray(value.scenes) && value.scenes.some(scene => !isRecord(scene))) throw new Error('scenesに不正なデータが含まれています。');
  for (const key of ['displayScript', 'speechScript']) if (value[key] != null && typeof value[key] !== 'string') throw new Error(`${key}は文字列である必要があります。`);
  for (const key of ['targetDurationSec', 'schemaVersion']) if (value[key] != null && !Number.isFinite(Number(value[key]))) throw new Error(`${key}は数値である必要があります。`);
  const version = value.schemaVersion == null ? 0 : Number(value.schemaVersion);
  if (version > CURRENT_PROJECT_SCHEMA_VERSION) throw new Error('このバックアップは現在のCreator OSより新しいバージョンです。');
  if (version < 0 || !Number.isInteger(version)) throw new Error('schemaVersionが不正です。');
}

export function parseProjectBackup(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('JSONファイルが空です。');
  let value;
  try { value = JSON.parse(text); }
  catch { throw new Error('JSONを解析できませんでした。ファイルが壊れていないか確認してください。'); }
  validateProjectShape(value);
  return value;
}

export function normalizeImportedProject(input, { createId } = {}) {
  validateProjectShape(input);
  const warnings = [];
  const fixes = [];
  const source = safeClone(input);
  const pronunciationDictionary = normalizeDictionary(input.pronunciationDictionary);
  delete source.pronunciationDictionary;
  const normalizedMedia = normalizeMediaLibrary(source.mediaLibrary, { createId });
  source.mediaLibrary = normalizedMedia.assets;
  warnings.push(...normalizedMedia.warnings);
  fixes.push(...normalizedMedia.fixes);
  const scenes = Array.isArray(source.scenes) ? source.scenes : [];
  if (!Array.isArray(input.scenes)) fixes.push('シーン配列を空の状態で補完');
  const usedSceneIds = new Set();
  source.scenes = scenes.map((item, index) => {
    const scene = safeClone(item);
    let id = typeof scene.id === 'string' && scene.id.trim() ? scene.id.trim() : '';
    if (!id || usedSceneIds.has(id)) {
      let attempts=0;
      do { id = attempts++ < 10 ? newId('scene', createId) : `scene-${Date.now()}-${index}-${attempts}`; } while (usedSceneIds.has(id));
      fixes.push(`シーン${index + 1}のIDを再発行`);
    }
    usedSceneIds.add(id);
    const durationSec = Math.max(1, finiteOr(scene.durationSec, 5));
    const subtitleStartSec = Math.min(durationSec, Math.max(0, finiteOr(scene.subtitleStartSec, 0)));
    const subtitleEndSec = Math.min(durationSec, Math.max(subtitleStartSec, finiteOr(scene.subtitleEndSec, durationSec)));
    const narration = isRecord(scene.narration) ? normalizeNarration(scene.narration, warnings, `シーン${index + 1}のナレーション`) : undefined;
    const subtitlePosition = ['top','center','bottom'].includes(scene.subtitlePosition) ? scene.subtitlePosition : undefined;
    const requestedImageAssetId = typeof scene.imageAssetId === 'string' ? scene.imageAssetId.trim() : '';
    const imageAssetId = requestedImageAssetId && findMediaAsset(source, requestedImageAssetId) ? requestedImageAssetId : '';
    if (requestedImageAssetId && !imageAssetId) warnings.push(`シーン${index + 1}の画像素材参照を無効なIDとして除外しました。`);
    delete scene.subtitlePosition;
    delete scene.subtitlePositionOffsetPercent;
    delete scene.imageAssetId;
    return {
      ...scene, id, order:index + 1, text:stringOr(scene.text), speechText:stringOr(scene.speechText, stringOr(scene.text)),
      durationSec, imageData:cleanDataUrl(scene.imageData, 'image', `シーン${index + 1}の画像`, warnings),
      videoData:cleanDataUrl(scene.videoData, 'video', `シーン${index + 1}の動画`, warnings),
      motion:stringOr(scene.motion, 'zoom-in'), transition:stringOr(scene.transition, 'fade'),
      subtitleText:stringOr(scene.subtitleText, stringOr(scene.text)), subtitleEnabled:booleanOr(scene.subtitleEnabled, true),
      subtitlePhraseSync:booleanOr(scene.subtitlePhraseSync, true), subtitleStartSec, subtitleEndSec,
      ...(imageAssetId ? { imageAssetId } : {}),
      ...(subtitlePosition ? { subtitlePosition, subtitlePositionOffsetPercent:Math.min(15, Math.max(-15, Math.round(finiteOr(item.subtitlePositionOffsetPercent, 0)))) } : {}),
      ...(narration ? { narration } : {})
    };
  });
  const narration = normalizeNarration(source.narration, warnings, '全体ナレーション');
  const bgmSource = isRecord(source.bgm) ? safeClone(source.bgm) : {};
  if (!isRecord(source.bgm)) fixes.push('BGM設定を補完');
  const requestedBgmAudioAssetId = stringOr(bgmSource.audioAssetId).trim();
  const bgmAudioAssetId = normalizeAudioAssetId(requestedBgmAudioAssetId);
  if (requestedBgmAudioAssetId && !bgmAudioAssetId) warnings.push('BGM音源IDを無効な値として除外しました。');
  const subtitleSource = isRecord(source.subtitleStyle) ? safeClone(source.subtitleStyle) : {};
  const offset = Math.min(15, Math.max(-15, Math.round(finiteOr(subtitleSource.positionOffsetPercent, 0))));
  const outputSource = isRecord(source.output) ? safeClone(source.output) : {};
  const publishSource = isRecord(source.publish) ? safeClone(source.publish) : {};
  source.narration = narration;
  source.bgm = {
    ...bgmSource, source:stringOr(bgmSource.source, 'none'), title:stringOr(bgmSource.title), category:stringOr(bgmSource.category, 'calm'),
    volume:finiteOr(bgmSource.volume, .12), ducking:booleanOr(bgmSource.ducking, true), fadeInSec:finiteOr(bgmSource.fadeInSec, 1),
    fadeOutSec:finiteOr(bgmSource.fadeOutSec, 2), loop:booleanOr(bgmSource.loop, true), license:stringOr(bgmSource.license),
    credit:stringOr(bgmSource.credit), audioData:cleanDataUrl(bgmSource.audioData, 'audio', 'BGM音源', warnings), fileName:stringOr(bgmSource.fileName),
    audioAssetId:bgmAudioAssetId
  };
  source.subtitleStyle = {
    ...subtitleSource, enabled:booleanOr(subtitleSource.enabled, true), preset:stringOr(subtitleSource.preset, 'standard'),
    fontSize:finiteOr(subtitleSource.fontSize, 54), position:['top','center','bottom'].includes(subtitleSource.position) ? subtitleSource.position : 'bottom',
    positionOffsetPercent:offset, maxCharsPerLine:finiteOr(subtitleSource.maxCharsPerLine, 16), maxLines:finiteOr(subtitleSource.maxLines, 2),
    textColor:stringOr(subtitleSource.textColor, '#ffffff'), outlineColor:stringOr(subtitleSource.outlineColor, '#000000'),
    outlineWidth:finiteOr(subtitleSource.outlineWidth, 4), backgroundEnabled:booleanOr(subtitleSource.backgroundEnabled, false),
    backgroundColor:stringOr(subtitleSource.backgroundColor, '#000000'), backgroundOpacity:finiteOr(subtitleSource.backgroundOpacity, .45), align:stringOr(subtitleSource.align, 'center')
  };
  source.output = {
    ...outputSource, width:finiteOr(outputSource.width, 1080), height:finiteOr(outputSource.height, 1920), fps:finiteOr(outputSource.fps, 30),
    format:stringOr(outputSource.format, 'mp4'), quality:stringOr(outputSource.quality, 'standard'), subtitles:booleanOr(outputSource.subtitles, source.subtitleStyle.enabled),
    subtitlePosition:['top','center','bottom'].includes(outputSource.subtitlePosition) ? outputSource.subtitlePosition : source.subtitleStyle.position,
    bgmEnabled:booleanOr(outputSource.bgmEnabled, true)
  };
  source.publish = {
    ...publishSource, title:stringOr(publishSource.title, source.title), description:stringOr(publishSource.description),
    tags:stringOr(publishSource.tags), thumbnailText:stringOr(publishSource.thumbnailText), visibility:stringOr(publishSource.visibility, 'private')
  };
  source.aiWorkspace = isRecord(source.aiWorkspace) ? source.aiWorkspace : {};
  source.promptProfile = isRecord(source.promptProfile) ? source.promptProfile : {};
  source.promptLibrary = Array.isArray(source.promptLibrary) ? source.promptLibrary : [];
  source.learning = normalizeLearningState(source.learning);
  source.displayScript = stringOr(source.displayScript);
  source.speechScript = stringOr(source.speechScript, source.displayScript);
  source.targetDurationSec = Math.max(5, finiteOr(source.targetDurationSec, 60));
  source.aspectRatio = stringOr(source.aspectRatio, '9:16');
  source.genre = GENRES.has(source.genre) ? source.genre : 'other';
  source.platform = PLATFORMS.has(source.platform) ? source.platform : 'youtube-shorts';
  source.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  delete source.finalReview;
  if (input.finalReview) fixes.push('最終確認済み状態を解除');
  if (input.schemaVersion == null) fixes.push('schemaVersionを現在仕様へ補完');
  if (!isRecord(input.subtitleStyle) || input.subtitleStyle.positionOffsetPercent == null) fixes.push('字幕上下微調整を0%で補完');
  return { project:source, pronunciationDictionary, sourceSchemaVersion:input.schemaVersion ?? '未設定', warnings, fixes };
}

export function createRestoredProject(normalizedProject, { title, createId, now = () => new Date().toISOString() } = {}) {
  const project = safeClone(normalizedProject);
  const restoredAt = now();
  const originalId=project.id;
  project.id = newId('project', createId);
  if(project.id===originalId) project.id=`${newId('project', createId)}-restored`;
  project.title = stringOr(title, `${stringOr(project.title, '無題のプロジェクト')}（復元）`).trim() || '無題のプロジェクト（復元）';
  project.createdAt = restoredAt;
  project.updatedAt = restoredAt;
  project.schemaVersion = CURRENT_PROJECT_SCHEMA_VERSION;
  delete project.finalReview;
  return project;
}

export function createProjectBackupPayload(project, pronunciationDictionary = []) {
  if (!isRecord(project)) throw new Error('バックアップ対象のプロジェクトがありません。');
  const payload = safeClone(project);
  payload.learning = normalizeLearningState(payload.learning);
  payload.pronunciationDictionary = normalizeDictionary(pronunciationDictionary);
  return payload;
}

export function summarizeProjectBackup(project, pronunciationDictionary = [], sourceSchemaVersion = project.schemaVersion ?? '未設定') {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  return {
    originalTitle:stringOr(project.title), schemaVersion:sourceSchemaVersion, sceneCount:scenes.length,
    imageCount:scenes.filter(scene => resolveSceneImageSource(project, scene).data).length, videoCount:scenes.filter(scene => scene.videoData).length,
    mediaLibraryCount:(Array.isArray(project.mediaLibrary) ? project.mediaLibrary : []).filter(asset => asset?.type === 'image' && isImageDataUrl(asset?.data)).length,
    subtitleCount:scenes.filter(scene => stringOr(scene.subtitleText).trim()).length,
    sceneNarrationCount:scenes.filter(scene => scene.narration?.audioData).length,
    hasNarration:Boolean(project.narration?.audioData), hasBgm:Boolean(project.bgm?.audioData),
    hasAiData:Boolean(Object.keys(project.aiWorkspace || {}).length || (project.promptLibrary || []).length),
    dictionaryCount:pronunciationDictionary.length
  };
}

export function normalizeDictionary(value) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map(item => ({ from:stringOr(item.from).trim(), to:stringOr(item.to).trim() })).filter(item => item.from && item.to);
}

export function mergePronunciationDictionaries(currentValue, importedValue) {
  const merged=normalizeDictionary(currentValue), imported=normalizeDictionary(importedValue), known=new Set(merged.map(item=>item.from));
  let added=0, skipped=0;
  imported.forEach(item=>{if(known.has(item.from)){skipped++;return;}known.add(item.from);merged.push(item);added++;});
  return { dictionary:merged, added, skipped };
}
