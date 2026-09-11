import { resolveSceneImageSource } from './mediaLibrary.js';
import { resolveEffectiveSubtitlePosition, resolveSubtitleYRatio } from './subtitlePosition.js';
import { calculateBgmLoopCount, splitSubtitlePhrases } from './qualityLogic.js';

const MIME_CANDIDATES_AUDIO = [
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs="avc1.4D401E,mp4a.40.2"',
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];
const MIME_CANDIDATES_VIDEO = [
  'video/mp4;codecs="avc1.42E01E"',
  'video/mp4;codecs="avc1.4D401E"',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
];

export function getVideoCapabilities() {
  const hasRecorder = typeof MediaRecorder !== 'undefined';
  const hasCanvasCapture = typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  const supported = hasRecorder && hasCanvasCapture;
  const mp4 = supported && [...MIME_CANDIDATES_AUDIO, ...MIME_CANDIDATES_VIDEO].some(type => type.startsWith('video/mp4') && MediaRecorder.isTypeSupported(type));
  const webm = supported && [...MIME_CANDIDATES_AUDIO, ...MIME_CANDIDATES_VIDEO].some(type => type.startsWith('video/webm') && MediaRecorder.isTypeSupported(type));
  const h264Aac = supported && MIME_CANDIDATES_AUDIO.some(type => type.includes('avc1') && type.includes('mp4a') && MediaRecorder.isTypeSupported(type));
  const h264 = supported && MIME_CANDIDATES_VIDEO.some(type => type.includes('avc1') && MediaRecorder.isTypeSupported(type));
  return { supported, hasRecorder, hasCanvasCapture, mp4, webm, h264Aac, h264 };
}

export function getProjectDuration(project) {
  return (project.scenes || []).reduce((total, scene) => total + Math.max(0, Number(scene.durationSec) || 0), 0);
}

function bgmDataMime(project) {
  return String(project?.bgm?.audioData || '').match(/^data:([^;,]+)/)?.[1]?.toLowerCase() || '';
}

function bgmLooksLikeVideo(project) {
  const mime = bgmDataMime(project);
  const name = String(project?.bgm?.fileName || '').toLowerCase();
  return mime.startsWith('video/') || /\.(mov|mp4|m4v|avi|webm)$/.test(name);
}

function narrationDataMime(project) {
  return String(project?.narration?.audioData || '').match(/^data:([^;,]+)/)?.[1]?.toLowerCase() || String(project?.narration?.mimeType || '').toLowerCase();
}

function narrationLooksLikeVideo(project) {
  const mime = narrationDataMime(project);
  const name = String(project?.narration?.fileName || '').toLowerCase();
  return mime.startsWith('video/') || /\.(mov|mp4|m4v|avi|webm)$/.test(name);
}

export function validateVideoProject(project) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const errors = [];
  const warnings = [];
  if (!scenes.length) errors.push('シーンがありません。');
  const imageCount = scenes.filter(scene => resolveSceneImageSource(project, scene).data).length;
  if (imageCount < scenes.length) warnings.push(`画像未登録のシーンが${scenes.length - imageCount}件あります。背景色で代用します。`);
  if (getProjectDuration(project) <= 0) errors.push('動画の長さが0秒です。');
  if (project.output?.bgmEnabled && project.bgm?.source !== 'none' && !project.bgm?.audioData) warnings.push('BGM設定はありますが、音源ファイルが登録されていません。');
  const bgmInvalid = Boolean(project.output?.bgmEnabled && project.bgm?.audioData && bgmLooksLikeVideo(project));
  if (bgmInvalid) errors.push('現在のBGMはMOV / MP4などの動画ファイルです。BGM・字幕画面でMP3・M4A・AAC・WAVなどの音声ファイルを再登録してください。');
  const sceneNarrationCount = scenes.filter(scene => scene?.narration?.audioData).length;
  const narrationInvalid = Boolean(project.narration?.audioData && narrationLooksLikeVideo(project));
  if (narrationInvalid) errors.push('現在のナレーションは動画ファイルです。台本・音声画面でMP3・M4A・AAC・WAVなどの音声ファイルを再登録してください。');
  if (project.output?.subtitles && !scenes.some(scene => scene.subtitleEnabled !== false && String(scene.subtitleText || '').trim())) warnings.push('表示できる字幕がありません。');
  return { errors, warnings, imageCount, sceneCount: scenes.length, durationSec: getProjectDuration(project), bgmInvalid, narrationInvalid, sceneNarrationCount };
}

async function loadImageSafely(source, timeoutMs = 12000) {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    let settled = false;
    const finish = (value, error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      image.onload = null;
      image.onerror = null;
      error ? reject(error) : resolve(value);
    };
    const timer = setTimeout(() => finish(null, new Error('画像読み込みがタイムアウトしました。')), timeoutMs);
    image.onload = () => finish(image);
    image.onerror = () => finish(null, new Error('画像を読み込めませんでした。JPEGまたはPNGで再登録してください。'));
    image.src = source;
    if (image.complete && image.naturalWidth > 0) finish(image);
  });
}

async function loadPreparedImageAt(prepared, index) {
  const source = prepared?.imageSources?.[index];
  if (!source || prepared.images?.[index]) return prepared.images?.[index] || null;
  if (prepared.imageFailures?.some(item => item.index === index)) return null;
  prepared.imageLoadPromises ||= [];
  if (prepared.imageLoadPromises[index]) return await prepared.imageLoadPromises[index];
  prepared.imageLoadPromises[index] = loadImageSafely(source).then(image => {
    prepared.images[index] = image;
    return image;
  }).catch(error => {
    const message = error instanceof Error ? error.message : String(error);
    if (!prepared.imageFailures.some(item => item.index === index)) prepared.imageFailures.push({ index, message });
    console.warn(`Scene ${index + 1} image load failed`, error);
    return null;
  }).finally(() => { prepared.imageLoadPromises[index] = null; });
  return await prepared.imageLoadPromises[index];
}

export async function ensurePreparedImageWindow(project, prepared, index, { onStatus = () => {} } = {}) {
  if (!Array.isArray(prepared?.imageSources) || !Array.isArray(prepared?.images)) return;
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const current = Math.max(0, Math.min(scenes.length - 1, Number(index) || 0));
  if (!scenes.length) return;
  if (prepared.imageWindowIndex === current && prepared.images[current] !== undefined) return;
  prepared.imageWindowIndex = current;
  const keep = new Set([current, current + 1].filter(i => i >= 0 && i < scenes.length));
  for (let i = 0; i < prepared.images.length; i++) {
    if (!keep.has(i)) prepared.images[i] = null;
  }
  for (const target of keep) {
    if (!prepared.imageSources[target]) continue;
    onStatus(`シーン画像を準備しています… ${target + 1}/${scenes.length}`);
    await loadPreparedImageAt(prepared, target);
  }
}

export function releasePreparedImages(prepared) {
  if (!Array.isArray(prepared?.images)) return;
  prepared.images.fill(null);
  prepared.imageWindowIndex = -1;
}

export async function prepareVideoProject(project, { onStatus = () => {} } = {}) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const imageFailures = [];
  const imageSources = scenes.map(scene => resolveSceneImageSource(project, scene).data || '');
  const images = Array(scenes.length).fill(null);
  const imageLoadPromises = Array(scenes.length).fill(null);
  const imagePreparation = { imageSources, images, imageFailures, imageLoadPromises, imageWindowIndex: -1 };
  onStatus('先頭シーンの画像を準備しています…');
  if (scenes.length) await ensurePreparedImageWindow(project, imagePreparation, 0, { onStatus });

  let audioArrayBuffer = null;
  let audioMimeType = bgmDataMime(project);
  let audioFetchError = '';
  let audioInvalid = false;
  if (project.output?.bgmEnabled && project.bgm?.audioData) {
    onStatus('BGMファイルを確認しています…');
    if (bgmLooksLikeVideo(project)) {
      audioInvalid = true;
      onStatus('BGMが動画ファイルです。音声ファイルを再登録してください。');
    } else {
      try {
        const response = await fetch(project.bgm.audioData);
        if (!response.ok) throw new Error(`BGM取得エラー (${response.status})`);
        audioArrayBuffer = await response.arrayBuffer();
        audioMimeType = response.headers.get('content-type') || audioMimeType || '';
      } catch (error) {
        audioFetchError = error instanceof Error ? error.message : String(error);
        console.warn('BGM load failed', error);
      }
    }
  }

  const hasSceneNarrations = scenes.some(scene => scene?.narration?.audioData);
  let narrationArrayBuffer = null;
  let narrationMimeType = narrationDataMime(project);
  let narrationFetchError = '';
  let narrationInvalid = false;
  if (!hasSceneNarrations && project.narration?.audioData) {
    onStatus('ナレーション音声を確認しています…');
    if (narrationLooksLikeVideo(project)) {
      narrationInvalid = true;
      onStatus('ナレーションが動画ファイルです。音声ファイルを再登録してください。');
    } else {
      try {
        const response = await fetch(project.narration.audioData);
        if (!response.ok) throw new Error(`ナレーション取得エラー (${response.status})`);
        narrationArrayBuffer = await response.arrayBuffer();
        narrationMimeType = response.headers.get('content-type') || narrationMimeType || '';
      } catch (error) {
        narrationFetchError = error instanceof Error ? error.message : String(error);
        console.warn('Narration load failed', error);
      }
    }
  }

  const sceneNarrationSources = scenes.map(scene => {
    const n = scene?.narration;
    return n?.audioData ? { audioData: n.audioData, mimeType: n.mimeType || 'audio/wav', durationSec: Number(n.durationSec) || 0 } : null;
  });
  const sceneNarrations = sceneNarrationSources.map(item => item ? { arrayBuffer: true, lazy: true } : null);
  if (hasSceneNarrations) onStatus('シーン別ナレーションは再生直前に順番に読み込みます。');

  const loadedImageCount = imageSources.filter(Boolean).length;
  const notes = [];
  if (audioInvalid) notes.push('BGM形式エラー'); else if (audioFetchError) notes.push('BGM読込失敗');
  if (narrationInvalid) notes.push('ナレーション形式エラー'); else if (narrationFetchError) notes.push('ナレーション読込失敗');
  onStatus(`素材準備完了：画像 ${loadedImageCount}/${scenes.length}${notes.length ? `／${notes.join('／')}` : ''}`);
  return { images, imageSources, imageFailures, imageLoadPromises, imageWindowIndex: imagePreparation.imageWindowIndex, loadedImageCount, audioArrayBuffer, audioMimeType, audioFetchError, audioInvalid, narrationArrayBuffer, narrationMimeType, narrationFetchError, narrationInvalid, sceneNarrations, sceneNarrationSources };
}

function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
function lerp(start, end, progress) { return start + (end - start) * progress; }

function sceneMap(project) {
  let cursor = 0;
  return (project.scenes || []).map((scene, index) => {
    const duration = Math.max(0.05, Number(scene.durationSec) || 1);
    const item = { scene, index, start: cursor, end: cursor + duration, duration };
    cursor += duration;
    return item;
  });
}

function sceneAt(map, timeSec) {
  if (!map.length) return null;
  const time = clamp(timeSec, 0, Math.max(0, map[map.length - 1].end - 0.0001));
  return map.find(item => time >= item.start && time < item.end) || map[map.length - 1];
}

function drawCover(ctx, image, width, height, motion, progress, alpha = 1) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);
  if (!image) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, '#171d35');
    gradient.addColorStop(1, '#090d17');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
    return;
  }
  const base = Math.max(width / image.naturalWidth, height / image.naturalHeight);
  let zoom = 1;
  let moveX = 0;
  if (motion === 'zoom-in') zoom = lerp(1, 1.09, progress);
  else if (motion === 'zoom-out') zoom = lerp(1.09, 1, progress);
  else if (motion === 'pan-left') { zoom = 1.1; moveX = lerp(width * .045, -width * .045, progress); }
  else if (motion === 'pan-right') { zoom = 1.1; moveX = lerp(-width * .045, width * .045, progress); }
  const drawWidth = image.naturalWidth * base * zoom;
  const drawHeight = image.naturalHeight * base * zoom;
  ctx.drawImage(image, (width - drawWidth) / 2 + moveX, (height - drawHeight) / 2, drawWidth, drawHeight);
  ctx.restore();
}

function subtitleLines(text, maxChars = 16, maxLines = 2) {
  const raw = String(text || '').replace(/\r\n?/g, '\n').trim();
  if (!raw) return [];
  if (raw.includes('\n')) return raw.split('\n').map(v => v.trim()).filter(Boolean).slice(0, Math.max(1, maxLines));
  const result = [];
  const chars = Array.from(raw);
  while (chars.length) result.push(chars.splice(0, Math.max(1, maxChars)).join(''));
  return result.slice(0, Math.max(1, maxLines));
}

function activeSubtitlePhrase(scene, localTime, start, end, maxChars = 13) {
  const text = scene.subtitleText || scene.text || '';
  const phrases = splitSubtitlePhrases(text, maxChars);
  if (phrases.length <= 1 || scene.subtitlePhraseSync === false) return text;
  const span = Math.max(0.001, end - start);
  const weights = phrases.map(phrase => {
    const chars = Math.max(1, Array.from(phrase.replace(/\s/g, '')).length);
    const pause = /[。！？!?]$/.test(phrase) ? 4 : /[、，,]$/.test(phrase) ? 2 : 0;
    return chars + pause;
  });
  const total = weights.reduce((a, b) => a + b, 0) || 1;
  const position = clamp((localTime - start) / span, 0, 0.999999) * total;
  let cursor = 0;
  for (let i = 0; i < phrases.length; i++) {
    cursor += weights[i];
    if (position < cursor) return phrases[i];
  }
  return phrases[phrases.length - 1];
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function hexAlpha(hex, alpha) {
  const clean = String(hex || '#000000').replace('#', '');
  const normalized = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean.padEnd(6, '0').slice(0, 6);
  const value = Number.parseInt(normalized, 16);
  return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${clamp(Number(alpha) || 0, 0, 1)})`;
}

function drawSubtitle(ctx, project, item, localTime, width, height) {
  const style = project.subtitleStyle || {};
  const scene = item.scene;
  if (!project.output?.subtitles || style.enabled === false || scene.subtitleEnabled === false) return;
  const start = Math.max(0, Number(scene.subtitleStartSec) || 0);
  const end = Math.min(item.duration, Math.max(start, Number(scene.subtitleEndSec) || item.duration));
  if (localTime < start || localTime > end) return;
  const phraseText = activeSubtitlePhrase(scene, localTime, start, end, Math.min(14, Math.max(8, Number(style.maxCharsPerLine || 16))));
  const lines = subtitleLines(phraseText, style.maxCharsPerLine || 16, style.maxLines || 2);
  if (!lines.length) return;
  const scale = width / 1080;
  const fontSize = Math.max(18, Number(style.fontSize || 54) * scale);
  const lineHeight = fontSize * 1.35;
  const paddingX = fontSize * .5;
  const paddingY = fontSize * .28;
  const textAlign = style.align === 'left' || style.align === 'right' ? style.align : 'center';
  ctx.save();
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif`;
  ctx.textAlign = textAlign;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
  const boxWidth = Math.min(width * .9, widest + paddingX * 2);
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const boxLeft = (width - boxWidth) / 2;
  const effectivePosition = resolveEffectiveSubtitlePosition(scene, style, project.output?.subtitlePosition);
  const centerY = height * resolveSubtitleYRatio(effectivePosition.position, effectivePosition.offsetPercent, boxHeight / height / 2);
  const x = textAlign === 'left' ? boxLeft + paddingX : textAlign === 'right' ? boxLeft + boxWidth - paddingX : width / 2;
  const top = centerY - boxHeight / 2;
  if (style.backgroundEnabled) {
    ctx.fillStyle = hexAlpha(style.backgroundColor || '#000000', style.backgroundOpacity ?? .45);
    roundedRect(ctx, boxLeft, top, boxWidth, boxHeight, fontSize * .22);
    ctx.fill();
  }
  const outline = Math.max(0, Number(style.outlineWidth || 0) * scale);
  lines.forEach((line, index) => {
    const y = top + paddingY + lineHeight * (index + .5);
    if (outline > 0) {
      ctx.lineWidth = outline * 2;
      ctx.strokeStyle = style.outlineColor || '#000000';
      ctx.strokeText(line, x, y, width * .88);
    }
    ctx.fillStyle = style.textColor || '#ffffff';
    ctx.fillText(line, x, y, width * .88);
  });
  ctx.restore();
}

export function drawProjectFrame(project, prepared, canvas, timeSec) {
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('Canvas 2Dを利用できません。');
  const width = canvas.width;
  const height = canvas.height;
  const map = sceneMap(project);
  const item = sceneAt(map, timeSec);
  ctx.fillStyle = '#080b12';
  ctx.fillRect(0, 0, width, height);
  if (!item) return;
  if (Array.isArray(prepared?.imageSources) && prepared.imageWindowIndex !== item.index) void ensurePreparedImageWindow(project, prepared, item.index);
  const local = clamp(timeSec - item.start, 0, item.duration);
  const progress = clamp(local / item.duration, 0, 1);
  drawCover(ctx, prepared.images[item.index], width, height, item.scene.motion || 'none', progress, 1);
  const transitionSec = item.scene.transition === 'cut' ? 0 : Math.min(.45, item.duration * .18);
  if (transitionSec > 0 && item.index < map.length - 1 && local > item.duration - transitionSec) {
    const fade = clamp((local - (item.duration - transitionSec)) / transitionSec, 0, 1);
    drawCover(ctx, prepared.images[item.index + 1], width, height, map[item.index + 1].scene.motion || 'none', 0, fade);
  }
  const shade = ctx.createLinearGradient(0, 0, 0, height);
  shade.addColorStop(0, 'rgba(0,0,0,.08)');
  shade.addColorStop(.6, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.22)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  drawSubtitle(ctx, project, item, local, width, height);
}

export async function runVisualPreview(project, prepared, canvas, { durationLimit = 10, signal, onProgress = () => {} } = {}) {
  const total = Math.min(getProjectDuration(project), Math.max(.1, Number(durationLimit) || 10));
  if (!total) throw new Error('プレビューできるシーンがありません。');
  const start = performance.now();
  return await new Promise((resolve, reject) => {
    let frameId = 0;
    const abort = () => { cancelAnimationFrame(frameId); reject(new DOMException('プレビューを中止しました。', 'AbortError')); };
    signal?.addEventListener('abort', abort, { once: true });
    const frame = now => {
      if (signal?.aborted) return;
      const elapsed = Math.min(total, (now - start) / 1000);
      drawProjectFrame(project, prepared, canvas, elapsed);
      onProgress(elapsed, total);
      if (elapsed >= total) { signal?.removeEventListener('abort', abort); resolve(); return; }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
  });
}

export function getRecorderMimeCandidates(hasAudio) { return [...(hasAudio ? MIME_CANDIDATES_AUDIO : MIME_CANDIDATES_VIDEO)]; }
function chooseMime(hasAudio) { return getRecorderMimeCandidates(hasAudio).find(type => MediaRecorder.isTypeSupported(type)) || ''; }
function createRecorder(stream, mimeType, videoBitsPerSecond) { const options = { videoBitsPerSecond }; if (mimeType) options.mimeType = mimeType; return new MediaRecorder(stream, options); }
function bitrateFor(project) { const width = Number(project.output?.width) || 720; const high = project.output?.quality === 'high'; if (width >= 1080) return high ? 8_000_000 : 5_000_000; return high ? 5_000_000 : 3_000_000; }

export function validatePreparedAudioForExport(project, prepared) {
  const errors = [];
  if (project?.output?.bgmEnabled && project?.bgm?.audioData && !prepared?.audioArrayBuffer) errors.push(`BGMを読み込めませんでした${prepared?.audioFetchError ? `（${prepared.audioFetchError}）` : ''}`);
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const expectedSceneNarration = scenes.reduce((count, scene) => count + (scene?.narration?.audioData ? 1 : 0), 0);
  if (expectedSceneNarration) {
    const preparedScenes = Array.isArray(prepared?.sceneNarrations) ? prepared.sceneNarrations : [];
    const failed = [];
    scenes.forEach((scene, index) => { if (scene?.narration?.audioData && !preparedScenes[index]?.arrayBuffer) failed.push(index + 1); });
    if (failed.length) errors.push(`シーン別ナレーションを読み込めませんでした（シーン${failed.join('・')}）`);
  } else if (project?.narration?.audioData && !prepared?.narrationArrayBuffer) {
    errors.push(`ナレーションを読み込めませんでした${prepared?.narrationFetchError ? `（${prepared.narrationFetchError}）` : ''}`);
  }
  return errors;
}

async function createAudio(project, prepared, providedContext = null) {
  const preparedErrors = validatePreparedAudioForExport(project, prepared);
  if (preparedErrors.length) throw new Error(`${preparedErrors.join('／')}。BGM・ナレーション画面で音声ファイルを確認してください。`);
  if (project.output?.bgmEnabled && (prepared.audioInvalid || bgmLooksLikeVideo(project))) throw new Error('BGMに動画ファイルが登録されています。MP3・M4A・AAC・WAVなどの音声ファイルへ差し替えてください。');
  if (prepared.narrationInvalid || narrationLooksLikeVideo(project)) throw new Error('ナレーションに動画ファイルが登録されています。MP3・M4A・AAC・WAVなどの音声ファイルへ差し替えてください。');
  const hasBgm = Boolean(project.output?.bgmEnabled && prepared.audioArrayBuffer);
  const sceneSources = Array.isArray(prepared.sceneNarrationSources) ? prepared.sceneNarrationSources : [];
  const hasSceneNarration = sceneSources.some(x => x?.audioData);
  const hasNarration = !hasSceneNarration && Boolean(prepared.narrationArrayBuffer);
  if (!hasBgm && !hasNarration && !hasSceneNarration) return { audio: null, warning: '' };
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) throw new Error('この端末ではBGM・ナレーション合成に必要なWeb Audioを利用できません。別の対応端末で再試行してください。');
  const context = providedContext || new AudioContextClass();
  const staticSources = [];
  const staticStarts = [];
  try {
    if (context.state !== 'running') await context.resume();
    const destination = context.createMediaStreamDestination();
    let bgmGain = null;
    let narrationGain = null;
    let narrationDuration = 0;
    if (hasBgm) {
      const buffer = await context.decodeAudioData(prepared.audioArrayBuffer);
      prepared.audioArrayBuffer = null;
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = calculateBgmLoopCount(getProjectDuration(project), buffer.duration, project.bgm?.loop !== false) > 1;
      bgmGain = context.createGain(); source.connect(bgmGain); bgmGain.connect(destination); staticStarts.push(baseTime => source.start(baseTime)); staticSources.push(source);
    }
    if (hasNarration) {
      const buffer = await context.decodeAudioData(prepared.narrationArrayBuffer); prepared.narrationArrayBuffer = null; narrationDuration = buffer.duration || 0;
      const source = context.createBufferSource(); source.buffer = buffer; source.loop = false; narrationGain = context.createGain(); narrationGain.gain.value = clamp(Number(project.narration?.volume ?? 1), 0, 1.5); source.connect(narrationGain); narrationGain.connect(destination); staticStarts.push(baseTime => source.start(baseTime)); staticSources.push(source);
    }

    const scenes = Array.isArray(project.scenes) ? project.scenes : [];
    const sceneStarts = [];
    let cursor = 0;
    for (const scene of scenes) { sceneStarts.push(cursor); cursor += Math.max(0, Number(scene?.durationSec) || 0); }
    const dynamicScenes = new Map();
    const loadingScenes = new Map();
    let started = false;
    let lastProjectTime = 0;

    const decodeScene = async index => {
      if (!hasSceneNarration || index < 0 || index >= scenes.length || !sceneSources[index]?.audioData) return null;
      if (dynamicScenes.has(index)) return dynamicScenes.get(index);
      if (loadingScenes.has(index)) return await loadingScenes.get(index);
      const task = (async () => {
        const meta = sceneSources[index];
        const response = await fetch(meta.audioData);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const encoded = await response.arrayBuffer();
        const buffer = await context.decodeAudioData(encoded);
        const source = context.createBufferSource(); source.buffer = buffer; source.loop = false;
        const gain = context.createGain(); gain.gain.value = clamp(Number(project.narration?.volume ?? 1), 0, 1.5); source.connect(gain); gain.connect(destination);
        const entry = { index, source, gain, duration: buffer.duration || meta.durationSec || Math.max(0, Number(scenes[index]?.durationSec) || 0), scheduled: false };
        dynamicScenes.set(index, entry);
        return entry;
      })().finally(() => loadingScenes.delete(index));
      loadingScenes.set(index, task);
      return await task;
    };

    const scheduleEntry = (entry, projectTime = lastProjectTime) => {
      if (!entry || entry.scheduled || !started) return;
      const sceneStart = sceneStarts[entry.index] || 0;
      const elapsed = Math.max(0, projectTime - sceneStart);
      if (elapsed >= entry.duration) return;
      entry.source.start(context.currentTime + Math.max(0, sceneStart - projectTime), elapsed);
      entry.scheduled = true;
    };

    const releaseBefore = index => {
      for (const [key, entry] of dynamicScenes) {
        if (key >= index) continue;
        try { entry.source.disconnect(); } catch {}
        try { entry.gain.disconnect(); } catch {}
        entry.source.buffer = null;
        dynamicScenes.delete(key);
      }
    };

    const primeSceneWindow = async index => {
      if (!hasSceneNarration) return;
      const targets = [index, index + 1].filter(i => i >= 0 && i < scenes.length && sceneSources[i]?.audioData);
      for (const target of targets) {
        const entry = await decodeScene(target);
        scheduleEntry(entry);
      }
      releaseBefore(Math.max(0, index - 1));
    };

    if (hasSceneNarration) await primeSceneWindow(0);
    if (!staticSources.length && !hasSceneNarration) { if (!providedContext && context.state !== 'closed') await context.close(); return { audio: null, warning: '' }; }

    return { audio: {
      context, sources: staticSources, bgmGain, narrationGain, narrationDuration, tracks: destination.stream.getAudioTracks(),
      start() { if (started) return; started = true; const baseTime = context.currentTime; staticStarts.forEach(start => start(baseTime)); dynamicScenes.forEach(entry => scheduleEntry(entry, 0)); },
      update(timeSec, totalSec) {
        lastProjectTime = timeSec;
        if (hasSceneNarration) {
          let index = scenes.length - 1;
          for (let i = 0; i < sceneStarts.length; i++) { const end = sceneStarts[i] + Math.max(0, Number(scenes[i]?.durationSec) || 0); if (timeSec < end) { index = i; break; } }
          void primeSceneWindow(index).catch(error => console.warn('Scene narration window load failed', error));
        }
        if (bgmGain) {
          const base = clamp(Number(project.bgm?.volume) || 0, 0, 1); const fadeIn = Math.max(0, Number(project.bgm?.fadeInSec) || 0); const fadeOut = Math.max(0, Number(project.bgm?.fadeOutSec) || 0); let factor = 1; if (fadeIn > 0) factor = Math.min(factor, timeSec / fadeIn); if (fadeOut > 0) factor = Math.min(factor, (totalSec - timeSec) / fadeOut);
          const sceneSpeaking = [...dynamicScenes.values()].some(entry => entry.scheduled && timeSec >= (sceneStarts[entry.index] || 0) && timeSec < (sceneStarts[entry.index] || 0) + entry.duration);
          const duck = project.bgm?.ducking !== false && ((narrationGain && timeSec < narrationDuration) || sceneSpeaking) ? 0.35 : 1; bgmGain.gain.value = base * clamp(factor, 0, 1) * duck;
        }
        if (narrationGain) narrationGain.gain.value = clamp(Number(project.narration?.volume ?? 1), 0, 1.5);
        dynamicScenes.forEach(entry => { entry.gain.gain.value = clamp(Number(project.narration?.volume ?? 1), 0, 1.5); });
      },
      async stop() {
        for (const source of staticSources) { try { source.stop(); } catch {} }
        for (const entry of dynamicScenes.values()) { try { entry.source.stop(); } catch {} try { entry.source.disconnect(); } catch {} entry.source.buffer = null; }
        dynamicScenes.clear(); loadingScenes.clear();
        try { if (context.state !== 'closed') await context.close(); } catch {}
      }
    }, warning: '' };
  } catch (error) { try { if (context.state !== 'closed') await context.close(); } catch {} throw error; }
}

async function createRecordingSink(mimeType) {
  const memoryChunks = [];
  const memorySink = () => ({
    mode: 'memory',
    write: async blob => { if (blob?.size) memoryChunks.push(blob); },
    finish: async () => new Blob(memoryChunks, { type: mimeType }),
    abort: async () => { memoryChunks.length = 0; }
  });
  if (!globalThis.navigator?.storage?.getDirectory) return memorySink();
  try {
    const root = await navigator.storage.getDirectory();
    const handle = await root.getFileHandle('creator-os-recording.tmp', { create: true });
    const writable = await handle.createWritable();
    let writeChain = Promise.resolve();
    let writeError = null;
    return {
      mode: 'opfs',
      write(blob) {
        if (!blob?.size) return writeChain;
        writeChain = writeChain.then(() => writable.write(blob)).catch(error => {
          writeError = error;
          throw error;
        });
        return writeChain;
      },
      async finish() {
        await writeChain;
        if (writeError) throw writeError;
        await writable.close();
        return await handle.getFile();
      },
      async abort() { try { await writable.abort(); } catch {} }
    };
  } catch (error) {
    console.warn('OPFS recording sink unavailable; using in-memory chunks', error);
    return memorySink();
  }
}

export async function exportProjectVideo(project, prepared, canvas, { durationLimit, signal, onProgress = () => {}, onStatus = () => {}, audioContext = null } = {}) {
  const caps = getVideoCapabilities();
  if (!caps.supported) throw new Error('このブラウザは動画生成に必要なMediaRecorderまたはCanvas録画に対応していません。');
  const fullDuration = getProjectDuration(project);
  const total = durationLimit ? Math.min(fullDuration, Math.max(.1, Number(durationLimit))) : fullDuration;
  if (!total) throw new Error('動画にできるシーンがありません。');
  const fps = clamp(Number(project.output?.fps) || 30, 1, 60);
  canvas.width = Number(project.output?.width) || 720; canvas.height = Number(project.output?.height) || 1280;
  await ensurePreparedImageWindow(project, prepared, 0, { onStatus });
  drawProjectFrame(project, prepared, canvas, 0);
  onStatus('音声と録画機能を準備しています…');
  const audioResult = await createAudio(project, prepared, audioContext); const audio = audioResult.audio; if (audioResult.warning) onStatus(audioResult.warning);
  const canvasStream = canvas.captureStream(fps);
  const captureVideoTrack = canvasStream.getVideoTracks()[0] || null;
  const captureTrackSettings = captureVideoTrack?.getSettings ? captureVideoTrack.getSettings() : {};
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...(audio?.tracks || [])]);
  const mimeType = chooseMime(Boolean(audio?.tracks?.length));
  let recorder;
  try { recorder = createRecorder(stream, mimeType, bitrateFor(project)); } catch { recorder = new MediaRecorder(stream); }
  const actualMime = recorder.mimeType || mimeType || 'video/webm';
  const recordingSink = await createRecordingSink(actualMime);
  let chunkWriteError = null;
  let frameId = 0, stopped = false, wakeLock = null;
  const cleanup = async ({ abortSink = false } = {}) => { cancelAnimationFrame(frameId); stream.getTracks().forEach(track => track.stop()); await audio?.stop(); releasePreparedImages(prepared); if (abortSink) await recordingSink.abort?.(); try { await wakeLock?.release(); } catch {} };
  return await new Promise(async (resolve, reject) => {
    const abort = () => { if (stopped) return; stopped = true; try { recorder.stop(); } catch {} cleanup({ abortSink: true }).finally(() => reject(new DOMException('動画生成を中止しました。', 'AbortError'))); };
    signal?.addEventListener('abort', abort, { once: true });
    recorder.ondataavailable = event => {
      if (!event.data?.size) return;
      recordingSink.write(event.data).catch(error => {
        chunkWriteError = error instanceof Error ? error : new Error(String(error));
        if (!stopped) { try { recorder.stop(); } catch {} }
      });
    };
    recorder.onerror = event => { if (stopped) return; stopped = true; signal?.removeEventListener('abort', abort); cleanup({ abortSink: true }).finally(() => reject(event.error || new Error('録画中にエラーが発生しました。'))); };
    recorder.onstop = async () => {
      if (stopped && signal?.aborted) return;
      stopped = true; signal?.removeEventListener('abort', abort); await cleanup();
      if (chunkWriteError) { await recordingSink.abort?.(); return reject(new Error(`動画データの一時保存に失敗しました：${chunkWriteError.message}`)); }
      let blob;
      try { blob = await recordingSink.finish(); } catch (error) { await recordingSink.abort?.(); return reject(error instanceof Error ? error : new Error(String(error))); }
      if (!blob?.size) return reject(new Error('動画データを生成できませんでした。画面を開いたまま再試行してください。'));
      const extension = actualMime.includes('mp4') ? 'mp4' : 'webm';
      resolve({ blob, mimeType: actualMime, extension, durationSec: total, diagnostics: { requestedWidth: Number(project.output?.width) || 720, requestedHeight: Number(project.output?.height) || 1280, canvasWidth: canvas.width, canvasHeight: canvas.height, captureWidth: Number(captureTrackSettings?.width) || null, captureHeight: Number(captureTrackSettings?.height) || null, captureFrameRate: Number(captureTrackSettings?.frameRate) || null, selectedMimeType: mimeType, actualMimeType: actualMime, hasAudio: Boolean(audio?.tracks?.length) } });
    };
    try { if (navigator.wakeLock?.request) wakeLock = await navigator.wakeLock.request('screen'); } catch {}
    onStatus(`動画を生成しています（実時間：約${Math.ceil(total)}秒）…`);
    try { recorder.start(1000); audio?.start?.(); } catch (error) { stopped = true; signal?.removeEventListener('abort', abort); await cleanup({ abortSink: true }); reject(error instanceof Error ? error : new Error(String(error))); return; }
    const start = performance.now();
    const frame = now => {
      if (signal?.aborted || stopped) return;
      const elapsed = Math.min(total, (now - start) / 1000);
      drawProjectFrame(project, prepared, canvas, elapsed); audio?.update(elapsed, total); onProgress(elapsed, total);
      if (elapsed >= total) { drawProjectFrame(project, prepared, canvas, Math.max(0, total - .001)); recorder.stop(); return; }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
  });
}
