import { getProject, saveProject } from './db.js';
import { readSubtitleCards, writeSubtitleCards, splitSubtitleCardNaturally, mergeSubtitleCardWithNext, replaceSubtitleCard, subtitleCardTiming } from './subtitleCardEditing.js';

const app = document.querySelector('#app');
let installing = false;

function projectIdFromHash() {
  const match = location.hash.match(/^#\/project\/([^/]+)\/subtitles-bgm/);
  return match ? decodeURIComponent(match[1]) : '';
}

function escapeHtml(value='') {
  return String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function sceneLabel(scene, index) {
  const text = String(scene?.text || scene?.subtitleText || '').replace(/\s+/g, ' ').trim();
  return `Scene ${index + 1}${text ? `：${text.slice(0, 24)}` : ''}`;
}

async function install() {
  if (installing || !app) return;
  const projectId = projectIdFromHash();
  if (!projectId || app.querySelector('#subtitleCardEditorPanel')) return;
  const main = app.querySelector('main');
  if (!main) return;
  installing = true;
  try {
    const project = await getProject(projectId);
    if (!project || projectIdFromHash() !== projectId) return;
    const scenes = Array.isArray(project.scenes) ? project.scenes : [];
    if (!scenes.length) return;

    const section = document.createElement('section');
    section.id = 'subtitleCardEditorPanel';
    section.className = 'card';
    section.innerHTML = `<h2>字幕カード編集</h2>
      <p class="notice">映像Sceneは変えず、Scene内の字幕カードだけを分割・結合・修正します。保存するまでプロジェクト本体は変更しません。</p>
      <label>対象Scene<select data-scene-select>${scenes.map((scene, index) => `<option value="${index}">${escapeHtml(sceneLabel(scene, index))}</option>`).join('')}</select></label>
      <div data-card-list style="display:grid;gap:10px;margin-top:12px"></div>
      <div class="actions" style="margin-top:12px">
        <button type="button" data-save-cards>字幕カードを保存</button>
        <button type="button" data-reset-cards>保存前の状態へ戻す</button>
      </div>
      <p data-card-status class="notice"></p>`;
    main.appendChild(section);

    const select = section.querySelector('[data-scene-select]');
    const list = section.querySelector('[data-card-list]');
    const status = section.querySelector('[data-card-status]');
    let cards = [];
    let original = [];

    const loadScene = () => {
      const index = Number(select.value) || 0;
      const scene = scenes[index] || {};
      const source = scene.subtitleText || scene.text || '';
      cards = readSubtitleCards(source);
      if (!cards.length && source.trim()) cards = [source.trim()];
      original = [...cards];
      render();
      status.textContent = `${cards.length}カード。映像Scene数やScene尺は変更しません。`;
    };

    const render = () => {
      const sceneIndex = Number(select.value) || 0;
      const scene = scenes[sceneIndex] || {};
      list.innerHTML = cards.map((card, index) => {
        const timing = subtitleCardTiming(scene.durationSec, cards.length, index);
        return `<div class="card" data-card-index="${index}" style="padding:10px">
          <small>カード ${index + 1} / 約${timing.startSec.toFixed(1)}〜${timing.endSec.toFixed(1)}秒</small>
          <textarea rows="3" data-card-text>${escapeHtml(card)}</textarea>
          <div class="actions">
            <button type="button" data-split-card>自然な位置で分割</button>
            <button type="button" data-merge-card ${index >= cards.length - 1 ? 'disabled' : ''}>次と結合</button>
          </div>
        </div>`;
      }).join('');

      list.querySelectorAll('[data-card-index]').forEach(wrapper => {
        const index = Number(wrapper.dataset.cardIndex);
        wrapper.querySelector('[data-card-text]').addEventListener('input', event => {
          cards = replaceSubtitleCard(cards, index, event.target.value);
        });
        wrapper.querySelector('[data-split-card]').onclick = () => {
          const textarea = wrapper.querySelector('[data-card-text]');
          cards = replaceSubtitleCard(cards, index, textarea.value);
          cards = splitSubtitleCardNaturally(cards, index);
          render();
        };
        wrapper.querySelector('[data-merge-card]').onclick = () => {
          const textarea = wrapper.querySelector('[data-card-text]');
          cards = replaceSubtitleCard(cards, index, textarea.value);
          cards = mergeSubtitleCardWithNext(cards, index);
          render();
        };
      });
    };

    select.onchange = loadScene;
    section.querySelector('[data-reset-cards]').onclick = () => {
      cards = [...original];
      render();
      status.textContent = '保存前の字幕カード状態へ戻しました。';
    };
    section.querySelector('[data-save-cards]').onclick = async () => {
      const current = await getProject(projectId);
      if (!current) return;
      const sceneIndex = Number(select.value) || 0;
      const currentScene = current.scenes?.[sceneIndex];
      if (!currentScene) return;
      const nextText = writeSubtitleCards(cards);
      if (!nextText) { status.textContent = '空の字幕は保存しません。'; return; }
      currentScene.subtitleText = nextText;
      current.updatedAt = new Date().toISOString();
      await saveProject(current);
      scenes[sceneIndex].subtitleText = nextText;
      original = [...cards];
      status.textContent = `保存済み：Scene ${sceneIndex + 1} の字幕を ${cards.length}カードに更新しました。`;
    };

    loadScene();
  } finally {
    installing = false;
  }
}

const observer = new MutationObserver(() => void install());
if (app) observer.observe(app, { childList: true, subtree: true });
window.addEventListener('hashchange', () => queueMicrotask(install));
void install();
