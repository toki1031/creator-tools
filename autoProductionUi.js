import { saveProject } from './db.js';
import { goScenes, readRoute } from './router.js';
import { createAutoProductionProject } from './autoProductionProject.js';

const BUTTON_ID = 'openAutoProduction';
const DIALOG_ID = 'autoProductionDialog';

function ensureStyles() {
  if (document.getElementById('autoProductionStyles')) return;
  const style = document.createElement('style');
  style.id = 'autoProductionStyles';
  style.textContent = `
    #${DIALOG_ID} { width:min(720px, calc(100vw - 24px)); max-width:720px; }
    #${DIALOG_ID} form { display:grid; gap:14px; }
    #${DIALOG_ID} textarea { min-height:44vh; resize:vertical; }
    #${DIALOG_ID} .auto-production-note { margin:0; opacity:.78; font-size:.92rem; line-height:1.6; }
    #${DIALOG_ID} .auto-production-status { min-height:1.5em; margin:0; font-weight:600; }
    @media (max-width:640px) {
      #${DIALOG_ID} { margin:auto 12px; width:calc(100vw - 24px); max-height:calc(100dvh - 24px); }
      #${DIALOG_ID} textarea { min-height:42dvh; }
      #${DIALOG_ID} .dialog-actions { position:sticky; bottom:0; padding-top:8px; }
    }
  `;
  document.head.appendChild(style);
}

function buildDialog() {
  let dialog = document.getElementById(DIALOG_ID);
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = DIALOG_ID;
  dialog.innerHTML = `
    <form method="dialog" data-auto-production-form>
      <div>
        <h2>制作依頼から作る</h2>
        <p class="auto-production-note">制作依頼をそのまま貼り付けます。内容はこの端末内で処理し、外部AI/APIには送信しません。</p>
      </div>
      <label>プロジェクト名（任意）
        <input name="title" placeholder="未入力なら「無題のプロジェクト」">
      </label>
      <label>制作依頼
        <textarea name="request" required placeholder="目的、Scene 1〜、素材方針、禁止事項、最終QAなどを貼り付けてください。"></textarea>
      </label>
      <p class="auto-production-note">この段階ではScene設計までを自動作成します。素材取得・画像生成・音声・BGM・MP4生成はまだ実行しません。</p>
      <p class="auto-production-status" data-auto-production-status aria-live="polite"></p>
      <div class="dialog-actions">
        <button type="button" data-auto-production-cancel>キャンセル</button>
        <button type="submit" class="primary" data-auto-production-submit>動画制作を開始</button>
      </div>
    </form>`;
  document.body.appendChild(dialog);

  const form = dialog.querySelector('[data-auto-production-form]');
  const cancel = dialog.querySelector('[data-auto-production-cancel]');
  const submit = dialog.querySelector('[data-auto-production-submit]');
  const status = dialog.querySelector('[data-auto-production-status]');
  cancel.addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => {
    status.textContent = '';
    submit.disabled = false;
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (submit.disabled) return;
    const data = new FormData(form);
    const requestText = String(data.get('request') ?? '').trim();
    if (!requestText) {
      status.textContent = '制作依頼を入力してください。';
      form.elements.request?.focus();
      return;
    }
    submit.disabled = true;
    status.textContent = '制作依頼をScene設計へ変換しています…';
    try {
      const result = createAutoProductionProject({
        requestText,
        title: String(data.get('title') ?? ''),
        genre: 'great-person',
        platform: 'youtube-shorts',
        targetDurationSec: 60
      });
      if (!result.ok) {
        submit.disabled = false;
        status.textContent = result.reason === 'no-scenes'
          ? 'Scene見出しを認識できませんでした。「Scene 1」「Scene 2」のような見出しを含めてください。'
          : '制作依頼を入力してください。';
        return;
      }
      status.textContent = `${result.project.scenes.length}シーンを作成しました。保存しています…`;
      await saveProject(result.project);
      dialog.close();
      goScenes(result.project.id);
    } catch (error) {
      console.error(error);
      submit.disabled = false;
      status.textContent = `保存できませんでした：${error?.message || '不明なエラー'}`;
    }
  });
  return dialog;
}

function attachAutoProductionEntry() {
  const route = readRoute();
  if (route.page !== 'studio' || route.studio !== 'great-person') return;
  const createButton = document.getElementById('openCreate');
  const buttons = createButton?.closest('.hero-buttons');
  if (!createButton || !buttons || document.getElementById(BUTTON_ID)) return;

  ensureStyles();
  const button = document.createElement('button');
  button.id = BUTTON_ID;
  button.type = 'button';
  button.textContent = '✨ 制作依頼から作る';
  createButton.insertAdjacentElement('afterend', button);
  button.addEventListener('click', () => {
    const dialog = buildDialog();
    const status = dialog.querySelector('[data-auto-production-status]');
    if (status) status.textContent = '';
    dialog.showModal();
    setTimeout(() => dialog.querySelector('textarea[name="request"]')?.focus(), 0);
  });
}

const observer = new MutationObserver(attachAutoProductionEntry);
observer.observe(document.getElementById('app') || document.body, { childList: true, subtree: true });
window.addEventListener('hashchange', () => setTimeout(attachAutoProductionEntry, 0));
attachAutoProductionEntry();
