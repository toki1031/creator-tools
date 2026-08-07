const MIME_CANDIDATES_AUDIO = [
  'video/mp4',
  'video/mp4;codecs="avc1.42E01E,mp4a.40.2"',
  'video/mp4;codecs="avc1.4D401E,mp4a.40.2"',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm'
];
const MIME_CANDIDATES_VIDEO = [
  'video/mp4',
  'video/mp4;codecs="avc1.42E01E"',
  'video/mp4;codecs="avc1.4D401E"',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm'
];

export function getVideoCapabilities() {
  const hasRecorder = typeof MediaRecorder !== 'undefined';
  const hasCanvasCapture = typeof HTMLCanvasElement !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function';
  const supported = hasRecorder && hasCanvasCapture;
  const mp4 = supported && MIME_CANDIDATES_AUDIO.some(type => type.startsWith('video/mp4') && MediaRecorder.isTypeSupported(type));
  const webm = supported && MIME_CANDIDATES_AUDIO.some(type => type.startsWith('video/webm') && MediaRecorder.isTypeSupported(type));
  return { supported, hasRecorder, hasCanvasCapture, mp4, webm };
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

export function validateVideoProject(project) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const errors = [];
  const warnings = [];
  if (!scenes.length) errors.push('シーンがありません。');
  const imageCount = scenes.filter(scene => scene.imageData).length;
  if (imageCount < scenes.length) warnings.push(`画像未登録のシーンが${scenes.length - imageCount}件あります。背景色で代用します。`);
  if (getProjectDuration(project) <= 0) errors.push('動画の長さが0秒です。');
  if (project.output?.bgmEnabled && project.bgm?.source !== 'none' && !project.bgm?.audioData) warnings.push('BGM設定はありますが、音源ファイルが登録されていません。');
  const bgmInvalid = Boolean(project.output?.bgmEnabled && project.bgm?.audioData && bgmLooksLikeVideo(project));
  if (bgmInvalid) errors.push('現在のBGMはMOV / MP4などの動画ファイルです。BGM・字幕画面でMP3・M4A・AAC・WAVなどの音声ファイルを再登録してください。');
  if (project.output?.subtitles && !scenes.some(scene => scene.subtitleEnabled !== false && String(scene.subtitleText || '').trim())) warnings.push('表示できる字幕がありません。');
  return { errors, warnings, imageCount, sceneCount: scenes.length, durationSec: getProjectDuration(project), bgmInvalid };
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

export async function prepareVideoProject(project, { onStatus = () => {} } = {}) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const imageFailures = [];
  onStatus('シーン画像を準備しています…');
  const images = await Promise.all(scenes.map(async (scene, index) => {
    if (!scene.imageData) return null;
    try {
      return await loadImageSafely(scene.imageData);
    } catch (error) {
      imageFailures.push({ index, message: error instanceof Error ? error.message : String(error) });
      console.warn(`Scene ${index + 1} image load failed`, error);
      return null;
    }
  }));

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
        console.warn('Audio load failed', error);
      }
    }
  }
  const loadedImageCount = images.filter(Boolean).length;
  onStatus(`素材準備完了：画像 ${loadedImageCount}/${scenes.length}${audioInvalid ? '／BGM形式エラー' : audioFetchError ? '／BGM読込失敗' : ''}`);
  return { images, imageFailures, loadedImageCount, audioArrayBuffer, audioMimeType, audioFetchError, audioInvalid };
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
  const normalized = String(text || '').trim();
  if (!normalized) return [];
  const result = [];
  for (const block of normalized.split(/\n+/).map(v => v.trim()).filter(Boolean)) {
    const chars = Array.from(block);
    while (chars.length) result.push(chars.splice(0, Math.max(1, maxChars)).join(''));
  }
  return result.slice(0, Math.max(1, maxLines));
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
  const lines = subtitleLines(scene.subtitleText || scene.text || '', style.maxCharsPerLine || 16, style.maxLines || 2);
  if (!lines.length) return;

  const scale = width / 1080;
  const fontSize = Math.max(18, Number(style.fontSize || 54) * scale);
  const lineHeight = fontSize * 1.35;
  const paddingX = fontSize * .5;
  const paddingY = fontSize * .28;
  ctx.save();
  ctx.font = `900 ${fontSize}px -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  const widest = Math.max(...lines.map(line => ctx.measureText(line).width));
  const boxWidth = Math.min(width * .9, widest + paddingX * 2);
  const boxHeight = lines.length * lineHeight + paddingY * 2;
  const position = project.output?.subtitlePosition || style.position || 'bottom';
  const centerY = position === 'top' ? height * .2 : position === 'center' ? height * .5 : height * .82;
  const x = width / 2;
  const top = centerY - boxHeight / 2;
  if (style.backgroundEnabled) {
    ctx.fillStyle = hexAlpha(style.backgroundColor || '#000000', style.backgroundOpacity ?? .45);
    roundedRect(ctx, (width - boxWidth) / 2, top, boxWidth, boxHeight, fontSize * .22);
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

export async function runVisualPreview(project, prepared, canvas, {
  durationLimit = 10,
  signal,
  onProgress = () => {}
} = {}) {
  const total = Math.min(getProjectDuration(project), Math.max(.1, Number(durationLimit) || 10));
  if (!total) throw new Error('プレビューできるシーンがありません。');
  const start = performance.now();
  return await new Promise((resolve, reject) => {
    let frameId = 0;
    const abort = () => {
      cancelAnimationFrame(frameId);
      reject(new DOMException('プレビューを中止しました。', 'AbortError'));
    };
    signal?.addEventListener('abort', abort, { once: true });
    const frame = now => {
      if (signal?.aborted) return;
      const elapsed = Math.min(total, (now - start) / 1000);
      drawProjectFrame(project, prepared, canvas, elapsed);
      onProgress(elapsed, total);
      if (elapsed >= total) {
        signal?.removeEventListener('abort', abort);
        resolve();
        return;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
  });
}

function chooseMime(hasAudio) {
  const list = hasAudio ? MIME_CANDIDATES_AUDIO : MIME_CANDIDATES_VIDEO;
  return list.find(type => MediaRecorder.isTypeSupported(type)) || '';
}

function createRecorder(stream, mimeType, videoBitsPerSecond) {
  const options = { videoBitsPerSecond };
  if (mimeType) options.mimeType = mimeType;
  return new MediaRecorder(stream, options);
}

function bitrateFor(project) {
  const width = Number(project.output?.width) || 720;
  const high = project.output?.quality === 'high';
  if (width >= 1080) return high ? 8_000_000 : 5_000_000;
  return high ? 5_000_000 : 3_000_000;
}

async function createAudio(project, prepared, providedContext = null) {
  if (project.output?.bgmEnabled && (prepared.audioInvalid || bgmLooksLikeVideo(project))) {
    throw new Error('BGMに動画ファイルが登録されています。MP3・M4A・AAC・WAVなどの音声ファイルへ差し替えてください。');
  }
  if (!project.output?.bgmEnabled || !prepared.audioArrayBuffer) return { audio: null, warning: '' };
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) return { audio: null, warning: 'この端末ではBGM合成に必要なWeb Audioを利用できません。' };
  const context = providedContext || new AudioContextClass();
  try {
    if (context.state !== 'running') await context.resume();
    const buffer = await context.decodeAudioData(prepared.audioArrayBuffer.slice(0));
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.loop = project.bgm?.loop !== false;
    const gain = context.createGain();
    const destination = context.createMediaStreamDestination();
    source.connect(gain);
    gain.connect(destination);
    source.start(0);
    return {
      audio: {
        context, source, gain, tracks: destination.stream.getAudioTracks(),
        update(timeSec, totalSec) {
          const base = clamp(Number(project.bgm?.volume) || 0, 0, 1);
          const fadeIn = Math.max(0, Number(project.bgm?.fadeInSec) || 0);
          const fadeOut = Math.max(0, Number(project.bgm?.fadeOutSec) || 0);
          let factor = 1;
          if (fadeIn > 0) factor = Math.min(factor, timeSec / fadeIn);
          if (fadeOut > 0) factor = Math.min(factor, (totalSec - timeSec) / fadeOut);
          gain.gain.value = base * clamp(factor, 0, 1);
        },
        async stop() {
          try { source.stop(); } catch {}
          try { if (context.state !== 'closed') await context.close(); } catch {}
        }
      }, warning: ''
    };
  } catch (error) {
    console.warn('BGM decode failed; continue without audio', error, prepared.audioMimeType);
    try { if (!providedContext && context.state !== 'closed') await context.close(); } catch {}
    return {
      audio: null,
      warning: `BGMをデコードできなかったため、音声なしで生成します${prepared.audioMimeType ? `（${prepared.audioMimeType}）` : ''}。MP3・AAC・M4Aの別ファイルで再登録してください。`
    };
  }
}

export async function exportProjectVideo(project, prepared, canvas, {
  durationLimit,
  signal,
  onProgress = () => {},
  onStatus = () => {},
  audioContext = null
} = {}) {
  const caps = getVideoCapabilities();
  if (!caps.supported) throw new Error('このブラウザは動画生成に必要なMediaRecorderまたはCanvas録画に対応していません。');
  const fullDuration = getProjectDuration(project);
  const total = durationLimit ? Math.min(fullDuration, Math.max(.1, Number(durationLimit))) : fullDuration;
  if (!total) throw new Error('動画にできるシーンがありません。');

  const fps = clamp(Number(project.output?.fps) || 30, 1, 60);
  canvas.width = Number(project.output?.width) || 720;
  canvas.height = Number(project.output?.height) || 1280;
  drawProjectFrame(project, prepared, canvas, 0);
  onStatus('音声と録画機能を準備しています…');
  const audioResult = await createAudio(project, prepared, audioContext);
  const audio = audioResult.audio;
  if (audioResult.warning) onStatus(audioResult.warning);
  const canvasStream = canvas.captureStream(fps);
  const captureVideoTrack = canvasStream.getVideoTracks()[0] || null;
  const captureTrackSettings = captureVideoTrack?.getSettings ? captureVideoTrack.getSettings() : {};
  const stream = new MediaStream([...canvasStream.getVideoTracks(), ...(audio?.tracks || [])]);
  const mimeType = chooseMime(Boolean(audio?.tracks?.length));
  let recorder;
  try {
    recorder = createRecorder(stream, mimeType, bitrateFor(project));
  } catch (error) {
    recorder = new MediaRecorder(stream);
  }
  const actualMime = recorder.mimeType || mimeType || 'video/webm';
  const chunks = [];
  let frameId = 0;
  let stopped = false;
  let wakeLock = null;

  const cleanup = async () => {
    cancelAnimationFrame(frameId);
    stream.getTracks().forEach(track => track.stop());
    await audio?.stop();
    try { await wakeLock?.release(); } catch {}
  };

  return await new Promise(async (resolve, reject) => {
    const abort = () => {
      if (stopped) return;
      stopped = true;
      try { recorder.stop(); } catch {}
      cleanup().finally(() => reject(new DOMException('動画生成を中止しました。', 'AbortError')));
    };
    signal?.addEventListener('abort', abort, { once: true });
    recorder.ondataavailable = event => { if (event.data?.size) chunks.push(event.data); };
    recorder.onerror = event => {
      if (stopped) return;
      stopped = true;
      signal?.removeEventListener('abort', abort);
      cleanup().finally(() => reject(event.error || new Error('録画中にエラーが発生しました。')));
    };
    recorder.onstop = async () => {
      if (stopped && signal?.aborted) return;
      stopped = true;
      signal?.removeEventListener('abort', abort);
      await cleanup();
      if (!chunks.length) return reject(new Error('動画データを生成できませんでした。画面を開いたまま再試行してください。'));
      const blob = new Blob(chunks, { type: actualMime });
      const extension = actualMime.includes('mp4') ? 'mp4' : 'webm';
      resolve({
        blob, mimeType: actualMime, extension, durationSec: total,
        diagnostics: {
          requestedWidth: Number(project.output?.width) || 720,
          requestedHeight: Number(project.output?.height) || 1280,
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          captureWidth: Number(captureTrackSettings?.width) || null,
          captureHeight: Number(captureTrackSettings?.height) || null,
          captureFrameRate: Number(captureTrackSettings?.frameRate) || null
        }
      });
    };

    try {
      if (navigator.wakeLock?.request) wakeLock = await navigator.wakeLock.request('screen');
    } catch {}
    onStatus(`動画を生成しています（実時間：約${Math.ceil(total)}秒）…`);
    const start = performance.now();
    recorder.start(1000);
    const frame = now => {
      if (signal?.aborted || stopped) return;
      const elapsed = Math.min(total, (now - start) / 1000);
      drawProjectFrame(project, prepared, canvas, elapsed);
      audio?.update(elapsed, total);
      onProgress(elapsed, total);
      if (elapsed >= total) {
        drawProjectFrame(project, prepared, canvas, Math.max(0, total - .001));
        recorder.stop();
        return;
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
  });
}
