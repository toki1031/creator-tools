import { getProject } from './db.js';
import { createRenderJob, isRenderJob } from './renderJob.js';
import { loadRenderJobEnvelope, saveRenderJobEnvelope } from './renderJobStorage.js';
import { getProjectDuration, prepareVideoProject, exportProjectVideo } from './videoRenderer.js';
import { describeFinalVideoStorage, loadFinalVideoArtifact, storeFinalVideoArtifact } from './finalVideoArtifact.js';

const statusEl = document.querySelector('#renderRunnerStatus');
const progressEl = document.querySelector('#renderRunnerProgress');
const canvas = document.querySelector('#renderRunnerCanvas');
const startButton = document.querySelector('#renderRunnerStart');
const cancelButton = document.querySelector('#renderRunnerCancel');
const backLink = document.querySelector('#renderRunnerBack');
const resultBox = document.querySelector('#renderRunnerResult');
const resultVideo = document.querySelector('#renderRunnerVideo');
const downloadLink = document.querySelector('#renderRunnerDownload');
const shareButton = document.querySelector('#renderRunnerShare');
const infoEl = document.querySelector('#renderRunnerInfo');
const storageStateEl = document.querySelector('#renderRunnerStorageState');
let controller = null;
let resultUrl = '';
let resultFile = null;

function setStatus(text) { if (statusEl) statusEl.textContent = text; }
function safeName(value = 'creator-os-video') { return String(value || 'creator-os-video').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'creator-os-video'; }
function returnHref() {
  let hash = '#/';
  try { hash = sessionStorage.getItem('creator-os-render-return') || '#/'; } catch {}
  return `./index.html${hash}`;
}
function mediaErrorText(error) {
  const code = Number(error?.code) || 0;
  if (code === 1) return '再生が中断されました';
  if (code === 2) return '動画データの読み込みに失敗しました';
  if (code === 3) return '動画をデコードできませんでした';
  if (code === 4) return 'この動画形式をSafariで再生できません';
  return '完成動画を再生できません';
}
function extensionForMime(mime = '') { return String(mime).includes('mp4') ? 'mp4' : 'webm'; }

function showResult({ blob, mimeType = '', extension = '', durationSec = 0, diagnostics = null, storageResult = null, restored = false, title = 'Creator OS video' }) {
  if (!(blob instanceof Blob) || !blob.size) return false;
  if (resultUrl) URL.revokeObjectURL(resultUrl);
  resultUrl = URL.createObjectURL(blob);
  const resolvedMime = mimeType || blob.type || 'video/mp4';
  const resolvedExtension = extension || extensionForMime(resolvedMime);
  resultFile = new File([blob], `${safeName(title)}.${resolvedExtension}`, { type: resolvedMime });

  resultVideo.onerror = () => {
    const message = mediaErrorText(resultVideo.error);
    setStatus(`${message}。「iPhoneに保存・共有」または「ファイルをダウンロード」で保存した動画も確認してください。`);
  };
  resultVideo.onloadedmetadata = () => {
    if (restored) setStatus('Creator OS内の前回完成動画を復元しました。再生またはiPhoneへの保存ができます。');
  };
  resultVideo.src = resultUrl;
  resultVideo.load();

  downloadLink.href = resultUrl;
  downloadLink.download = resultFile.name;
  resultBox.hidden = false;
  storageStateEl.textContent = describeFinalVideoStorage(storageResult || { status:'resolved' });

  const sizeMb = (blob.size / 1024 / 1024).toFixed(1);
  if (restored) {
    infoEl.textContent = `${resolvedExtension.toUpperCase()}・${sizeMb} MB・Creator OS内の前回完成動画`;
  } else {
    const d = diagnostics || {};
    const capture = d.captureWidth && d.captureHeight ? `${d.captureWidth}×${d.captureHeight}` : '取得不可';
    const requested = d.requestedWidth && d.requestedHeight ? `${d.requestedWidth}×${d.requestedHeight}` : '不明';
    const canvasSize = d.canvasWidth && d.canvasHeight ? `${d.canvasWidth}×${d.canvasHeight}` : '不明';
    infoEl.textContent = `${resolvedExtension.toUpperCase()}・${sizeMb} MB・${Number(durationSec || 0).toFixed(1)}秒\n要求 ${requested} ／ Canvas ${canvasSize} ／ 実capture ${capture}`;
  }

  shareButton.hidden = !(navigator.share && navigator.canShare?.({ files: [resultFile] }));
  shareButton.onclick = async () => {
    if (!resultFile) return;
    try { await navigator.share({ files: [resultFile], title }); }
    catch (error) { if (error?.name !== 'AbortError') alert(`共有できませんでした：${error.message || error}`); }
  };
  return true;
}

async function prepareStage(projectId) {
  if (!projectId) throw new Error('動画生成するプロジェクトを特定できません。Creator OSへ戻ってやり直してください。');
  setStatus('プロジェクトから動画生成に必要な情報だけを取り出しています…');
  const project = await getProject(projectId);
  if (!project) throw new Error('プロジェクトを読み込めませんでした。');
  const job = createRenderJob(project);
  const title = project.title || 'Creator OS video';
  const durationSec = getProjectDuration(job);
  await saveRenderJobEnvelope({ version: 2, createdAt: new Date().toISOString(), title, durationSec, job });
  setStatus('編集用データを解放するため生成画面を再読み込みします…');
  location.replace('./render-runner.html?stage=generate');
}

async function generateStage() {
  const envelope = await loadRenderJobEnvelope();
  const job = envelope?.job;
  if (!isRenderJob(job)) throw new Error('動画生成用データが見つかりません。Creator OSへ戻ってやり直してください。');
  if (backLink) backLink.href = returnHref();
  const duration = Number(envelope.durationSec) || getProjectDuration(job);
  setStatus(`専用生成モードの準備ができました。約${Math.ceil(duration)}秒の動画を生成します。`);
  startButton.hidden = false;

  const previous = await loadFinalVideoArtifact(job).catch(() => null);
  if (previous?.status === 'resolved' && previous.blob instanceof Blob && previous.blob.size) {
    showResult({
      blob: previous.blob,
      mimeType: previous.mediaRef?.mimeType || previous.blob.type,
      storageResult: previous,
      restored: true,
      title: envelope.title || 'Creator OS video'
    });
  }

  startButton.onclick = async () => {
    startButton.disabled = true;
    cancelButton.hidden = false;
    progressEl.value = 0;
    controller = new AbortController();
    cancelButton.onclick = () => controller?.abort();
    let audioContext = null;
    try {
      const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (AudioContextClass) {
        audioContext = new AudioContextClass();
        if (audioContext.state === 'suspended') await audioContext.resume();
      }
      setStatus('画像と音声を順番に準備しています…');
      const prepared = await prepareVideoProject(job, { onStatus: setStatus });
      const result = await exportProjectVideo(job, prepared, canvas, {
        signal: controller.signal,
        onStatus: setStatus,
        onProgress: (elapsed, total) => { progressEl.value = total > 0 ? Math.max(0, Math.min(1, Number(elapsed) / Number(total))) : 0; },
        audioContext
      });
      setStatus('完成動画をCreator OS内へ保持しています…');
      const storageResult = await storeFinalVideoArtifact(job, result.blob);
      showResult({ ...result, storageResult, title: envelope.title || 'Creator OS video' });
      progressEl.value = 1;
      setStatus(storageResult?.status === 'stored'
        ? '動画生成が完了しました。Creator OS内に保持しました。'
        : '動画生成は完了しました。Creator OS内に保持できなかったため、ページを閉じる前にiPhoneへ保存してください。');
    } catch (error) {
      if (error?.name === 'AbortError') setStatus('動画生成を中止しました。');
      else {
        console.error(error);
        setStatus(`動画生成に失敗しました：${error?.message || error}`);
      }
    } finally {
      controller = null;
      cancelButton.hidden = true;
      startButton.disabled = false;
      try { if (audioContext && audioContext.state !== 'closed') await audioContext.close(); } catch {}
    }
  };
}

async function boot() {
  if (backLink) backLink.href = returnHref();
  const params = new URLSearchParams(location.search);
  const stage = params.get('stage') || 'generate';
  if (stage === 'prepare') await prepareStage(params.get('project') || '');
  else await generateStage();
}

boot().catch(error => {
  console.error(error);
  setStatus(`専用動画生成を準備できませんでした：${error?.message || error}`);
  if (backLink) backLink.href = returnHref();
});
