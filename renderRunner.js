import { getProject } from './db.js';
import { createRenderJob, isRenderJob } from './renderJob.js';
import { loadRenderJobEnvelope, saveRenderJobEnvelope } from './renderJobStorage.js';
import { getProjectDuration, prepareVideoProject, exportProjectVideo } from './videoRenderer.js';

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

async function prepareStage(projectId) {
  if (!projectId) throw new Error('動画生成するプロジェクトを特定できません。Creator OSへ戻ってやり直してください。');
  setStatus('プロジェクトから動画生成に必要な情報だけを取り出しています…');
  const project = await getProject(projectId);
  if (!project) throw new Error('プロジェクトを読み込めませんでした。');
  const job = createRenderJob(project);
  const title = project.title || 'Creator OS video';
  const durationSec = getProjectDuration(job);
  await saveRenderJobEnvelope({ version: 1, createdAt: new Date().toISOString(), title, durationSec, job });
  setStatus('編集用データを解放するため生成画面を再読み込みします…');
  // A second navigation is intentional: it destroys this JS context so the full
  // project object is not retained while Canvas/WebAudio/MediaRecorder are active.
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

  startButton.onclick = async () => {
    startButton.disabled = true;
    cancelButton.hidden = false;
    resultBox.hidden = true;
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
        onProgress: value => { progressEl.value = Math.max(0, Math.min(1, Number(value) || 0)); },
        audioContext
      });
      if (resultUrl) URL.revokeObjectURL(resultUrl);
      resultUrl = URL.createObjectURL(result.blob);
      const title = safeName(envelope.title || 'creator-os-video');
      resultFile = new File([result.blob], `${title}.${result.extension}`, { type: result.mimeType });
      resultVideo.src = resultUrl;
      downloadLink.href = resultUrl;
      downloadLink.download = resultFile.name;
      resultBox.hidden = false;
      progressEl.value = 1;
      infoEl.textContent = `${result.extension.toUpperCase()}・${(result.blob.size / 1024 / 1024).toFixed(1)} MB・${Number(result.durationSec || duration).toFixed(1)}秒`;
      setStatus('動画生成が完了しました。');
      shareButton.hidden = !(navigator.share && navigator.canShare?.({ files: [resultFile] }));
      shareButton.onclick = async () => {
        if (!resultFile) return;
        try { await navigator.share({ files: [resultFile], title: envelope.title || 'Creator OS video' }); }
        catch (error) { if (error?.name !== 'AbortError') alert(`共有できませんでした：${error.message || error}`); }
      };
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
