import { getProject, saveProject } from './db.js';
import { detectEnergyPeaks, proposeBeatSnappedDurations, applyBeatSnappedDurations } from './bgmBeatSync.js';

const app = document.querySelector('#app');
let installing = false;

function projectIdFromHash() {
  const match = location.hash.match(/^#\/project\/([^/]+)\/subtitles-bgm/);
  return match ? decodeURIComponent(match[1]) : '';
}

async function decodeBgm(audioData) {
  const AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!AudioContextClass) throw new Error('この端末ではWeb Audioを利用できません。');
  const response = await fetch(audioData);
  if (!response.ok) throw new Error(`BGMを読み込めませんでした（HTTP ${response.status}）`);
  const context = new AudioContextClass();
  try {
    if (context.state !== 'running') await context.resume();
    const buffer = await context.decodeAudioData((await response.arrayBuffer()).slice(0));
    return { samples: buffer.getChannelData(0), sampleRate: buffer.sampleRate, duration: buffer.duration };
  } finally {
    await context.close?.();
  }
}

async function install() {
  if (installing || !app) return;
  const projectId = projectIdFromHash();
  if (!projectId || app.querySelector('#bgmBeatSyncPanel')) return;
  const main = app.querySelector('main');
  if (!main) return;
  installing = true;
  try {
    const project = await getProject(projectId);
    if (!project || projectIdFromHash() !== projectId) return;
    const section = document.createElement('section');
    section.id = 'bgmBeatSyncPanel';
    section.className = 'card';
    section.innerHTML = `<h2>BGM Beat Sync</h2>
      <p class="notice">BGMの強い拍候補を端末内で検出し、Scene切替を近い拍へ寄せる候補を作ります。解析だけではScene尺を変更しません。</p>
      <div class="actions"><button type="button" data-analyze-beats>BGMを解析</button><button type="button" data-apply-beats disabled>候補をScene尺へ適用</button></div>
      <pre data-beat-status style="white-space:pre-wrap"></pre>`;
    main.appendChild(section);
    const status = section.querySelector('[data-beat-status]');
    const applyButton = section.querySelector('[data-apply-beats]');
    let proposal = null;

    section.querySelector('[data-analyze-beats]').onclick = async event => {
      const button = event.currentTarget;
      const current = await getProject(projectId);
      if (!current?.bgm?.audioData) { status.textContent = 'BGM音源が未登録です。先にBGMを選択してください。'; return; }
      if (!Array.isArray(current.scenes) || current.scenes.length < 2) { status.textContent = 'Beat Syncには2 Scene以上必要です。'; return; }
      button.disabled = true;
      applyButton.disabled = true;
      status.textContent = 'BGMを端末内で解析しています…';
      try {
        const decoded = await decodeBgm(current.bgm.audioData);
        const peaks = detectEnergyPeaks(decoded.samples, decoded.sampleRate);
        proposal = proposeBeatSnappedDurations(current.scenes, peaks);
        if (!peaks.length) {
          status.textContent = '強い拍候補を検出できませんでした。現在のScene尺は変更していません。';
          proposal = null;
          return;
        }
        if (!proposal.changed) {
          status.textContent = `拍候補 ${peaks.length}件。現在のScene切替はすでに近い拍にあります。変更は不要です。`;
          proposal = null;
          return;
        }
        status.textContent = `拍候補 ${peaks.length}件を検出。${proposal.changed}箇所のScene切替を最大0.45秒以内で寄せられます。\n${proposal.durations.map((duration, index) => `Scene ${index + 1}: ${duration.toFixed(2)}秒`).join('\n')}`;
        applyButton.disabled = false;
      } catch (error) {
        console.warn('BGM beat analysis failed', error);
        status.textContent = `BGM解析に失敗しました：${error?.message || error}`;
        proposal = null;
      } finally {
        button.disabled = false;
      }
    };

    applyButton.onclick = async () => {
      if (!proposal) return;
      const current = await getProject(projectId);
      if (!current) return;
      const next = applyBeatSnappedDurations(current, proposal);
      next.updatedAt = new Date().toISOString();
      await saveProject(next);
      status.textContent = `Beat Sync候補を適用しました。${proposal.changed}箇所のScene切替を調整しました。合計尺は維持しています。`;
      applyButton.disabled = true;
      proposal = null;
    };
  } finally {
    installing = false;
  }
}

const observer = new MutationObserver(() => void install());
if (app) observer.observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(install));
void install();
