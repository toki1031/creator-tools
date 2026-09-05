import { readRoute, goHome, goStudio, goProject, goScenes, goBgm, goOutput, goPublish, goAi } from "./router.js";
import { createProject } from "./projectFactory.js";
import { deleteProject, getProject, listProjects, saveProject } from "./db.js";
import { downloadJson, downloadText } from "./download.js";
import { getVideoCapabilities, getProjectDuration, validateVideoProject, prepareVideoProject, runVisualPreview, exportProjectVideo, drawProjectFrame } from "./videoRenderer.js";
import { createProjectBackupPayload, createRestoredProject, LARGE_BACKUP_WARNING_BYTES, mergePronunciationDictionaries, normalizeImportedProject, parseProjectBackup, summarizeProjectBackup } from "./projectBackup.js";
import { addImageAsset, assetUsageCount, assetUsageScenes, ensureMediaLibrary, estimateAssetBytes, promoteLegacySceneImage, removeAllUnusedAssets, removeUnusedAsset, renameMediaAsset, resolveSceneImageSource, summarizeMediaLibrary } from "./mediaLibrary.js";
import { createAudioAssetIdFromFile, normalizeAudioAssetId } from "./audioAssetIdentity.js";
import { normalizeSubtitleOffset, resolveEffectiveSubtitlePosition, resolveSubtitleYRatio } from "./subtitlePosition.js";
import { assessMvpVideoResult, describeVideoExportFailure, isMvpShortsProject, validateMvpShortsOutput } from "./videoMvp.js";
import { createGenerationStartController, projectExpectsVideoAudio } from "./videoGenerationStart.js";
import { applyDictionaryEntries, normalizeSubtitleContentForSync, splitIntoScenes, splitSubtitleCards, subtitleContentChanged } from "./qualityLogic.js";
import { ensureLearningState, moveSceneWithDecision, recordBgmSelectionChange, recordBgmVolumeChange, recordGlobalSubtitlePositionChange, recordSceneDurationChange, recordSceneImageSelection, recordSceneMotionChange, recordSceneSubtitlePositionChange, recordSceneTransitionChange, recordSubtitleContentChange, recordSubtitleSceneSyncDecision, snapshotGlobalSubtitlePosition, snapshotSceneSubtitlePosition } from "./decisionLog.js";

const rootElement = document.querySelector("#app");
if (!rootElement) throw new Error("#app がありません。");
const root = rootElement;
const DICT_KEY = "creator-os-pronunciation-v1";

function normalizeSceneText(value = "") {
  return String(value).replace(/\r\n?/g, "\n").trim().replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").replace(/\n+/g, "\n");
}

function isStorageQuotaError(error) {
  return String(error?.name || '') === 'QuotaExceededError' || /保存容量|quota exceeded/i.test(String(error?.message || ''));
}

function createSaveController({ delay, persist, setStatus = () => {} }) {
  let timer = 0;
  let dirty = false;
  let savePromise = Promise.resolve();
  let quotaNoticeShown = false;
  const flushSave = () => {
    clearTimeout(timer);
    timer = 0;
    if (!dirty) return savePromise;
    dirty = false;
    savePromise = savePromise.catch(() => {}).then(async () => {
      setStatus("保存中…");
      await persist();
      quotaNoticeShown = false;
      setStatus("保存済み");
    });
    return savePromise;
  };
  const scheduleSave = () => {
    dirty = true;
    setStatus("保存中…");
    clearTimeout(timer);
    timer = setTimeout(() => { void flushSave().catch(error => {
      console.error(error);
      if (isStorageQuotaError(error)) {
        setStatus("容量不足：未使用素材を整理");
        if (!quotaNoticeShown) {
          quotaNoticeShown = true;
          alert('端末の保存容量が不足しているため保存できませんでした。\n\n画像素材ライブラリの「未使用素材をまとめて削除」や、不要なプロジェクトの整理後に再保存してください。\n\nCreator OSのプロジェクトが消える可能性があるため、SafariのWebサイトデータ削除は行わないでください。');
        }
      } else setStatus("保存失敗");
    }); }, delay);
  };
  return { scheduleSave, flushSave };
}

function bindSavedNavigation(button, flushSave, navigate) {
  if (!button) return;
  let navigating = false;
  button.onclick = async () => {
    if (navigating) return;
    navigating = true;
    button.disabled = true;
    try { await flushSave(); navigate(); }
    catch (error) { console.error(error); alert(`保存できなかったため移動を中止しました：${error.message}`); navigating = false; button.disabled = false; }
  };
}

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c] ?? c));
function getVideoGenerationConfirmDialog() {
  let dialog = document.querySelector('#videoGenerationConfirmDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'videoGenerationConfirmDialog';
  dialog.setAttribute('aria-labelledby', 'videoGenerationConfirmTitle');
  dialog.innerHTML = `<h2 id="videoGenerationConfirmTitle">動画生成を開始しますか？</h2>
    <p data-generation-message></p>
    <p class="notice">生成中はこの画面を前面に表示し、画面をロックしないでください。音声を使う場合は「生成を開始」を押した操作でWeb Audioを有効化します。</p>
    <div class="dialog-actions"><button type="button" data-generation-cancel>キャンセル</button><button type="button" class="primary" data-generation-confirm>生成を開始</button></div>`;
  document.body.appendChild(dialog);
  return dialog;
}


function getSubtitleSceneSyncDialog() {
  let dialog = document.querySelector('#subtitleSceneSyncDialog');
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = 'subtitleSceneSyncDialog';
  dialog.className = 'subtitle-sync-dialog';
  dialog.setAttribute('aria-labelledby', 'subtitleSceneSyncTitle');
  dialog.innerHTML = `<h2 id="subtitleSceneSyncTitle">シーン本文にも反映しますか？</h2>
    <p>字幕の文章がシーン本文と変わりました。改行・カード分割は字幕だけに残します。</p>
    <p class="notice">読み上げ用文章を手動調整済みの場合は上書きしません。シーン本文を変えると、古いナレーションは再生成対象になります。</p>
    <div class="dialog-actions"><button type="button" class="primary" data-subtitle-only>字幕だけ変更</button><button type="button" data-subtitle-sync>シーン本文にも反映</button></div>`;
  document.body.appendChild(dialog);
  return dialog;
}

function askSubtitleSceneSync() {
  const dialog = getSubtitleSceneSyncDialog();
  return new Promise(resolve => {
    let settled = false;
    const finish = choice => {
      if (settled) return;
      settled = true;
      dialog.oncancel = null;
      if (typeof dialog.close === 'function' && dialog.open) dialog.close();
      else dialog.removeAttribute('open');
      resolve(choice);
    };
    dialog.querySelector('[data-subtitle-only]').onclick = () => finish('subtitle-only');
    dialog.querySelector('[data-subtitle-sync]').onclick = () => finish('sync-to-scene');
    dialog.oncancel = event => { event.preventDefault(); finish('dismissed'); };
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  });
}

const finalReviewSignature = project => {
  const scenes=Array.isArray(project?.scenes)?project.scenes:[];
  const style=project?.subtitleStyle||{};
  return [`subtitle:${style.position||''}:${normalizeSubtitleOffset(style.positionOffsetPercent)}`, ...scenes.map((s,i)=>{
    const image=resolveSceneImageSource(project,s);
    return [
      i,
      image.source,
      image.assetId,
      String(image.data||"").length,
      String(s.videoData||"").length,
      String(s.text||"").trim(),
      String(s.subtitleText||"").trim(),
      String(s.speechText||"").trim(),
      String(s.narration?.audioData||"").length,
      Number(s.durationSec||0).toFixed(2),
      s.subtitlePosition||'',
      s.subtitlePosition ? normalizeSubtitleOffset(s.subtitlePositionOffsetPercent) : ''
    ].join(":");
  })].join("|");
};

const formatDate = (iso) => { const date=new Date(iso); return Number.isNaN(date.getTime()) ? "日時不明" : new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(date); };
const STUDIO = {
  "great-person": { icon:"🎓", title:"偉人Studio", desc:"調査・台本・ナレーション・画像・Shortsを一つの流れで制作", genre:"great-person", platform:"youtube-shorts", status:"利用可能" },
  "bgm": { icon:"🎵", title:"BGM Studio", desc:"音源・背景・ループ・長時間動画・投稿情報をまとめて制作", genre:"bgm", platform:"youtube-shorts", status:"基盤公開" },
  "education": { icon:"👶", title:"知育Studio", desc:"年齢別の遊び・解説・カルーセル・リール制作", genre:"education", platform:"instagram-reels", status:"準備中" },
  "fortune": { icon:"🍀", title:"開運Studio", desc:"暦・天体・投稿文・画像・過去投稿を管理", genre:"fortune", platform:"instagram-reels", status:"準備中" },
  "sns": { icon:"📱", title:"SNS Studio", desc:"タイトル・概要欄・キャプション・投稿履歴・分析", genre:"other", platform:"youtube-shorts", status:"準備中" }
};

function loadDictionary() {
  try {
    const value = JSON.parse(localStorage.getItem(DICT_KEY) || "[]");
    return Array.isArray(value) ? value.filter(x => x && x.from && x.to) : [];
  } catch { return []; }
}
function saveDictionary(entries) { localStorage.setItem(DICT_KEY, JSON.stringify(entries)); }
function downloadProjectBackup(project) { downloadJson(`${safeName(project.title)}.json`, createProjectBackupPayload(project, loadDictionary())); }
function restoreDialogMarkup() {
  return `<input id="restoreFile" type="file" accept=".json,application/json" hidden>
    <dialog id="restoreDialog"><form method="dialog" id="restoreForm">
      <h2>バックアップから復元</h2><div id="restoreSummary" class="restore-summary"></div>
      <label>復元後のプロジェクト名<input id="restoreTitle" required></label>
      <label id="restoreDictionaryOption" class="check"><input id="restoreDictionary" type="checkbox">読み方辞書も追加する（既存登録を優先）</label>
      <p class="notice">新しいプロジェクトとして保存します。元のプロジェクトは上書きしません。カスタムブランド設定は完全復元されない場合があります。</p>
      <div class="dialog-actions"><button type="button" id="cancelRestore">キャンセル</button><button type="submit" class="primary">新しいプロジェクトとして復元</button></div>
    </form></dialog>`;
}
function formatFileSize(bytes) { return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`; }
function formatApproxBytes(bytes) { const value=Math.max(0,Number(bytes)||0); if(value>=1024*1024)return `約 ${(value/1024/1024).toFixed(1)} MB`; if(value>=1024)return `約 ${(value/1024).toFixed(0)} KB`; return `約 ${Math.round(value)} B`; }
async function readFileText(file) {
  if (typeof file.text === 'function') return await file.text();
  return await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(reader.error||new Error('ファイルを読み込めませんでした。'));reader.readAsText(file);});
}
function mergePronunciationDictionary(imported) {
  const result=mergePronunciationDictionaries(loadDictionary(),imported);saveDictionary(result.dictionary);return result;
}
function bindProjectRestoreUi() {
  const button=root.querySelector('#openRestore'),input=root.querySelector('#restoreFile'),dialog=root.querySelector('#restoreDialog'),form=root.querySelector('#restoreForm');
  if(!button||!input||!dialog||!form)return;
  let candidate=null;
  button.onclick=()=>{input.value='';input.click();};
  root.querySelector('#cancelRestore').onclick=()=>{candidate=null;dialog.close();};
  input.onchange=async()=>{
    const file=input.files?.[0];if(!file)return;
    if(file.size===0){alert('JSONファイルが空です。');return;}
    if(file.size>=LARGE_BACKUP_WARNING_BYTES&&!confirm(`このバックアップは${formatFileSize(file.size)}あります。iPhoneでは読み込みに時間がかかる場合があります。続けますか？`))return;
    try{
      const parsed=parseProjectBackup(await readFileText(file));
      const normalized=normalizeImportedProject(parsed);
      const summary=summarizeProjectBackup(normalized.project,normalized.pronunciationDictionary,normalized.sourceSchemaVersion);
      candidate={file, ...normalized, summary};
      root.querySelector('#restoreTitle').value=`${summary.originalTitle}（復元）`;
      const dictionaryOption=root.querySelector('#restoreDictionaryOption');dictionaryOption.hidden=!summary.dictionaryCount;root.querySelector('#restoreDictionary').checked=false;
      const changes=[...normalized.fixes,...normalized.warnings];
      root.querySelector('#restoreSummary').innerHTML=`
        <dl><div><dt>ファイル</dt><dd>${escapeHtml(file.name)}（${formatFileSize(file.size)}）</dd></div><div><dt>元プロジェクト</dt><dd>${escapeHtml(summary.originalTitle)}</dd></div><div><dt>schemaVersion</dt><dd>${escapeHtml(String(summary.schemaVersion))}</dd></div><div><dt>シーン</dt><dd>${summary.sceneCount}件</dd></div><div><dt>画像／動画</dt><dd>${summary.imageCount}件／${summary.videoCount}件</dd></div><div><dt>画像素材ライブラリ</dt><dd>${summary.mediaLibraryCount||0}件</dd></div><div><dt>字幕あり</dt><dd>${summary.subtitleCount}件</dd></div><div><dt>シーン音声</dt><dd>${summary.sceneNarrationCount}件</dd></div><div><dt>全体音声／BGM</dt><dd>${summary.hasNarration?'あり':'なし'}／${summary.hasBgm?'あり':'なし'}</dd></div><div><dt>AI保存データ</dt><dd>${summary.hasAiData?'あり':'なし'}</dd></div><div><dt>読み方辞書</dt><dd>${summary.dictionaryCount}件</dd></div></dl>
        <div class="restore-warnings"><b>補完・修正・警告</b>${changes.length?`<ul>${changes.map(item=>`<li>${escapeHtml(item)}</li>`).join('')}</ul>`:'<p>特別な修正はありません。</p>'}</div>`;
      dialog.showModal();
    }catch(error){candidate=null;alert(error instanceof Error?error.message:'バックアップを読み込めませんでした。');}
  };
  form.onsubmit=async event=>{
    event.preventDefault();if(!candidate)return;
    const submit=form.querySelector('button[type="submit"]');submit.disabled=true;
    try{
      const restored=createRestoredProject(candidate.project,{title:root.querySelector('#restoreTitle').value});
      await saveProject(restored);
      let dictionaryMessage='';
      if(root.querySelector('#restoreDictionary').checked){const result=mergePronunciationDictionary(candidate.pronunciationDictionary);dictionaryMessage=`\n読み方辞書：${result.added}件追加、${result.skipped}件重複でスキップ`;}
      candidate=null;dialog.close();alert(`新しいプロジェクトとして復元しました。${dictionaryMessage}`);goProject(restored.id);
    }catch(error){alert(`復元に失敗しました：${error instanceof Error?error.message:String(error)}`);submit.disabled=false;}
  };
}
function applyDictionary(text, entries = loadDictionary()) {
  return applyDictionaryEntries(text, entries);
}
function naturalize(text, style) {
  let result = text.trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  if (style === "shorts") result = result.replace(/([。！？])/g, "$1\n").replace(/、/g, "、\n").replace(/\n{2,}/g, "\n");
  else if (style === "documentary") result = result.replace(/([。！？])/g, "$1\n\n").replace(/(しかし|ところが|実は|そして)/g, "\n$1、").replace(/\n{3,}/g, "\n\n");
  else if (style === "gentle") result = result.replace(/([。！？])/g, "$1\n").replace(/、/g, "、 ").replace(/\n{2,}/g, "\n");
  else result = result.replace(/([。！？])/g, "$1\n").replace(/\n{2,}/g, "\n");
  return result.trim();
}
function studioForGenre(genre) {
  if (genre === "great-person") return "great-person";
  if (genre === "bgm") return "bgm";
  if (genre === "education") return "education";
  if (genre === "fortune") return "fortune";
  return "sns";
}

async function renderHome() {
  const projects = await listProjects();
  root.innerHTML = `
    <main class="shell">
      <header class="brand"><div class="logo">✦</div><div><h1>Creator OS</h1><p>事業ごとの制作フローを、一つの場所に。</p></div></header>
      <section class="hero"><span class="eyebrow">STUDIO HUB</span><h2>今日は、どの事業を進めますか？</h2><p>共通機能は共有しながら、チャンネルごとに必要な作業と制作手順を分けて管理します。</p><div class="hero-buttons"><button id="openRestore">↥ バックアップから復元</button></div></section>
      <section class="studio-grid">
        ${Object.entries(STUDIO).map(([key,s]) => `<button class="studio-card ${s.status==="準備中"?"muted":""}" data-studio="${key}"><span class="studio-icon">${s.icon}</span><div><h3>${s.title}</h3><p>${s.desc}</p></div><small>${s.status}</small></button>`).join("")}
      </section>
      <section class="section-head recent-head"><div><h2>最近のプロジェクト</h2><p>${projects.length}件をこの端末に保存中</p></div></section>
      <section class="project-grid">
        ${projects.length ? projects.slice(0,6).map(p => `<article class="project-card" data-id="${p.id}"><span>${labelPlatform(p.platform)}</span><h3>${escapeHtml(p.title)}</h3><p>${labelGenre(p.genre)}・目標${p.targetDurationSec}秒</p><small>更新 ${formatDate(p.updatedAt)}</small></article>`).join("") : `<div class="empty"><div>🎬</div><h3>まだプロジェクトがありません</h3><p>上のStudioから最初の制作を始めましょう。</p></div>`}
      </section>${restoreDialogMarkup()}
    </main>`;
  bindProjectRestoreUi();
  root.querySelectorAll("[data-studio]").forEach(card => card.onclick = () => goStudio(card.dataset.studio));
  root.querySelectorAll(".project-card").forEach(card => card.onclick = () => card.dataset.id && goProject(card.dataset.id));
}

async function renderStudio(studioKey) {
  const studio = STUDIO[studioKey] || STUDIO["great-person"];
  const all = await listProjects();
  const projects = all.filter(p => studioForGenre(p.genre) === studioKey);
  const isBgm = studioKey === "bgm";
  root.innerHTML = `
    <main class="shell">
      <header class="editor-head"><button id="back">←</button><div><span>CREATOR OS</span><h1>${studio.icon} ${studio.title}</h1></div><button id="menu">•••</button></header>
      <section class="studio-hero"><h2>${isBgm ? "長時間BGM動画を、迷わず組み立てる" : "企画から完成動画までを一つの制作線に"}</h2><p>${studio.desc}</p><div class="hero-buttons"><button class="primary" id="openCreate">＋ 新しいプロジェクト</button><button id="openAiGuide">🤖 AIスタッフの使い方</button></div></section>
      ${isBgm ? `<section class="workflow-grid">
        <article><b>1</b><h3>テーマ設計</h3><p>雨・窓辺・睡眠・読書など、用途と雰囲気を決める。</p></article>
        <article><b>2</b><h3>音源管理</h3><p>無料BGM・自作音源・将来のAI作曲を登録し、利用条件も保存。</p></article>
        <article><b>3</b><h3>背景制作</h3><p>ChatGPT用の画像プロンプト作成、画像・短い動画素材を登録。</p></article>
        <article><b>4</b><h3>長時間化</h3><p>10分・1時間・3時間・8時間を選び、自然にループ。</p></article>
        <article><b>5</b><h3>映像演出</h3><p>ゆっくりズーム、雨粒、カーテンや葉の微かな動きを設定。</p></article>
        <article><b>6</b><h3>投稿準備</h3><p>タイトル・概要欄・タグ・サムネ文言をまとめて出力。</p></article>
      </section>` : `<section class="workflow-grid">
        <article><b>1</b><h3>企画・調査</h3><p>人物、テーマ、視聴者へのメッセージを整理。</p></article>
        <article><b>2</b><h3>台本・音声</h3><p>自然な語り口、読み方辞書、部分試聴。</p></article>
        <article><b>3</b><h3>シーン編集</h3><p>台本を場面に分け、画像・秒数・順番を設定。</p></article>
        <article><b>4</b><h3>BGM・字幕</h3><p>雰囲気に合う音源と読みやすい字幕を組み合わせる。</p></article>
        <article><b>5</b><h3>動画出力</h3><p>9:16のShortsとしてMP4へ書き出す。</p></article>
        <article><b>6</b><h3>投稿準備</h3><p>タイトル・概要欄・タグを作成。</p></article>
      </section>`}
      <section class="section-head recent-head"><div><h2>${studio.title}のプロジェクト</h2><p>${projects.length}件</p></div></section>
      <section class="project-grid">
        ${projects.length ? projects.map(p => `<article class="project-card" data-id="${p.id}"><span>${labelPlatform(p.platform)}</span><h3>${escapeHtml(p.title)}</h3><p>目標${p.targetDurationSec}秒</p><small>更新 ${formatDate(p.updatedAt)}</small></article>`).join("") : `<div class="empty"><div>${studio.icon}</div><h3>まだプロジェクトがありません</h3><p>「新しいプロジェクト」から始めてください。</p></div>`}
      </section>
      <dialog id="createDialog"><form method="dialog" id="createForm"><h2>新規プロジェクト</h2><label>タイトル<input name="title" required placeholder="${isBgm?"例：雨上がりの窓辺｜読書用BGM":"例：本田宗一郎｜学び直し"}"></label><label>投稿先<select name="platform">${isBgm?`<option value="youtube-shorts">YouTube（設定は後で長時間へ拡張）</option>`:`<option value="youtube-shorts">YouTube Shorts</option><option value="instagram-reels">Instagram Reels</option><option value="tiktok">TikTok</option>`}</select></label><div class="dialog-actions"><button type="button" id="cancelCreate">キャンセル</button><button type="submit" class="primary">作成する</button></div></form></dialog>
    </main>`;
  root.querySelector("#back").onclick = goHome;
  root.querySelectorAll(".project-card").forEach(card => card.onclick = () => goProject(card.dataset.id));
  const dialog = root.querySelector("#createDialog");
  root.querySelector("#openCreate").onclick = () => dialog.showModal();
  root.querySelector("#openAiGuide").onclick = () => alert("プロジェクトを開き、上部の「AIスタッフ」から担当別プロンプトを作成できます。現在は追加料金のない手動コピーモードです。");
  root.querySelector("#cancelCreate").onclick = () => dialog.close();
  root.querySelector("#createForm").onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const project = createProject(String(data.get("title")), studio.genre, String(data.get("platform")));
    if (isBgm) project.targetDurationSec = 60;
    await saveProject(project); dialog.close(); goProject(project.id);
  };
}

async function renderProject(id) {
  const project = await getProject(id);
  if (!project) { goHome(); return; }
  ensureProjectSettings(project);
  root.innerHTML = `
    <main class="shell editor-shell">
      <header class="editor-head"><button id="back">←</button><div><span>${labelPlatform(project.platform)}</span><h1>${escapeHtml(project.title)}</h1></div><button id="menu">•••</button></header>
      <nav class="steps"><button id="stepAi">0 AIスタッフ</button><button class="active">1 台本</button><button id="stepScenes">2 シーン・ナレーション</button><button id="stepBgm">3 字幕・BGM</button><button id="stepOutput">4 出力</button></nav>
      <section class="editor-card"><div class="section-head"><div><h2>表示用の台本</h2><p>字幕や画面に表示する文章です。</p></div><span id="displayCount">${project.displayScript.length}文字</span></div><textarea id="displayScript" placeholder="台本を貼り付けてください。">${escapeHtml(project.displayScript)}</textarea></section>
      <section class="editor-card"><div class="section-head"><div><h2>音声用の台本</h2><p>読み方辞書と語り口調整を反映する専用原稿です。</p></div><button id="copyDisplay">表示用からコピー</button></div><textarea id="speechScript" placeholder="音声用原稿">${escapeHtml(project.speechScript)}</textarea><div class="tool-row"><select id="narrationStyle"><option value="standard">標準</option><option value="shorts">Shorts・テンポ重視</option><option value="documentary">ドキュメンタリー</option><option value="gentle">やさしい語り</option></select><button id="naturalize">自然な語り口に整える</button><button id="applyDictionary">辞書を反映</button></div></section>
      <section class="editor-card"><div class="section-head"><div><h2>読み方辞書</h2><p>字幕は漢字のまま、音声原稿だけ読みを置き換えます。</p></div><button id="addDictionary">＋ 追加</button></div><div id="dictionaryList" class="dictionary-list"></div></section>
      <section class="editor-card"><div class="section-head"><div><h2>試聴</h2><p>選択範囲があればその部分だけ、なければ全文を読み上げます。</p></div><span id="voiceStatus">待機中</span></div><label>音声<select id="voiceSelect"><option>音声を読み込み中…</option></select></label><div class="voice-controls"><label>速度<div class="range-line"><input id="rate" type="range" min="0.6" max="1.5" value="${project.narration?.rate ?? .92}" step="0.01"><span id="rateValue">${Number(project.narration?.rate ?? .92).toFixed(2)}</span></div></label><label>高さ<div class="range-line"><input id="pitch" type="range" min="0.7" max="1.3" value="${project.narration?.pitch ?? .95}" step="0.01"><span id="pitchValue">${Number(project.narration?.pitch ?? .95).toFixed(2)}</span></div></label></div><div class="tool-row"><button class="primary" id="preview">▶ 部分試聴</button><button id="pause">⏸ 一時停止</button><button class="danger" id="stop">■ 停止</button></div></section>
      <section class="editor-card compact"><label>目標尺<input id="duration" type="number" min="5" max="28800" value="${project.targetDurationSec}"><span>秒</span></label><p id="saveState">保存済み</p></section>
      <section class="actions"><button id="exportJson">プロジェクトバックアップJSON</button><button class="danger" id="delete">削除</button><button class="primary" id="nextScenes">次へ：シーン編集</button></section>
      <dialog id="dictDialog"><form method="dialog" id="dictForm"><h2>読み方を登録</h2><input type="hidden" name="index"><label>表示語<input name="from" required placeholder="例：本田宗一郎"></label><label>読み<input name="to" required placeholder="例：ほんだ そういちろう"></label><div class="dialog-actions"><button value="cancel">キャンセル</button><button class="primary" value="default">保存</button></div></form></dialog>
    </main>`;

  attachProjectMenu(project, root.querySelector("#menu"), () => goStudio(studioForGenre(project.genre)));
  const display = root.querySelector("#displayScript");
  const speech = root.querySelector("#speechScript");
  const duration = root.querySelector("#duration");
  const saveState = root.querySelector("#saveState");
  const persist=async()=>{
    Object.assign(project,{displayScript:display.value,speechScript:speech.value,targetDurationSec:Math.max(5,Number(duration.value)||60),narration:{...(project.narration||{}),rate:Number(root.querySelector("#rate").value),pitch:Number(root.querySelector("#pitch").value),volume:Number(root.querySelector("#narrationVolume")?.value??project.narration?.volume??1)},updatedAt:new Date().toISOString()});
    await saveProject(project);
  };
  const {scheduleSave,flushSave}=createSaveController({delay:500,persist,setStatus:text=>saveState.textContent=text});
  bindSavedNavigation(root.querySelector("#back"),flushSave,()=>goStudio(studioForGenre(project.genre)));
  bindSavedNavigation(root.querySelector("#stepAi"),flushSave,()=>goAi(project.id));
  bindSavedNavigation(root.querySelector("#stepScenes"),flushSave,()=>goScenes(project.id));
  bindSavedNavigation(root.querySelector("#stepBgm"),flushSave,()=>goBgm(project.id));
  bindSavedNavigation(root.querySelector("#stepOutput"),flushSave,()=>goOutput(project.id));
  bindSavedNavigation(root.querySelector("#nextScenes"),flushSave,()=>goScenes(project.id));
  display.oninput = () => { root.querySelector("#displayCount").textContent = `${display.value.length}文字`; scheduleSave(); };
  speech.oninput = scheduleSave; duration.oninput = scheduleSave;
  root.querySelector("#copyDisplay").onclick = () => { speech.value = display.value; scheduleSave(); };
  root.querySelector("#naturalize").onclick = () => { speech.value = naturalize(speech.value || display.value, root.querySelector("#narrationStyle").value); scheduleSave(); };
  root.querySelector("#applyDictionary").onclick = () => { speech.value = applyDictionary(speech.value || display.value); scheduleSave(); };

  const dialog = root.querySelector("#dictDialog"), dictForm = root.querySelector("#dictForm");
  const renderDictionary = () => {
    const entries = loadDictionary();
    root.querySelector("#dictionaryList").innerHTML = entries.length ? entries.map((item,index) => `<div class="dictionary-item"><div><strong>${escapeHtml(item.from)}</strong><span>→ ${escapeHtml(item.to)}</span></div><div><button data-edit="${index}">編集</button><button class="danger" data-remove="${index}">削除</button></div></div>`).join("") : `<div class="dictionary-empty">まだ登録がありません。</div>`;
    root.querySelectorAll("[data-edit]").forEach(button => button.onclick = () => { const item=entries[Number(button.dataset.edit)]; dictForm.elements.index.value=button.dataset.edit; dictForm.elements.from.value=item.from; dictForm.elements.to.value=item.to; dialog.showModal(); });
    root.querySelectorAll("[data-remove]").forEach(button => button.onclick = () => { entries.splice(Number(button.dataset.remove),1); saveDictionary(entries); renderDictionary(); });
  };
  root.querySelector("#addDictionary").onclick = () => { dictForm.reset(); dictForm.elements.index.value=""; dialog.showModal(); };
  dictForm.onsubmit = event => { event.preventDefault(); const data=new FormData(dictForm), entries=loadDictionary(), item={from:String(data.get("from")).trim(),to:String(data.get("to")).trim()}, index=String(data.get("index")); if(!item.from||!item.to)return; if(index==="")entries.push(item);else entries[Number(index)]=item; saveDictionary(entries); dialog.close(); renderDictionary(); };
  renderDictionary();

  const synth=window.speechSynthesis; let voices=[];
  const loadVoices=()=>{ voices=synth?.getVoices?.()||[]; const japanese=voices.filter(v=>v.lang.toLowerCase().startsWith("ja")), use=japanese.length?japanese:voices, select=root.querySelector("#voiceSelect"); select.innerHTML=use.length?use.map((voice,index)=>`<option value="${index}">${escapeHtml(voice.name)}（${escapeHtml(voice.lang)}）</option>`).join(""):`<option>利用できる音声がありません</option>`; select._voices=use; };
  loadVoices(); if(synth)synth.onvoiceschanged=loadVoices;
  ["rate","pitch"].forEach(id=>{const el=root.querySelector(`#${id}`),out=root.querySelector(`#${id}Value`);el.oninput=()=>{out.textContent=Number(el.value).toFixed(2);scheduleSave();};});
  const setStatus=text=>root.querySelector("#voiceStatus").textContent=text;
  root.querySelector("#preview").onclick=()=>{const selected=speech.value.slice(speech.selectionStart,speech.selectionEnd).trim(),text=applyDictionary(selected||speech.value||display.value).trim();if(!text)return alert("試聴する文章を入力してください。");synth.cancel();const u=new SpeechSynthesisUtterance(text),select=root.querySelector("#voiceSelect"),list=select._voices||[];u.voice=list[Number(select.value)]||null;u.lang=u.voice?.lang||"ja-JP";u.rate=Number(root.querySelector("#rate").value);u.pitch=Number(root.querySelector("#pitch").value);u.onstart=()=>setStatus("読み上げ中");u.onend=()=>setStatus("完了");u.onerror=event=>{const reason=String(event?.error||'不明');let cause='端末の音声読み上げを開始できませんでした。',next='音声を選び直して、短い文章で再度「部分試聴」を押してください。';if(reason==='not-allowed'){cause='Safariまたは端末で音声再生が許可されていない可能性があります。';next='消音設定と音量を確認し、Creator OS画面を直接タップしてから再試聴してください。';}else if(reason==='voice-unavailable'||reason==='language-unavailable'||reason==='synthesis-unavailable'){cause='選択した日本語音声をこの端末で利用できない可能性があります。';next='別の日本語音声を選択して再試聴してください。';}else if(reason==='audio-busy'||reason==='audio-hardware'){cause='端末の音声出力が他の処理で使用中、または利用できない可能性があります。';next='他の音声・動画再生を停止してから再試聴してください。';}setStatus(`試聴失敗：${reason}`);alert(`音声試聴に失敗しました。\n\n原因：${cause}\n詳細：${reason}\n次の操作：${next}`);};synth.speak(u);};
  root.querySelector("#pause").onclick=()=>{if(synth.paused){synth.resume();setStatus("読み上げ中");}else{synth.pause();setStatus("一時停止中");}};
  root.querySelector("#stop").onclick=()=>{synth.cancel();setStatus("停止しました");};
  root.querySelector("#exportJson").onclick=()=>downloadProjectBackup(project);
  root.querySelector("#delete").onclick=async()=>{if(confirm("このプロジェクトを削除しますか？")){await deleteProject(project.id);goStudio(studioForGenre(project.genre));}};
}


function reconcileScenes(oldScenes, freshScenes) {
  const used = new Set();
  const matches = freshScenes.map(scene => {
    const normalized = normalizeSceneText(scene.text);
    const index = oldScenes.findIndex((old, oldIndex) => !used.has(oldIndex) && normalizeSceneText(old.text) === normalized);
    if (index < 0) return null;
    used.add(index);
    return { old:oldScenes[index], exact:true };
  });
  return freshScenes.map((scene,index) => {
    let match = matches[index];
    if (!match && oldScenes[index] && !used.has(index)) {
      used.add(index);
      match = { old:oldScenes[index], exact:false };
    }
    if (!match) return { ...scene, subtitleText:scene.text, subtitleEnabled:true, subtitlePhraseSync:true, subtitleStartSec:0, subtitleEndSec:scene.durationSec };
    const old = match.old;
    if (match.exact) {
      const duration=Math.max(1,Number(old.durationSec)||scene.durationSec);
      const start=Math.min(duration,Math.max(0,Number(old.subtitleStartSec)||0));
      const end=Math.min(duration,Math.max(start,Number(old.subtitleEndSec)||duration));
      return {...scene,...old,id:old.id||scene.id,text:scene.text,speechText:old.speechText??scene.speechText,durationSec:duration,subtitleText:old.subtitleText??scene.text,subtitleEnabled:old.subtitleEnabled??true,subtitlePhraseSync:old.subtitlePhraseSync??true,subtitleStartSec:start,subtitleEndSec:end};
    }
    return {...scene,id:old.id||scene.id,...(old.imageAssetId ? {imageAssetId:old.imageAssetId} : {}),imageData:old.imageData||"",videoData:old.videoData||"",motion:old.motion||scene.motion,transition:old.transition||scene.transition,...(old.subtitlePosition ? {subtitlePosition:old.subtitlePosition,subtitlePositionOffsetPercent:normalizeSubtitleOffset(old.subtitlePositionOffsetPercent)} : {}),subtitleText:scene.text,subtitleEnabled:true,subtitlePhraseSync:true,subtitleStartSec:0,subtitleEndSec:scene.durationSec};
  });
}

function updateSceneText(scene, newText) {
  const oldText=String(scene.text||"");
  const oldNormalized=normalizeSceneText(oldText), newNormalized=normalizeSceneText(newText);
  if (scene.subtitleText == null || normalizeSceneText(scene.subtitleText) === oldNormalized) scene.subtitleText=newText;
  if (scene.speechText == null || normalizeSceneText(scene.speechText) === oldNormalized) scene.speechText=newText;
  scene.text=newText;
  if (oldNormalized !== newNormalized) delete scene.narration;
}

function updateSceneDuration(scene, value) {
  const oldDuration=Math.max(1,Number(scene.durationSec)||1);
  const newDuration=Math.max(1,Number(value)||1);
  const oldEnd=Number(scene.subtitleEndSec);
  let start=Math.min(newDuration,Math.max(0,Number(scene.subtitleStartSec)||0));
  let end=scene.subtitleEndSec==null||Math.abs(oldEnd-oldDuration)<0.001?newDuration:Math.min(newDuration,Math.max(0,oldEnd||newDuration));
  end=Math.max(start,end);
  scene.durationSec=newDuration;
  scene.subtitleStartSec=start;
  scene.subtitleEndSec=end;
}

async function fileToDataUrl(file) {
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
}

async function renderScenes(id) {
  const project=await getProject(id);
  if(!project){goHome();return;}
  if(!Array.isArray(project.scenes)) project.scenes=[];
  ensureMediaLibrary(project);
  root.innerHTML=`
    <main class="shell editor-shell">
      <header class="editor-head"><button id="back">←</button><div><span>${labelPlatform(project.platform)}</span><h1>${escapeHtml(project.title)}</h1></div><button id="menu">•••</button></header>
      <nav class="steps"><button id="stepAi">0 AIスタッフ</button><button id="stepScript">1 台本</button><button class="active">2 シーン・ナレーション</button><button id="stepBgm">3 字幕・BGM</button><button id="stepOutput">4 出力</button></nav>
      <section class="editor-card"><div class="section-head"><div><h2>シーン編集</h2><p>台本を場面に分け、画像・表示秒数・演出を設定します。</p></div><span id="sceneCount">${project.scenes.length}シーン</span></div><div class="tool-row"><button class="primary" id="autoSplit">台本から自動分割</button><button id="addScene">＋ 空のシーン</button><button id="manageMediaLibrary">画像素材ライブラリ</button><button id="undoScenes" disabled>↶ 1つ前に戻す</button></div><p class="muted">再分割時は既存の画像・動画をできるだけ保持します。文章が変わったシーンのナレーションは誤読防止のため再生成対象になります。</p></section>
      <section id="sceneList" class="scene-list"></section>
      <dialog id="mediaLibraryDialog" class="media-library-dialog">
        <div class="section-head"><div><h2>画像素材ライブラリ</h2><p id="mediaLibraryTarget">このシーンで使う画像を選びます。</p></div></div>
        <div id="mediaLibrarySummary" class="media-library-summary"></div>
        <div id="mediaLibraryFilters" class="media-library-filters" aria-label="素材表示フィルター">
          <button type="button" data-library-filter="all">すべて</button><button type="button" data-library-filter="used">使用中</button><button type="button" data-library-filter="unused">未使用</button>
        </div>
        <div id="mediaLibraryGrid" class="media-library-grid"></div>
        <div class="dialog-actions"><button type="button" id="deleteUnusedAssets" class="danger">未使用素材をまとめて削除</button><button type="button" id="closeMediaLibrary">閉じる</button></div>
      </dialog>
      <section class="editor-card">
        <div class="section-head"><div><h2>次にナレーション</h2><p>シーンの文章・画像・順番を確定してから、各シーンの音声を生成します。音声実尺に合わせてシーン尺と字幕タイミングを自動同期します。</p></div><span>${project.scenes.filter(s=>s.narration?.audioData).length}/${project.scenes.length} 音声済み</span></div>
        <div class="tool-row"><a class="button-link primary" href="./voice-lab.html?project=${encodeURIComponent(project.id)}&return=scenes">✦ シーン別ナレーションを作成</a></div>
      </section>
      <section class="editor-card compact"><div><b>合計時間</b><p id="totalDuration">0秒</p></div><p id="saveState">保存済み</p></section>
      <section class="actions"><button id="backScript">← 台本へ</button><button id="exportJson">プロジェクトバックアップJSON</button><button class="primary" id="nextBgm">次へ：字幕・BGM</button></section>
    </main>`;
  attachProjectMenu(project, root.querySelector("#menu"), () => goStudio(studioForGenre(project.genre)));
  const saveState=root.querySelector("#saveState"); let pendingAsset=Promise.resolve();
  const persist=async()=>{await pendingAsset;project.scenes.forEach((s,i)=>s.order=i+1);project.updatedAt=new Date().toISOString();await saveProject(project);};
  const {scheduleSave:save,flushSave}=createSaveController({delay:400,persist,setStatus:text=>saveState.textContent=text});
  bindSavedNavigation(root.querySelector("#back"),flushSave,()=>goStudio(studioForGenre(project.genre)));
  bindSavedNavigation(root.querySelector("#stepAi"),flushSave,()=>goAi(project.id));
  bindSavedNavigation(root.querySelector("#stepScript"),flushSave,()=>goProject(project.id));
  bindSavedNavigation(root.querySelector("#stepBgm"),flushSave,()=>goBgm(project.id));
  bindSavedNavigation(root.querySelector("#stepOutput"),flushSave,()=>goOutput(project.id));
  bindSavedNavigation(root.querySelector("#nextBgm"),flushSave,()=>goBgm(project.id));
  bindSavedNavigation(root.querySelector("#backScript"),flushSave,()=>goProject(project.id));
  let sceneUndoSnapshot=null;
  const cloneScenes=value=>{try{return structuredClone(value);}catch{return JSON.parse(JSON.stringify(value));}};
  const snapshotScenes=()=>{sceneUndoSnapshot=cloneScenes(project.scenes||[]);const b=root.querySelector("#undoScenes");if(b)b.disabled=false;};
  const restoreScenes=()=>{if(!sceneUndoSnapshot)return;const current=cloneScenes(project.scenes||[]);project.scenes=cloneScenes(sceneUndoSnapshot);sceneUndoSnapshot=current;save();renderList();};
  const total=()=>project.scenes.reduce((sum,s)=>sum+(Number(s.durationSec)||0),0);
  let libraryTargetIndex=null;
  let libraryMode="manage";
  let libraryFilter="all";
  const mediaLibraryDialog=root.querySelector("#mediaLibraryDialog");
  const renderMediaLibrary=()=>{
    const library=ensureMediaLibrary(project);
    const grid=root.querySelector("#mediaLibraryGrid");
    const target=libraryMode==="select"&&libraryTargetIndex!=null?project.scenes[libraryTargetIndex]:null;
    const summary=summarizeMediaLibrary(project);
    root.querySelector("#mediaLibraryTarget").textContent=target?`シーン ${libraryTargetIndex+1} で使う画像を選びます。`:"プロジェクトに保存されている画像素材を確認・整理します。";
    root.querySelector("#mediaLibrarySummary").innerHTML=`<span>画像素材 <b>${summary.totalCount}</b>件</span><span>使用中 <b>${summary.usedCount}</b>件</span><span>未使用 <b>${summary.unusedCount}</b>件</span><span>推定容量 <b>${formatApproxBytes(summary.estimatedBytes)}</b></span>`;
    root.querySelectorAll("[data-library-filter]").forEach(button=>button.classList.toggle("active",button.dataset.libraryFilter===libraryFilter));
    const filtered=library.filter(asset=>{const used=assetUsageCount(project,asset.id)>0;return libraryFilter==="used"?used:libraryFilter==="unused"?!used:true;});
    grid.innerHTML=filtered.length?filtered.map(asset=>{
      const usageScenes=assetUsageScenes(project,asset.id);
      const usage=usageScenes.length;
      const usageText=usage?`シーン${usageScenes.map(item=>item.number).join("・")}で使用中`:"未使用";
      const name=asset.fileName||"画像素材";
      const nameMarkup=libraryMode==="manage"?`<label class="media-asset-name">素材名<input data-rename-asset="${escapeHtml(asset.id)}" value="${escapeHtml(name)}" maxlength="120"></label>`:`<b>${escapeHtml(name)}</b>`;
      const useButton=target?`<button type="button" data-use-asset="${escapeHtml(asset.id)}">このシーンで使う</button>`:"";
      return `<article class="media-asset-card"><img src="${asset.data}" alt=""><div class="media-asset-info">${nameMarkup}<small>${usageText}</small><small>${formatApproxBytes(estimateAssetBytes(asset))}</small></div><div class="media-asset-actions">${useButton}<button type="button" class="danger" data-delete-asset="${escapeHtml(asset.id)}" ${usage?"disabled":""}>未使用なら削除</button></div></article>`;
    }).join(""):`<div class="dictionary-empty">${library.length?"この条件に合う画像素材はありません。":"まだ画像素材がありません。シーンで画像をアップロードすると、ここに保存されます。"}</div>`;
    grid.querySelectorAll("[data-use-asset]").forEach(button=>button.onclick=()=>{
      const scene=project.scenes[libraryTargetIndex];
      if(!scene)return;
      const assetId=button.dataset.useAsset;
      const beforeAssetId=scene.imageAssetId||null;
      const candidateAssetIds=filtered.map(asset=>asset.id);
      promoteLegacySceneImage(project,scene,{fileName:`シーン ${libraryTargetIndex+1} の旧画像`});
      scene.imageAssetId=assetId;
      delete scene.imageData;
      recordSceneImageSelection(project,{sceneId:scene.id,beforeAssetId,afterAssetId:assetId,sceneIndex:libraryTargetIndex,candidateAssetIds});
      save();mediaLibraryDialog.close();renderList();
    });
    grid.querySelectorAll("[data-rename-asset]").forEach(input=>input.onchange=()=>{
      const name=input.value.trim();
      if(!name){alert("素材名を入力してください。");renderMediaLibrary();return;}
      if(renameMediaAsset(project,input.dataset.renameAsset,name)){save();renderMediaLibrary();}
    });
    grid.querySelectorAll("[data-delete-asset]").forEach(button=>button.onclick=()=>{
      const assetId=button.dataset.deleteAsset;
      if(assetUsageCount(project,assetId)>0){alert("この素材はシーンで使用中のため削除できません。");return;}
      if(!confirm("この未使用画像を素材ライブラリから削除しますか？"))return;
      if(removeUnusedAsset(project,assetId)){save();renderMediaLibrary();}
    });
    const bulk=root.querySelector("#deleteUnusedAssets");
    bulk.hidden=libraryMode!=="manage";
    bulk.disabled=summary.unusedCount===0;
    bulk.textContent=summary.unusedCount?`未使用素材をまとめて削除（${summary.unusedCount}件）`:"未使用素材はありません";
    bulk.onclick=()=>{
      const current=summarizeMediaLibrary(project);
      if(!current.unusedCount)return;
      if(!confirm(`未使用の画像素材${current.unusedCount}件を削除しますか？\n使用中の素材は削除されません。`))return;
      const removed=removeAllUnusedAssets(project);
      if(removed){save();renderMediaLibrary();}
    };
  };
  const openMediaLibrary=index=>{libraryTargetIndex=Number.isInteger(index)?index:null;libraryMode=libraryTargetIndex==null?"manage":"select";libraryFilter="all";renderMediaLibrary();mediaLibraryDialog.showModal();};
  root.querySelectorAll("[data-library-filter]").forEach(button=>button.onclick=()=>{libraryFilter=button.dataset.libraryFilter||"all";renderMediaLibrary();});
  root.querySelector("#manageMediaLibrary").onclick=()=>openMediaLibrary(null);
  root.querySelector("#closeMediaLibrary").onclick=()=>mediaLibraryDialog.close();
  const renderList=()=>{
    root.querySelector("#sceneCount").textContent=`${project.scenes.length}シーン`;
    root.querySelector("#totalDuration").textContent=`${total()}秒`;
    root.querySelector("#sceneList").innerHTML=project.scenes.length?project.scenes.map((s,i)=>{
      const image=resolveSceneImageSource(project,s).data;
      return `
      <article class="scene-card" data-index="${i}">
        <div class="scene-preview">${image?`<img src="${image}" alt="">`:`<span>画像未登録</span>`}</div>
        <div class="scene-body"><div class="scene-title"><b>シーン ${i+1}</b><div><button data-up="${i}" ${i===0?"disabled":""}>↑</button><button data-down="${i}" ${i===project.scenes.length-1?"disabled":""}>↓</button><button class="danger" data-remove="${i}">削除</button></div></div>
        <textarea data-text="${i}" placeholder="このシーンの字幕・内容">${escapeHtml(s.text||"")}</textarea>
        <p class="${s.narration?.audioData?'ok':'muted'}">${s.narration?.audioData?`✓ シーン音声 ${Number(s.narration.durationSec||0).toFixed(2)}秒／字幕フレーズ同期 ON`:'− シーン音声 未生成'}</p>
        <div class="scene-settings"><div class="scene-image-control"><label>画像<input data-image="${i}" type="file" accept="image/*"></label><button type="button" data-library="${i}">素材から選ぶ</button></div><label>秒数<input data-duration="${i}" type="number" min="1" max="3600" value="${Number(s.durationSec)||5}"></label><label>動き<select data-motion="${i}"><option value="none" ${s.motion==="none"?"selected":""}>なし</option><option value="zoom-in" ${s.motion==="zoom-in"?"selected":""}>ズームイン</option><option value="zoom-out" ${s.motion==="zoom-out"?"selected":""}>ズームアウト</option><option value="pan-left" ${s.motion==="pan-left"?"selected":""}>左へパン</option><option value="pan-right" ${s.motion==="pan-right"?"selected":""}>右へパン</option></select></label><label>切り替え<select data-transition="${i}"><option value="fade" ${s.transition!=="cut"?"selected":""}>フェード</option><option value="cut" ${s.transition==="cut"?"selected":""}>カット</option></select></label></div></div>
      </article>`;
    }).join(""):`<div class="empty"><div>🖼️</div><h3>シーンがありません</h3><p>「台本から自動分割」または「空のシーン」を押してください。</p></div>`;
    root.querySelectorAll("[data-text]").forEach(el=>el.oninput=()=>{updateSceneText(project.scenes[Number(el.dataset.text)],el.value);save();});
    root.querySelectorAll("[data-duration]").forEach(el=>{
      const index=Number(el.dataset.duration);
      el.onfocus=()=>{el.dataset.durationBefore=String(Math.max(1,Number(project.scenes[index]?.durationSec)||1));};
      el.oninput=()=>{updateSceneDuration(project.scenes[index],el.value);root.querySelector("#totalDuration").textContent=`${total()}秒`;save();};
      el.onblur=()=>{
        const scene=project.scenes[index];if(!scene)return;
        const before=Number(el.dataset.durationBefore),raw=Number(el.value),after=Math.max(1,Number(scene.durationSec)||1);
        if(Number.isFinite(raw)&&raw>=1&&Number.isFinite(before)&&before>=1){
          const currentTotal=total();
          recordSceneDurationChange(project,{sceneId:scene.id,beforeDurationSec:before,afterDurationSec:after,sceneIndex:index,totalDurationBefore:currentTotal-after+before});
        }
        el.dataset.durationBefore=String(after);save();
      };
    });
    root.querySelectorAll("[data-motion]").forEach(el=>el.onchange=()=>{
      const index=Number(el.dataset.motion),scene=project.scenes[index];
      if(!scene)return;
      const before=scene.motion,after=el.value;
      scene.motion=after;
      recordSceneMotionChange(project,{sceneId:scene.id,beforeMotion:before,afterMotion:after,sceneIndex:index});
      save();
    });
    root.querySelectorAll("[data-transition]").forEach(el=>el.onchange=()=>{
      const index=Number(el.dataset.transition),scene=project.scenes[index];
      if(!scene)return;
      const before=scene.transition==="cut"?"cut":"fade",after=el.value;
      scene.transition=after;
      recordSceneTransitionChange(project,{sceneId:scene.id,beforeTransition:before,afterTransition:after,sceneIndex:index});
      save();
    });
    root.querySelectorAll("[data-image]").forEach(el=>el.onchange=async()=>{const file=el.files?.[0];if(!file)return;if(file.size>3_000_000&&!confirm("画像が大きいため保存容量を圧迫する可能性があります。続けますか？"))return;const scene=project.scenes[Number(el.dataset.image)];pendingAsset=fileToDataUrl(file).then(data=>{promoteLegacySceneImage(project,scene,{fileName:`シーン ${Number(el.dataset.image)+1} の旧画像`});const asset=addImageAsset(project,{data,fileName:file.name});scene.imageAssetId=asset.id;delete scene.imageData;});save();await pendingAsset;renderList();});
    root.querySelectorAll("[data-library]").forEach(el=>el.onclick=()=>openMediaLibrary(Number(el.dataset.library)));
    root.querySelectorAll("[data-remove]").forEach(el=>el.onclick=()=>{if(!confirm("このシーンを削除しますか？ 削除後も「1つ前に戻す」で復元できます。"))return;const index=Number(el.dataset.remove);promoteLegacySceneImage(project,project.scenes[index],{fileName:`シーン ${index+1} の旧画像`});snapshotScenes();project.scenes.splice(index,1);save();renderList();});
    root.querySelectorAll("[data-up]").forEach(el=>el.onclick=()=>{const record=moveSceneWithDecision(project,Number(el.dataset.up),"up");if(!record)return;save();renderList();});
    root.querySelectorAll("[data-down]").forEach(el=>el.onclick=()=>{const record=moveSceneWithDecision(project,Number(el.dataset.down),"down");if(!record)return;save();renderList();});
  };
  root.querySelector("#autoSplit").onclick=()=>{
    const oldScenes=project.scenes||[];
    if(oldScenes.length&&!confirm("台本を再分割します。\n\n現在の画像・動画・演出は、同じ順番のシーンへできるだけ保持します。\n文章が変わったシーンのナレーションは再生成対象になります。\n\n続けますか？"))return;
    oldScenes.forEach((scene,index)=>promoteLegacySceneImage(project,scene,{fileName:`シーン ${index+1} の旧画像`}));
    const fresh=splitIntoScenes(project.displayScript||project.speechScript,project.targetDurationSec);
    snapshotScenes();
    project.scenes=reconcileScenes(oldScenes,fresh);
    save();renderList();
  };
  root.querySelector("#undoScenes").onclick=restoreScenes;
  root.querySelector("#addScene").onclick=()=>{snapshotScenes();project.scenes.push({id:crypto.randomUUID?.()||`scene-${Date.now()}`,order:project.scenes.length+1,text:"",speechText:"",durationSec:5,imageData:"",motion:"zoom-in",transition:"fade",subtitleText:"",subtitleEnabled:true,subtitlePhraseSync:true,subtitleStartSec:0,subtitleEndSec:5});save();renderList();};
  root.querySelector("#exportJson").onclick=()=>downloadProjectBackup(project);
  renderList();
}


function ensureProjectSettings(project) {
  ensureMediaLibrary(project);
  ensureLearningState(project);
  project.narration = { voiceURI:"", rate:0.92, pitch:0.94, volume:1, source:"browser", audioData:"", fileName:"", mimeType:"", ...(project.narration || {}) };
  project.bgm = project.bgm || { source:"none", title:"", category:"calm", volume:0.12, ducking:true, fadeInSec:1, fadeOutSec:2, loop:true, license:"", credit:"", audioData:"", fileName:"", audioAssetId:"" };
  project.bgm.audioAssetId = normalizeAudioAssetId(project.bgm.audioAssetId);
  project.subtitleStyle = {
    enabled:true, preset:"standard", fontSize:54, position:"bottom", positionOffsetPercent:0, maxCharsPerLine:16, maxLines:2,
    textColor:"#ffffff", outlineColor:"#000000", outlineWidth:4,
    backgroundEnabled:false, backgroundColor:"#000000", backgroundOpacity:0.45,
    align:"center", ...(project.subtitleStyle || {})
  };
  project.subtitleStyle.positionOffsetPercent = normalizeSubtitleOffset(project.subtitleStyle.positionOffsetPercent);
  project.output = project.output || { width:1080, height:1920, fps:30, format:"mp4", quality:"standard", subtitles:true, subtitlePosition:"bottom", bgmEnabled:true };
  project.output.subtitles = project.output.subtitles ?? project.subtitleStyle.enabled;
  project.output.subtitlePosition = project.output.subtitlePosition || project.subtitleStyle.position;
  project.publish = project.publish || { title:project.title, description:"", tags:"", thumbnailText:"", visibility:"private" };
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  scenes.forEach(scene => {
    const duration = Math.max(1, Number(scene.durationSec) || 5);
    scene.subtitleText = scene.subtitleText ?? scene.text ?? "";
    scene.subtitleEnabled = scene.subtitleEnabled ?? true;
    scene.subtitlePhraseSync = scene.subtitlePhraseSync ?? true;
    scene.subtitleStartSec = Math.max(0, Math.min(duration, Number(scene.subtitleStartSec) || 0));
    scene.subtitleEndSec = Math.max(scene.subtitleStartSec, Math.min(duration, Number(scene.subtitleEndSec) || duration));
  });
}

function countChars(value="") { return Array.from(String(value).replace(/\s/g, "")).length; }
function formatSubtitleLines(value, maxChars=16, maxLines=2) {
  const normalized = String(value || "").trim();
  if (!normalized) return { lines:[], cards:[], overflow:false, chars:0 };
  const cards=splitSubtitleCards(normalized).map(card=>{
    const manual=/\n/.test(card);
    const lines=[];
    if(manual) lines.push(...card.split("\n").map(line=>line.trim()).filter(Boolean));
    else { const chars=Array.from(card); while(chars.length) lines.push(chars.splice(0,Math.max(1,maxChars)).join("")); }
    return {lines:lines.slice(0,Math.max(1,maxLines)),overflow:lines.length>maxLines};
  });
  return {lines:cards[0]?.lines||[],cards,overflow:cards.some(card=>card.overflow),chars:countChars(normalized)};
}
function hexToRgba(hex, alpha) {
  const clean = String(hex || "#000000").replace("#", "");
  const value = clean.length === 3 ? clean.split("").map(c=>c+c).join("") : clean.padEnd(6,"0").slice(0,6);
  const number = Number.parseInt(value,16);
  return `rgba(${(number>>16)&255},${(number>>8)&255},${number&255},${Math.max(0,Math.min(1,Number(alpha)||0))})`;
}
function buildSubtitleTimeline(project) {
  ensureProjectSettings(project);
  let cursor = 0;
  return (project.scenes || []).map((scene,index) => {
    const duration = Math.max(1, Number(scene.durationSec)||1);
    const item = {
      id:scene.id, sceneIndex:index, sceneNumber:index+1,
      enabled:project.subtitleStyle.enabled && scene.subtitleEnabled !== false,
      text:scene.subtitleText || "",
      startSec:cursor + Math.max(0, Number(scene.subtitleStartSec)||0),
      endSec:cursor + Math.min(duration, Math.max(Number(scene.subtitleStartSec)||0, Number(scene.subtitleEndSec)||duration)),
      style:{...project.subtitleStyle}
    };
    cursor += duration;
    return item;
  }).filter(item => item.enabled && item.text.trim() && item.endSec > item.startSec);
}
function srtTime(seconds) {
  const ms = Math.max(0, Math.round(Number(seconds)*1000));
  const h = Math.floor(ms/3600000), m=Math.floor(ms%3600000/60000), s=Math.floor(ms%60000/1000), x=ms%1000;
  return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(x).padStart(3,"0")}`;
}
function buildSrt(project) {
  return buildSubtitleTimeline(project).map((item,index)=>`${index+1}\\n${srtTime(item.startSec)} --> ${srtTime(item.endSec)}\\n${item.text.trim()}\\n`).join("\\n");
}

function attachProjectMenu(project, button, afterDelete) {
  if (!button) return;
  button.onclick = async () => {
    const choice = prompt("プロジェクトメニュー\n1：名前を変更\n2：複製\n3：プロジェクトバックアップJSON\n4：削除\n\n番号を入力してください。", "1");
    if (choice === "1") {
      const title = prompt("新しいプロジェクト名", project.title);
      if (title?.trim()) { project.title=title.trim(); project.updatedAt=new Date().toISOString(); await saveProject(project); location.reload(); }
    } else if (choice === "2") {
      const copy=structuredClone(project); copy.id=crypto.randomUUID?.()||`project-${Date.now()}`; copy.title=`${project.title} のコピー`; copy.createdAt=copy.updatedAt=new Date().toISOString(); await saveProject(copy); goProject(copy.id);
    } else if (choice === "3") downloadProjectBackup(project);
    else if (choice === "4" && confirm("このプロジェクトを削除しますか？")) { await deleteProject(project.id); afterDelete(); }
  };
}

async function renderBgm(id) {
  const project=await getProject(id); if(!project){goHome();return;}
  ensureProjectSettings(project);
  const b=project.bgm, st=project.subtitleStyle, scenes=project.scenes||[];
  root.innerHTML=`<main class="shell editor-shell">
    <header class="editor-head"><button id="back">←</button><div><span>${labelPlatform(project.platform)}</span><h1>${escapeHtml(project.title)}</h1></div><button id="menu">•••</button></header>
    <nav class="steps"><button id="stepAi">0 AIスタッフ</button><button id="stepScript">1 台本</button><button id="stepScenes">2 シーン・ナレーション</button><button class="active">3 字幕・BGM</button><button id="stepOutput">4 出力</button></nav>
    <section class="editor-card"><div class="section-head"><div><h2>BGM・音源</h2><p>音源の種類、音量、ループ、利用条件を保存します。</p></div><span id="saveState">保存済み</span></div>
      <div class="form-grid"><label>音源の種類<select id="source"><option value="none">BGMなし</option><option value="upload">自分の音源をアップロード</option><option value="free">無料BGM（情報を登録）</option><option value="ai">AI生成BGM（後で追加）</option></select></label><label>雰囲気<select id="category"><option value="calm">教養・落ち着き</option><option value="history">歴史・重厚</option><option value="challenge">挑戦・前進</option><option value="emotion">感動・余韻</option><option value="rain">雨・環境音</option><option value="sleep">睡眠・リラックス</option></select></label></div>
      <label>BGM名<input id="bgmTitle" value="${escapeHtml(b.title||"")}" placeholder="例：静かなピアノと雨音"></label>
      <label>音源ファイル<input id="audioFile" type="file" accept="audio/*,.mp3,.m4a,.aac,.wav"><small id="fileName">${escapeHtml(b.fileName||"未登録")}</small><small>MP3 / M4A / AAC / WAV対応。MOV / MP4などの動画は、まず音声ファイルにして登録してください。</small></label>
      <audio id="audioPreview" controls ${b.audioData?`src="${b.audioData}"`:""}></audio>
    </section>
    <section class="editor-card"><h2>ミックス設定</h2><div class="form-grid"><label>音量<div class="range-line"><input id="volume" type="range" min="0" max="0.5" step="0.01" value="${b.volume}"><span id="volumeValue">${Math.round(b.volume*100)}%</span></div></label><label>フェードイン<input id="fadeIn" type="number" min="0" max="30" step="0.5" value="${b.fadeInSec}">秒</label><label>フェードアウト<input id="fadeOut" type="number" min="0" max="30" step="0.5" value="${b.fadeOutSec}">秒</label><label class="check"><input id="ducking" type="checkbox" ${b.ducking?"checked":""}>ナレーション中は自動で音量を下げる</label><label class="check"><input id="loop" type="checkbox" ${b.loop?"checked":""}>動画の長さに合わせてループ</label></div></section>
    <section class="editor-card"><h2>利用条件</h2><label>ライセンス・利用条件<input id="license" value="${escapeHtml(b.license||"")}" placeholder="例：商用利用可・クレジット不要"></label><label>クレジット表記<input id="credit" value="${escapeHtml(b.credit||"")}" placeholder="必要な場合のみ入力"></label><p class="notice">無料BGMを使う場合は、配布元の最新規約を必ず確認してください。</p></section>

    <section class="editor-card subtitle-global"><div class="section-head"><div><h2>字幕スタイル</h2><p>全シーン共通の見た目と文字量を設定します。</p></div><label class="switch-line"><input id="subtitleEnabled" type="checkbox" ${st.enabled?"checked":""}>字幕を表示</label></div>
      <div class="form-grid subtitle-settings">
        <label>プリセット<select id="subtitlePreset"><option value="standard">標準</option><option value="large">大きく読みやすい</option><option value="minimal">シンプル</option><option value="boxed">背景ボックス</option></select></label>
        <label>表示位置<select id="subtitlePosition"><option value="top">上</option><option value="center">中央</option><option value="bottom">下</option></select></label>
        <label>上下微調整<div class="range-line"><input id="positionOffset" type="range" min="-15" max="15" step="1" value="${st.positionOffsetPercent}"><span id="positionOffsetValue">${st.positionOffsetPercent>0?'+':''}${st.positionOffsetPercent}%</span></div><button type="button" id="resetPositionOffset" class="small-reset">0に戻す</button><small>マイナスで上、プラスで下へ移動します。</small></label>
        <label>文字サイズ<div class="range-line"><input id="fontSize" type="range" min="32" max="84" step="1" value="${st.fontSize}"><span id="fontSizeValue">${st.fontSize}</span></div></label>
        <label>1行の文字数<input id="maxChars" type="number" min="6" max="30" value="${st.maxCharsPerLine}"></label>
        <label>最大行数<select id="maxLines"><option value="1">1行</option><option value="2">2行</option></select></label>
        <label>文字色<input id="textColor" type="color" value="${st.textColor}"></label>
        <label>縁取り色<input id="outlineColor" type="color" value="${st.outlineColor}"></label>
        <label>縁取り幅<div class="range-line"><input id="outlineWidth" type="range" min="0" max="8" step="1" value="${st.outlineWidth}"><span id="outlineWidthValue">${st.outlineWidth}</span></div></label>
        <label class="check"><input id="backgroundEnabled" type="checkbox" ${st.backgroundEnabled?"checked":""}>字幕背景を表示</label>
        <label>背景色<input id="backgroundColor" type="color" value="${st.backgroundColor}"></label>
        <label>背景の濃さ<div class="range-line"><input id="backgroundOpacity" type="range" min="0" max="0.9" step="0.05" value="${st.backgroundOpacity}"><span id="backgroundOpacityValue">${Math.round(st.backgroundOpacity*100)}%</span></div></label>
      </div>
      <div class="tool-row"><button class="primary" id="generateSubtitles">シーン文章から自動生成</button><button id="exportSrt">SRTを書き出す</button><button id="clearSubtitles" class="danger">字幕を全消去</button></div>
    </section>

    <section class="editor-card subtitle-preview-card"><div class="section-head"><div><h2>字幕プレビュー</h2><p>実際の縦動画に近い比率で確認します。</p></div><select id="previewScene">${scenes.map((s,i)=>`<option value="${i}">シーン ${i+1}</option>`).join("")||'<option value="0">シーンなし</option>'}</select></div><div id="subtitlePreview" class="subtitle-phone"></div></section>

    <section class="editor-card"><div class="section-head"><div><h2>シーン別字幕</h2><p>文章と表示開始・終了を調整します。長すぎる字幕には警告が出ます。</p></div><span id="subtitleCount">0/${scenes.length}</span></div><div id="subtitleList" class="subtitle-list"></div></section>

    <section class="actions"><button id="backScenes">← シーンへ</button><button id="exportJson">プロジェクトバックアップJSON</button><button class="primary" id="nextOutput">次へ：出力設定</button></section>
  </main>`;
  root.querySelector('#source').value=b.source; root.querySelector('#category').value=b.category;
  root.querySelector('#subtitlePreset').value=st.preset||'standard'; root.querySelector('#subtitlePosition').value=st.position; root.querySelector('#maxLines').value=String(st.maxLines);
  attachProjectMenu(project,root.querySelector('#menu'),()=>goStudio(studioForGenre(project.genre)));

  const saveState=root.querySelector('#saveState'); let pendingAsset=Promise.resolve();
  const readGlobalSettings=()=>Object.assign(st,{
    enabled:root.querySelector('#subtitleEnabled').checked,preset:root.querySelector('#subtitlePreset').value,
    position:root.querySelector('#subtitlePosition').value,positionOffsetPercent:normalizeSubtitleOffset(root.querySelector('#positionOffset').value),fontSize:Number(root.querySelector('#fontSize').value),
    maxCharsPerLine:Math.max(6,Number(root.querySelector('#maxChars').value)||16),maxLines:Number(root.querySelector('#maxLines').value)||2,
    textColor:root.querySelector('#textColor').value,outlineColor:root.querySelector('#outlineColor').value,
    outlineWidth:Number(root.querySelector('#outlineWidth').value),backgroundEnabled:root.querySelector('#backgroundEnabled').checked,
    backgroundColor:root.querySelector('#backgroundColor').value,backgroundOpacity:Number(root.querySelector('#backgroundOpacity').value)
  });
  const persist=async()=>{
    await pendingAsset;
    Object.assign(b,{source:root.querySelector('#source').value,category:root.querySelector('#category').value,title:root.querySelector('#bgmTitle').value,volume:Number(root.querySelector('#volume').value),fadeInSec:Number(root.querySelector('#fadeIn').value),fadeOutSec:Number(root.querySelector('#fadeOut').value),ducking:root.querySelector('#ducking').checked,loop:root.querySelector('#loop').checked,license:root.querySelector('#license').value,credit:root.querySelector('#credit').value});
    readGlobalSettings(); project.output.subtitles=st.enabled; project.output.subtitlePosition=st.position; project.updatedAt=new Date().toISOString();await saveProject(project);saveState.textContent='保存済み';
  };
  const {scheduleSave:save,flushSave}=createSaveController({delay:350,persist,setStatus:text=>saveState.textContent=text});
  bindSavedNavigation(root.querySelector('#back'),flushSave,()=>goStudio(studioForGenre(project.genre)));
  bindSavedNavigation(root.querySelector('#stepAi'),flushSave,()=>goAi(id));
  bindSavedNavigation(root.querySelector('#stepScript'),flushSave,()=>goProject(id));
  bindSavedNavigation(root.querySelector('#stepScenes'),flushSave,()=>goScenes(id));
  bindSavedNavigation(root.querySelector('#stepOutput'),flushSave,()=>goOutput(id));
  bindSavedNavigation(root.querySelector('#backScenes'),flushSave,()=>goScenes(id));
  bindSavedNavigation(root.querySelector('#nextOutput'),flushSave,()=>goOutput(id));

  const updateLabels=()=>{root.querySelector('#volumeValue').textContent=`${Math.round(Number(root.querySelector('#volume').value)*100)}%`;root.querySelector('#fontSizeValue').textContent=root.querySelector('#fontSize').value;const offset=normalizeSubtitleOffset(root.querySelector('#positionOffset').value);root.querySelector('#positionOffsetValue').textContent=`${offset>0?'+':''}${offset}%`;root.querySelector('#outlineWidthValue').textContent=root.querySelector('#outlineWidth').value;root.querySelector('#backgroundOpacityValue').textContent=`${Math.round(Number(root.querySelector('#backgroundOpacity').value)*100)}%`;};
  ['source','category','bgmTitle','fadeIn','fadeOut','ducking','loop','license','credit'].forEach(k=>root.querySelector('#'+k).oninput=()=>{updateLabels();save();});
  const bgmVolumeBeforeByElement=new WeakMap();
  const volumeEl=root.querySelector('#volume');
  const rememberBgmVolumeBefore=el=>{if(bgmVolumeBeforeByElement.has(el))return;bgmVolumeBeforeByElement.set(el,Number(el.value));};
  const commitBgmVolumeDecision=el=>{if(!bgmVolumeBeforeByElement.has(el))return;const before=bgmVolumeBeforeByElement.get(el);bgmVolumeBeforeByElement.delete(el);const record=recordBgmVolumeChange(project,{beforeVolume:before,afterVolume:Number(el.value),bgmSource:root.querySelector('#source').value,bgmCategory:root.querySelector('#category').value,ducking:root.querySelector('#ducking').checked,loop:root.querySelector('#loop').checked});if(record)save();};
  volumeEl.onpointerdown=()=>rememberBgmVolumeBefore(volumeEl);
  volumeEl.onfocus=()=>rememberBgmVolumeBefore(volumeEl);
  volumeEl.onkeydown=()=>rememberBgmVolumeBefore(volumeEl);
  volumeEl.oninput=()=>{updateLabels();save();};
  volumeEl.onpointerup=()=>commitBgmVolumeDecision(volumeEl);
  volumeEl.onpointercancel=()=>bgmVolumeBeforeByElement.delete(volumeEl);
  volumeEl.onblur=()=>commitBgmVolumeDecision(volumeEl);
  ['subtitleEnabled','fontSize','maxChars','maxLines','textColor','outlineColor','outlineWidth','backgroundEnabled','backgroundColor','backgroundOpacity'].forEach(k=>root.querySelector('#'+k).oninput=()=>{readGlobalSettings();updateLabels();renderSubtitleEditor();renderSubtitlePreview();save();});
  const globalSubtitlePositionBeforeByElement=new WeakMap();
  const rememberGlobalSubtitlePositionBefore=el=>{if(globalSubtitlePositionBeforeByElement.has(el))return;globalSubtitlePositionBeforeByElement.set(el,snapshotGlobalSubtitlePosition(project));};
  const commitGlobalSubtitlePositionDecision=el=>{if(!globalSubtitlePositionBeforeByElement.has(el))return;const before=globalSubtitlePositionBeforeByElement.get(el);globalSubtitlePositionBeforeByElement.delete(el);const after=snapshotGlobalSubtitlePosition(project);const record=recordGlobalSubtitlePositionChange(project,{beforeState:before,afterState:after});if(record)save();};
  const globalPositionEl=root.querySelector('#subtitlePosition');
  globalPositionEl.onchange=()=>{const before=snapshotGlobalSubtitlePosition(project);readGlobalSettings();const after=snapshotGlobalSubtitlePosition(project);recordGlobalSubtitlePositionChange(project,{beforeState:before,afterState:after});updateLabels();renderSubtitleEditor();renderSubtitlePreview();save();};
  const globalOffsetEl=root.querySelector('#positionOffset');
  globalOffsetEl.onpointerdown=()=>rememberGlobalSubtitlePositionBefore(globalOffsetEl);
  globalOffsetEl.onfocus=()=>rememberGlobalSubtitlePositionBefore(globalOffsetEl);
  globalOffsetEl.onkeydown=()=>rememberGlobalSubtitlePositionBefore(globalOffsetEl);
  globalOffsetEl.oninput=()=>{readGlobalSettings();updateLabels();renderSubtitleEditor();renderSubtitlePreview();save();};
  globalOffsetEl.onpointerup=()=>commitGlobalSubtitlePositionDecision(globalOffsetEl);
  globalOffsetEl.onblur=()=>commitGlobalSubtitlePositionDecision(globalOffsetEl);
  root.querySelector('#resetPositionOffset').onclick=()=>{const before=snapshotGlobalSubtitlePosition(project);root.querySelector('#positionOffset').value='0';readGlobalSettings();const after=snapshotGlobalSubtitlePosition(project);recordGlobalSubtitlePositionChange(project,{beforeState:before,afterState:after});updateLabels();renderSubtitlePreview();save();};

  const presets={
    standard:{fontSize:54,position:'bottom',maxCharsPerLine:16,maxLines:2,outlineWidth:4,backgroundEnabled:false,backgroundOpacity:.45},
    large:{fontSize:68,position:'bottom',maxCharsPerLine:13,maxLines:2,outlineWidth:5,backgroundEnabled:false,backgroundOpacity:.45},
    minimal:{fontSize:48,position:'center',maxCharsPerLine:18,maxLines:2,outlineWidth:2,backgroundEnabled:false,backgroundOpacity:.35},
    boxed:{fontSize:52,position:'bottom',maxCharsPerLine:16,maxLines:2,outlineWidth:0,backgroundEnabled:true,backgroundOpacity:.58}
  };
  root.querySelector('#subtitlePreset').onchange=()=>{const p=presets[root.querySelector('#subtitlePreset').value];Object.assign(st,p,{preset:root.querySelector('#subtitlePreset').value});root.querySelector('#fontSize').value=st.fontSize;root.querySelector('#subtitlePosition').value=st.position;root.querySelector('#maxChars').value=st.maxCharsPerLine;root.querySelector('#maxLines').value=String(st.maxLines);root.querySelector('#outlineWidth').value=st.outlineWidth;root.querySelector('#backgroundEnabled').checked=st.backgroundEnabled;root.querySelector('#backgroundOpacity').value=st.backgroundOpacity;updateLabels();renderSubtitleEditor();renderSubtitlePreview();save();};

  root.querySelector('#audioFile').onchange=async e=>{
    const file=e.target.files?.[0];if(!file)return;
    const name=String(file.name||'');const type=String(file.type||'').toLowerCase();const ext=(name.split('.').pop()||'').toLowerCase();
    const videoLike=type.startsWith('video/')||['mov','mp4','m4v','avi','webm'].includes(ext);
    const audioLike=type.startsWith('audio/')||['mp3','m4a','aac','wav'].includes(ext);
    if(videoLike||!audioLike){
      e.target.value='';
      alert('このファイルはBGM用の音声として直接使用できません。\n\nMP3・M4A・AAC・WAVなどの音声ファイルを選択してください。\nMOV / MP4の音声を使う機能は次段階で追加予定です。');
      return;
    }
    if(file.size>12_000_000&&!confirm('音源が大きいため端末保存容量を圧迫します。続けますか？')){e.target.value='';return;}
    root.querySelector('#source').value='upload';
    const beforeAudioAssetId=b.audioAssetId;const hadBgmBefore=Boolean(b.audioData);
    pendingAsset=(async()=>{const audioAssetId=await createAudioAssetIdFromFile(file);const data=await fileToDataUrl(file);b.audioData=data;b.fileName=file.name;b.source='upload';b.audioAssetId=audioAssetId;recordBgmSelectionChange(project,{beforeAudioAssetId,afterAudioAssetId:audioAssetId,selectionMethod:'upload',hadBgmBefore,bgmCategory:root.querySelector('#category').value,ducking:root.querySelector('#ducking').checked,loop:root.querySelector('#loop').checked});})();
    save();await pendingAsset;root.querySelector('#fileName').textContent=file.name;root.querySelector('#audioPreview').src=b.audioData;
  };

  function renderSubtitlePreview(){
    readGlobalSettings(); const index=Math.min(scenes.length-1,Math.max(0,Number(root.querySelector('#previewScene').value)||0)); const scene=scenes[index]; const box=root.querySelector('#subtitlePreview');
    if(!scene){box.innerHTML='<div class="subtitle-empty-preview">シーンを作成すると字幕を確認できます。</div>';return;}
    const result=formatSubtitleLines(scene.subtitleText||'',st.maxCharsPerLine,st.maxLines); const visible=st.enabled&&scene.subtitleEnabled!==false&&result.lines.length;
    const background=st.backgroundEnabled?hexToRgba(st.backgroundColor,st.backgroundOpacity):'transparent';
    const stroke=Math.max(0,st.outlineWidth*.28);
    const cardLabel=result.cards.length>1?`<small class="subtitle-card-count">字幕 1/${result.cards.length}（空行で切替）</small>`:'';
    const previewFontSize=Math.max(14,st.fontSize*.32),effectivePosition=resolveEffectiveSubtitlePosition(scene,st,project.output?.subtitlePosition),yRatio=resolveSubtitleYRatio(effectivePosition.position,effectivePosition.offsetPercent);
    const previewImage=resolveSceneImageSource(project,scene).data;
    box.innerHTML=`${previewImage?`<img src="${previewImage}" alt="">`:`<div class="subtitle-preview-fallback">シーン ${index+1}</div>`}${cardLabel}<div class="subtitle-layer" style="padding:0 6%;align-items:flex-start">${visible?`<div class="subtitle-render ${result.overflow?'overflow':''}" style="position:absolute;left:6%;right:6%;top:${(yRatio*100).toFixed(2)}%;transform:translateY(-50%);width:auto;font-size:${previewFontSize}px;color:${st.textColor};-webkit-text-stroke:${stroke}px ${st.outlineColor};background:${background}">${result.lines.map(escapeHtml).join('<br>')}</div>`:''}</div>`;
    const rendered=box.querySelector('.subtitle-render');
    if(rendered&&box.clientHeight){const safeRatio=resolveSubtitleYRatio(effectivePosition.position,effectivePosition.offsetPercent,rendered.offsetHeight/box.clientHeight/2);rendered.style.top=`${(safeRatio*100).toFixed(2)}%`;}
  }
  function updateSubtitleCount(){const count=scenes.filter(s=>s.subtitleEnabled!==false&&(s.subtitleText||'').trim()).length;root.querySelector('#subtitleCount').textContent=`${count}/${scenes.length}`;}
  function renderSubtitleEditor(){
    readGlobalSettings(); const list=root.querySelector('#subtitleList'); updateSubtitleCount();
    list.innerHTML=scenes.length?scenes.map((scene,i)=>{const duration=Math.max(1,Number(scene.durationSec)||1);scene.subtitleStartSec=Math.min(duration,Math.max(0,Number(scene.subtitleStartSec)||0));scene.subtitleEndSec=Math.min(duration,Math.max(scene.subtitleStartSec,Number(scene.subtitleEndSec)||duration));const formatted=formatSubtitleLines(scene.subtitleText||'',st.maxCharsPerLine,st.maxLines);const limit=st.maxCharsPerLine*st.maxLines;return `<article class="subtitle-item" data-index="${i}"><div class="subtitle-item-head"><div><b>シーン ${i+1}</b><small>${duration}秒</small></div><label class="switch-line"><input data-sub-enabled="${i}" type="checkbox" ${scene.subtitleEnabled!==false?'checked':''}>表示</label></div><textarea data-sub-text="${i}" placeholder="字幕文章">${escapeHtml(scene.subtitleText||'')}</textarea><div class="subtitle-meta"><span data-sub-count="${i}" class="${formatted.overflow?'warning':''}">${formatted.chars}文字／目安${limit}文字${formatted.overflow?'・長すぎます':''}</span></div><div class="scene-subtitle-position"><label>字幕位置<select data-sub-position="${i}"><option value="">全体設定を使う</option><option value="top" ${scene.subtitlePosition==='top'?'selected':''}>上</option><option value="center" ${scene.subtitlePosition==='center'?'selected':''}>中央</option><option value="bottom" ${scene.subtitlePosition==='bottom'?'selected':''}>下</option></select></label><div data-sub-offset-wrap="${i}" class="scene-subtitle-offset" ${scene.subtitlePosition?'':'hidden'}><label>上下微調整<div class="range-line"><input data-sub-offset="${i}" type="range" min="-15" max="15" step="1" value="${normalizeSubtitleOffset(scene.subtitlePositionOffsetPercent)}"><span data-sub-offset-value="${i}">${normalizeSubtitleOffset(scene.subtitlePositionOffsetPercent)>0?'+':''}${normalizeSubtitleOffset(scene.subtitlePositionOffsetPercent)}%</span></div></label><button type="button" data-sub-offset-reset="${i}" class="small-reset">0に戻す</button></div><small data-sub-effective="${i}">${scene.subtitlePosition?'個別設定':'全体設定'}：${({top:'上',center:'中央',bottom:'下'})[resolveEffectiveSubtitlePosition(scene,st,project.output?.subtitlePosition).position]} / ${resolveEffectiveSubtitlePosition(scene,st,project.output?.subtitlePosition).offsetPercent>0?'+':''}${resolveEffectiveSubtitlePosition(scene,st,project.output?.subtitlePosition).offsetPercent}%</small></div><div class="subtitle-time-grid"><label>開始（シーン内）<input data-sub-start="${i}" type="number" min="0" max="${duration}" step="0.1" value="${scene.subtitleStartSec}">秒</label><label>終了（シーン内）<input data-sub-end="${i}" type="number" min="0" max="${duration}" step="0.1" value="${scene.subtitleEndSec}">秒</label><button data-preview="${i}">プレビュー</button></div></article>`}).join(''):'<div class="dictionary-empty">シーン編集でシーンを作成してください。</div>';
    list.querySelectorAll('[data-sub-position]').forEach(el=>el.onchange=()=>{const i=Number(el.dataset.subPosition),scene=scenes[i];if(!scene)return;const before=snapshotSceneSubtitlePosition(scene);if(el.value){scene.subtitlePosition=el.value;scene.subtitlePositionOffsetPercent=0;}else{delete scene.subtitlePosition;delete scene.subtitlePositionOffsetPercent;}const after=snapshotSceneSubtitlePosition(scene);recordSceneSubtitlePositionChange(project,{sceneId:scene.id,beforeState:before,afterState:after,sceneIndex:i});renderSubtitleEditor();renderSubtitlePreview();save();});
    const subtitleOffsetBeforeByElement=new WeakMap();
    const rememberSubtitleOffsetBefore=el=>{if(subtitleOffsetBeforeByElement.has(el))return;const i=Number(el.dataset.subOffset),scene=scenes[i];if(scene)subtitleOffsetBeforeByElement.set(el,snapshotSceneSubtitlePosition(scene));};
    const commitSubtitleOffsetDecision=el=>{if(!subtitleOffsetBeforeByElement.has(el))return;const i=Number(el.dataset.subOffset),scene=scenes[i],before=subtitleOffsetBeforeByElement.get(el);subtitleOffsetBeforeByElement.delete(el);if(!scene)return;const after=snapshotSceneSubtitlePosition(scene);const record=recordSceneSubtitlePositionChange(project,{sceneId:scene.id,beforeState:before,afterState:after,sceneIndex:i});if(record)save();};
    list.querySelectorAll('[data-sub-offset]').forEach(el=>{el.onpointerdown=()=>rememberSubtitleOffsetBefore(el);el.onfocus=()=>rememberSubtitleOffsetBefore(el);el.onkeydown=()=>rememberSubtitleOffsetBefore(el);el.oninput=()=>{const i=Number(el.dataset.subOffset);scenes[i].subtitlePositionOffsetPercent=normalizeSubtitleOffset(el.value);list.querySelector('[data-sub-offset-value="'+i+'"]').textContent=(scenes[i].subtitlePositionOffsetPercent>0?'+':'')+scenes[i].subtitlePositionOffsetPercent+'%';const effective=resolveEffectiveSubtitlePosition(scenes[i],st,project.output?.subtitlePosition);list.querySelector('[data-sub-effective="'+i+'"]').textContent='個別設定：'+({top:'上',center:'中央',bottom:'下'})[effective.position]+' / '+(effective.offsetPercent>0?'+':'')+effective.offsetPercent+'%';if(Number(root.querySelector('#previewScene').value)===i)renderSubtitlePreview();save();};el.onblur=()=>commitSubtitleOffsetDecision(el);});
    list.querySelectorAll('[data-sub-offset-reset]').forEach(el=>el.onclick=()=>{const i=Number(el.dataset.subOffsetReset),scene=scenes[i];if(!scene)return;const before=snapshotSceneSubtitlePosition(scene);scene.subtitlePositionOffsetPercent=0;const after=snapshotSceneSubtitlePosition(scene);recordSceneSubtitlePositionChange(project,{sceneId:scene.id,beforeState:before,afterState:after,sceneIndex:i});renderSubtitleEditor();if(Number(root.querySelector('#previewScene').value)===i)renderSubtitlePreview();save();});
    const subtitleBeforeByElement=new WeakMap();
    list.querySelectorAll('[data-sub-text]').forEach(el=>{
      el.onfocus=()=>{const i=Number(el.dataset.subText);subtitleBeforeByElement.set(el,String(scenes[i]?.subtitleText??''));};
      el.oninput=()=>{const i=Number(el.dataset.subText);scenes[i].subtitleText=el.value;const f=formatSubtitleLines(el.value,st.maxCharsPerLine,st.maxLines);const count=list.querySelector(`[data-sub-count="${i}"]`);count.textContent=`${f.chars}文字／目安${st.maxCharsPerLine*st.maxLines}文字${f.overflow?'・長すぎます':''}`;count.classList.toggle('warning',f.overflow);updateSubtitleCount();if(Number(root.querySelector('#previewScene').value)===i)renderSubtitlePreview();save();};
      el.onblur=async()=>{const i=Number(el.dataset.subText),scene=scenes[i];if(!scene)return;const before=subtitleBeforeByElement.has(el)?subtitleBeforeByElement.get(el):String(scene.subtitleText??'');subtitleBeforeByElement.delete(el);const after=String(scene.subtitleText??'');const record=recordSubtitleContentChange(project,{sceneId:scene.id,beforeText:before,afterText:after,sceneIndex:i,maxCharsPerLine:st.maxCharsPerLine,maxLines:st.maxLines});if(record)save();const changeKinds=Array.isArray(record?.humanAction?.changeKinds)?record.humanAction.changeKinds:[];if(!changeKinds.includes('text')||!subtitleContentChanged(scene.text||'',after))return;const sceneTextBefore=String(scene.text||''),sceneText=normalizeSubtitleContentForSync(after),speechTextFollowsScene=scene.speechText==null||normalizeSceneText(scene.speechText)===normalizeSceneText(sceneTextBefore),hadNarration=Boolean(scene.narration);const syncChoice=await askSubtitleSceneSync();if(syncChoice==='dismissed')return;const shouldSync=syncChoice==='sync-to-scene';const syncRecord=recordSubtitleSceneSyncDecision(project,{sceneId:scene.id,sceneIndex:i,sceneTextBefore,subtitleTextAfter:after,sceneTextCandidate:sceneText,syncToScene:shouldSync,speechTextFollowsScene,hadNarration});if(syncRecord)save();if(!shouldSync)return;updateSceneText(scene,sceneText);scene.subtitleText=after;renderSubtitleEditor();renderSubtitlePreview();save();};
    });
    list.querySelectorAll('[data-sub-enabled]').forEach(el=>el.onchange=()=>{scenes[Number(el.dataset.subEnabled)].subtitleEnabled=el.checked;updateSubtitleCount();renderSubtitlePreview();save();});
    list.querySelectorAll('[data-sub-start]').forEach(el=>el.oninput=()=>{const i=Number(el.dataset.subStart),duration=Math.max(1,Number(scenes[i].durationSec)||1);scenes[i].subtitleStartSec=Math.min(duration,Math.max(0,Number(el.value)||0));if(scenes[i].subtitleEndSec<scenes[i].subtitleStartSec)scenes[i].subtitleEndSec=scenes[i].subtitleStartSec;save();});
    list.querySelectorAll('[data-sub-end]').forEach(el=>el.oninput=()=>{const i=Number(el.dataset.subEnd),duration=Math.max(1,Number(scenes[i].durationSec)||1);scenes[i].subtitleEndSec=Math.min(duration,Math.max(scenes[i].subtitleStartSec,Number(el.value)||duration));save();});
    list.querySelectorAll('[data-preview]').forEach(el=>el.onclick=()=>{root.querySelector('#previewScene').value=el.dataset.preview;renderSubtitlePreview();root.querySelector('.subtitle-preview-card').scrollIntoView({behavior:'smooth',block:'center'});});
  }
  root.querySelector('#previewScene').onchange=renderSubtitlePreview;
  root.querySelector('#generateSubtitles').onclick=()=>{if(scenes.some(s=>(s.subtitleText||'').trim())&&!confirm('現在の字幕をシーン文章から作り直しますか？'))return;scenes.forEach(s=>{s.subtitleText=s.text||'';s.subtitleEnabled=true;s.subtitleStartSec=0;s.subtitleEndSec=Math.max(1,Number(s.durationSec)||1);});renderSubtitleEditor();renderSubtitlePreview();save();};
  root.querySelector('#clearSubtitles').onclick=()=>{if(!confirm('すべてのシーンの字幕文章を消去しますか？'))return;scenes.forEach(s=>s.subtitleText='');renderSubtitleEditor();renderSubtitlePreview();save();};
  root.querySelector('#exportSrt').onclick=()=>{const srt=buildSrt(project);if(!srt.trim())return alert('書き出せる字幕がありません。');downloadText(`${safeName(project.title)}.srt`,srt,'application/x-subrip;charset=utf-8');};
  root.querySelector('#exportJson').onclick=()=>downloadProjectBackup(project);
  updateLabels(); renderSubtitleEditor(); renderSubtitlePreview();
}

async function renderOutput(id) {
  const project=await getProject(id); if(!project){goHome();return;} ensureProjectSettings(project);
  const o=project.output, st=project.subtitleStyle, scenes=project.scenes||[];
  const hasImages=scenes.filter(s=>resolveSceneImageSource(project,s).data).length, total=getProjectDuration(project);
  const timeline=buildSubtitleTimeline(project), subtitleReady=timeline.length, subtitleWarnings=scenes.filter(s=>{const f=formatSubtitleLines(s.subtitleText||'',st.maxCharsPerLine,st.maxLines);return s.subtitleEnabled!==false&&f.overflow;}).length;
  const capabilities=getVideoCapabilities();
  const validation=validateVideoProject(project); const currentReviewSignature=finalReviewSignature(project);
  const mvpValidation=validateMvpShortsOutput(project,total);
  const finalReviewApproved=Boolean(project.finalReview?.approved && project.finalReview?.signature===currentReviewSignature);
  const formatLabel=capabilities.h264Aac?'MP4 / H.264 + AAC対応':capabilities.h264?'MP4 / H.264対応（音声codec要確認）':capabilities.mp4?'MP4対応（codec要確認）':capabilities.webm?'WebM対応（MP4非対応）':'動画生成非対応';
  const longProject=total>180;
  root.innerHTML=`<main class="shell editor-shell"><header class="editor-head"><button id="back">←</button><div><span>${labelPlatform(project.platform)}</span><h1>${escapeHtml(project.title)}</h1></div><button id="menu">•••</button></header>
  <nav class="steps"><button id="stepAi">0 AIスタッフ</button><button id="stepScript">1 台本</button><button id="stepScenes">2 シーン・ナレーション</button><button id="stepBgm">3 字幕・BGM</button><button class="active">4 出力</button></nav>
  <section class="editor-card"><div class="section-head"><div><h2>動画出力設定</h2><p>完成動画の形式を設定します。</p></div><span id="saveState">保存済み</span></div><div class="form-grid"><label>解像度<select id="resolution"><option value="1080x1920">1080×1920（高画質）</option><option value="720x1280">720×1280（iPhone推奨・軽量）</option></select></label><label>フレームレート<select id="fps"><option value="30">30fps（推奨）</option><option value="60">60fps（高負荷）</option></select></label><label>品質<select id="quality"><option value="standard">標準</option><option value="high">高品質</option></select></label><label class="check"><input id="subtitles" type="checkbox" ${o.subtitles?'checked':''}>字幕を表示</label><label>字幕位置<select id="subtitlePosition"><option value="top">上</option><option value="center">中央</option><option value="bottom">下</option></select></label><label class="check"><input id="bgmEnabled" type="checkbox" ${o.bgmEnabled?'checked':''}>BGMを使用</label></div></section>
  <section class="editor-card"><div class="section-head"><div><h2>素材チェック</h2><p>動画生成前に不足素材を確認します。</p></div><span class="status-chip ${capabilities.supported?'':'status-warn'}">${formatLabel}</span></div><div class="check-list"><p class="${project.displayScript?'ok':'warn'}">${project.displayScript?'✓':'!'} 台本：${project.displayScript.length}文字</p><p class="${scenes.length?'ok':'warn'}">${scenes.length?'✓':'!'} シーン：${scenes.length}件</p><p class="${hasImages===scenes.length&&scenes.length?'ok':'warn'}">${hasImages===scenes.length&&scenes.length?'✓':'!'} 画像：${hasImages}/${scenes.length}件</p><p class="${subtitleReady?'ok':'warn'}">${subtitleReady?'✓':'!'} 字幕：${subtitleReady}/${scenes.length}件${subtitleWarnings?`（長文警告${subtitleWarnings}件）`:''}</p><p class="${validation.bgmInvalid?'warn':project.bgm?.audioData&&o.bgmEnabled?'ok':'muted'}">${validation.bgmInvalid?'!':project.bgm?.audioData&&o.bgmEnabled?'✓':'−'} BGM音源：${escapeHtml(project.bgm?.fileName||project.bgm?.title||'なし')}${validation.bgmInvalid?'（動画ファイルのため要再登録）':''}</p><p class="${validation.narrationInvalid?'warn':validation.sceneNarrationCount===scenes.length&&scenes.length?'ok':project.narration?.audioData?'ok':'muted'}">${validation.narrationInvalid?'!':validation.sceneNarrationCount===scenes.length&&scenes.length?'✓':project.narration?.audioData?'✓':'−'} ナレーション：${validation.sceneNarrationCount?`シーン別 ${validation.sceneNarrationCount}/${scenes.length}件`:escapeHtml(project.narration?.fileName||'未登録')}${validation.narrationInvalid?'（動画ファイルのため要再登録）':''}</p><p>予定尺：${total.toFixed(1)}秒</p>${mvpValidation.applicable?`<p class="${mvpValidation.pass?'ok':'warn'}">${mvpValidation.pass?'✓':'!'} MVP Shorts：1080×1920 / 30fps / MP4 / 60秒以内${mvpValidation.pass?'':'（'+mvpValidation.errors.map(escapeHtml).join('／')+'）'}</p>`:''}</div>${validation.warnings.length?`<div class="render-warnings">${validation.warnings.map(item=>`<p>⚠ ${escapeHtml(item)}</p>`).join('')}</div>`:''}</section>

  <section class="editor-card final-review-card">
    <div class="section-head"><div><h2>最終素材チェック</h2><p>動画へ焼き込む直前のシーン素材を目視確認します。ここでは素材の内容を自動判定せず、選択した画像・字幕・ナレーション・尺が意図どおりかを確認します。</p></div><span id="finalReviewStatus" class="status-chip ${finalReviewApproved?'':'status-warn'}">${finalReviewApproved?'確認済み':'未確認'}</span></div>
    <div class="final-review-grid">
      ${scenes.map((scene,index)=>{const reviewImage=resolveSceneImageSource(project,scene).data;return `<article class="final-review-item">
        <div class="final-review-thumb">${reviewImage?`<img src="${reviewImage}" alt="シーン${index+1}素材">`:`<div class="warn">映像素材なし</div>`}</div>
        <div><strong>シーン${index+1}</strong>
        <p>${escapeHtml((scene.subtitleText||scene.text||scene.speechText||'字幕なし').slice(0,90))}</p>
        <small>${scene.narration?.audioData?`✓ 音声 ${Number(scene.narration?.durationSec||0).toFixed(2)}秒`:'! ナレーションなし'} / ${Number(scene.durationSec||0).toFixed(2)}秒</small></div>
      </article>`;}).join('')}
    </div>
    <div class="tool-row"><button id="approveFinalReview" class="primary">${finalReviewApproved?'✓ この素材は確認済み':'✓ この内容で動画生成を許可'}</button><button id="backToScenesReview">← シーン編集へ戻る</button></div>
    <p id="finalReviewHelp" class="${finalReviewApproved?'ok':'warn'}">${finalReviewApproved?'✓ 現在の素材構成で動画生成できます。':'! 最終確認が終わるまで「動画を生成」は無効です。素材を変更すると確認は自動的に無効になります。'}</p>
  </section>

  <section class="editor-card video-render-card">
    <div class="section-head"><div><h2>動画プレビュー・生成</h2><p>画像、動き、字幕、BGMをブラウザ内で合成します。</p></div><span id="renderStatus">素材準備中…</span></div><div id="assetDiagnostics" class="asset-diagnostics">素材を確認しています…</div>
    <div class="video-canvas-wrap"><canvas id="renderCanvas" width="${o.width}" height="${o.height}"></canvas></div>
    <div class="render-options"><label>生成範囲<select id="renderRange"><option value="10">先頭10秒（動作テスト）</option><option value="full" ${longProject?'disabled':''}>全編（${Math.ceil(total)}秒）</option></select></label><p>${longProject?'全編が3分を超えるため、初版では10秒テストのみです。長時間BGMは今後のサーバー／高速エンジンで対応します。':'全編生成は実時間と同程度かかります。画面を閉じずにお待ちください。'}</p></div>
    <div class="render-progress"><progress id="renderProgress" max="1" value="0"></progress><span id="renderProgressText">0%</span></div>
    <div class="tool-row"><button id="showFirstFrame">🖼 1フレーム確認</button><button id="previewVideo">▶ 10秒プレビュー</button><button id="stopPreview" disabled>■ プレビュー停止</button><button class="primary" id="generateVideo" ${capabilities.supported&&finalReviewApproved?'':'disabled'}>🎬 動画を生成</button><button class="danger" id="cancelRender" disabled>生成を中止</button></div>
    <p class="notice">初版は画像＋字幕＋ナレーション＋BGMの動画生成です。生成中はSafariを前面に表示し、画面をロックしないでください。対応形式は端末が自動判定します。</p>
    <div id="renderResult" class="render-result" hidden><h3>生成完了</h3><video id="resultVideo" controls playsinline></video><div class="tool-row"><a id="downloadVideo" class="button-link primary" download>動画を保存</a><button id="shareVideo">共有</button></div><div class="tool-row"><button id="verifySavedVideo">保存後ファイルを検証</button><input id="verifySavedVideoInput" type="file" accept="video/*" hidden></div><p id="verifySavedVideoInfo" class="muted"></p><p id="resultInfo"></p></div>
  </section>

  <section class="editor-card"><h2>制作データの書き出し</h2><div class="tool-row"><button id="exportSrt">字幕SRT</button><button id="exportPlan">制作プランJSON</button><button class="primary" id="publish">投稿準備へ</button></div></section>
  <section class="actions"><button id="backBgm">← BGM・字幕へ</button><button id="exportJson">プロジェクトバックアップJSON</button><button class="primary" id="publish2">次へ：投稿準備</button></section></main>`;

  root.querySelector('#resolution').value=`${o.width}x${o.height}`;root.querySelector('#fps').value=String(o.fps);root.querySelector('#quality').value=o.quality;root.querySelector('#subtitlePosition').value=o.subtitlePosition||st.position;
  root.querySelector('#publish').onclick=root.querySelector('#publish2').onclick=()=>goPublish(id);attachProjectMenu(project,root.querySelector('#menu'),()=>goStudio(studioForGenre(project.genre)));
  root.querySelector('#approveFinalReview').onclick=async()=>{
    const missingVisual=scenes.findIndex(scene=>!resolveSceneImageSource(project,scene).data);
    if(missingVisual>=0){alert(`シーン${missingVisual+1}に映像素材がありません。シーン編集へ戻って画像または動画を設定してください。`);return;}
    if(!scenes.length){alert('シーンがありません。');return;}
    project.finalReview={
      approved:true,
      signature:finalReviewSignature(project),
      approvedAt:new Date().toISOString()
    };
    project.updatedAt=new Date().toISOString();
    await saveProject(project);
    renderOutput(id);
  };


  const canvas=root.querySelector('#renderCanvas');
  const renderStatus=root.querySelector('#renderStatus');
  const progress=root.querySelector('#renderProgress');
  const progressText=root.querySelector('#renderProgressText');
  const updateProgress=(elapsed,duration)=>{const value=duration?Math.min(1,elapsed/duration):0;progress.value=value;progressText.textContent=`${Math.round(value*100)}%（${elapsed.toFixed(1)}/${duration.toFixed(1)}秒）`;};
  const persistSettings=async()=>{const [w,h]=root.querySelector('#resolution').value.split('x').map(Number);Object.assign(o,{width:w,height:h,fps:Number(root.querySelector('#fps').value),quality:root.querySelector('#quality').value,subtitles:root.querySelector('#subtitles').checked,subtitlePosition:root.querySelector('#subtitlePosition').value,bgmEnabled:root.querySelector('#bgmEnabled').checked});st.enabled=o.subtitles;st.position=o.subtitlePosition;project.updatedAt=new Date().toISOString();await saveProject(project);canvas.width=w;canvas.height=h;};
  const {scheduleSave,flushSave}=createSaveController({delay:350,persist:async()=>{await persistSettings();if(prepared)drawProjectFrame(project,prepared,canvas,0);},setStatus:text=>root.querySelector('#saveState').textContent=text});
  ['resolution','fps','quality','subtitles','subtitlePosition','bgmEnabled'].forEach(k=>root.querySelector('#'+k).onchange=scheduleSave);
  bindSavedNavigation(root.querySelector('#back'),flushSave,()=>goStudio(studioForGenre(project.genre)));
  bindSavedNavigation(root.querySelector('#stepAi'),flushSave,()=>goAi(id));
  bindSavedNavigation(root.querySelector('#stepScript'),flushSave,()=>goProject(id));
  bindSavedNavigation(root.querySelector('#stepScenes'),flushSave,()=>goScenes(id));
  bindSavedNavigation(root.querySelector('#stepBgm'),flushSave,()=>goBgm(id));
  bindSavedNavigation(root.querySelector('#backBgm'),flushSave,()=>goBgm(id));
  bindSavedNavigation(root.querySelector('#backToScenesReview'),flushSave,()=>goScenes(id));
  bindSavedNavigation(root.querySelector('#publish'),flushSave,()=>goPublish(id));
  bindSavedNavigation(root.querySelector('#publish2'),flushSave,()=>goPublish(id));

  let prepared=null;
  const diagnostics=root.querySelector('#assetDiagnostics');
  const describeAssets=value=>{
    const imageText=`画像 ${value.loadedImageCount ?? value.images.filter(Boolean).length}/${scenes.length}`;
    const imageWarning=value.imageFailures?.length?`（読込失敗 ${value.imageFailures.length}件）`:'';
    const audioText=o.bgmEnabled&&project.bgm?.audioData?(value.audioInvalid?'BGMが動画ファイルです':value.audioFetchError?'BGMファイル読込失敗':'BGMファイル確認済み'):'BGMなし';
    const preparedSceneNarrations=Array.isArray(value.sceneNarrations)?value.sceneNarrations.filter(item=>item?.arrayBuffer).length:0;
    const failedSceneNarrations=Array.isArray(value.sceneNarrations)?value.sceneNarrations.filter(item=>item?.error).length:0;
    const expectedSceneNarrations=scenes.filter(scene=>scene?.narration?.audioData).length;
    let narrationText='ナレーションなし';
    if(expectedSceneNarrations) narrationText=`シーン別ナレーション ${preparedSceneNarrations}/${expectedSceneNarrations}${failedSceneNarrations?`（読込失敗 ${failedSceneNarrations}件）`:''}`;
    else if(project.narration?.audioData) narrationText=value.narrationInvalid?'ナレーションが動画ファイルです':value.narrationFetchError?'ナレーション読込失敗':'ナレーション確認済み';
    diagnostics.textContent=`${imageText}${imageWarning}／${audioText}／${narrationText}`;
    diagnostics.classList.toggle('warn',Boolean(value.imageFailures?.length||value.audioFetchError||value.audioInvalid||value.narrationFetchError||value.narrationInvalid||failedSceneNarrations));
  };
  let preparedPromise=prepareVideoProject(project,{onStatus:text=>renderStatus.textContent=text}).then(value=>{prepared=value;describeAssets(value);drawProjectFrame(project,prepared,canvas,0);return value;}).catch(error=>{renderStatus.textContent='素材準備エラー';diagnostics.textContent=error.message;diagnostics.classList.add('warn');throw error;});
  let previewController=null,renderController=null,resultUrl='';let resultFile=null;let generatedHash='';let generatedMeta=null;
  root.querySelector('#showFirstFrame').onclick=async()=>{try{await persistSettings();const assets=await preparedPromise;drawProjectFrame(project,assets,canvas,0);canvas.scrollIntoView({behavior:'smooth',block:'center'});renderStatus.textContent='先頭フレームを表示しました。';}catch(error){alert(`画像確認に失敗しました：${error.message}`);}};
  root.querySelector('#previewVideo').onclick=async()=>{
    if(previewController)return;previewController=new AbortController();root.querySelector('#stopPreview').disabled=false;root.querySelector('#previewVideo').disabled=true;renderStatus.textContent='映像プレビュー中（音なし）…';progress.value=0;canvas.scrollIntoView({behavior:'smooth',block:'center'});
    try{await persistSettings();const assets=await preparedPromise;await runVisualPreview(project,assets,canvas,{durationLimit:10,signal:previewController.signal,onProgress:updateProgress});renderStatus.textContent='プレビュー完了';}
    catch(error){if(error.name!=='AbortError'){console.error(error);alert(`プレビューに失敗しました：${error.message}`);}renderStatus.textContent=error.name==='AbortError'?'プレビューを停止しました':'プレビューエラー';}
    finally{previewController=null;root.querySelector('#stopPreview').disabled=true;root.querySelector('#previewVideo').disabled=false;}
  };
  root.querySelector('#stopPreview').onclick=()=>previewController?.abort();

  root.querySelector('#generateVideo').onclick=async()=>{
    if(renderController)return;
    try{await persistSettings();}catch(error){console.error(error);alert(`出力設定を保存できませんでした：${error.message}`);return;}
    if(!(project.finalReview?.approved && project.finalReview?.signature===finalReviewSignature(project))){
      alert('最終素材チェックが未確認、または確認後に素材・字幕設定が変更されています。もう一度「この素材で動画生成を許可」を押してください。');
      return;
    }
    const check=validateVideoProject(project);if(check.errors.length)return alert(check.errors.join('\n'));
    const range=root.querySelector('#renderRange').value;const limit=range==='full'?undefined:10;const currentTotal=getProjectDuration(project);const duration=limit?Math.min(currentTotal,limit):currentTotal;
    if(!limit&&isMvpShortsProject(project)){const mvp=validateMvpShortsOutput(project,currentTotal);if(mvp.errors.length)return alert(`MVP Shortsの全編生成条件を確認してください。\n\n${mvp.errors.join('\n')}\n\n原因切り分けは「先頭10秒」なら実行できます。`);}
    if(!limit&&duration>180)return alert('初版の全編生成は3分以内に制限しています。先頭10秒で動作確認してください。');

    const generationDialog=getVideoGenerationConfirmDialog();
    generationDialog.querySelector('[data-generation-message]').textContent=`約${Math.ceil(duration)}秒の動画を生成します。`;
    const startDecision=await new Promise(resolve=>{
      const closeDialog=()=>{
        if(typeof generationDialog.close==='function' && generationDialog.open) generationDialog.close();
        else generationDialog.removeAttribute('open');
      };
      const controller=createGenerationStartController({
        expectsAudio:projectExpectsVideoAudio(project),
        AudioContextClass:globalThis.AudioContext||globalThis.webkitAudioContext||null,
        onApprove:audioState=>{closeDialog();resolve({confirmed:true,...audioState});},
        onCancel:()=>{closeDialog();resolve({confirmed:false});}
      });
      generationDialog.querySelector('[data-generation-confirm]').onclick=()=>controller.approve();
      generationDialog.querySelector('[data-generation-cancel]').onclick=()=>controller.cancel();
      generationDialog.oncancel=event=>{event.preventDefault();controller.cancel();};
      if(typeof generationDialog.showModal==='function') generationDialog.showModal();
      else generationDialog.setAttribute('open','');
    });
    if(!startDecision.confirmed)return;

    const expectedSceneNarrations=scenes.filter(scene=>scene?.narration?.audioData).length;
    let unlockedAudioContext=startDecision.audioContext||null;
    const closeUnlockedAudioContext=async()=>{try{if(unlockedAudioContext&&unlockedAudioContext.state!=='closed')await unlockedAudioContext.close();}catch{}};
    if(startDecision.audioStartError){
      renderStatus.textContent='音声開始エラー';
      diagnostics.textContent=`音声を開始できませんでした：${startDecision.audioStartError.message||startDecision.audioStartError}`;
      diagnostics.classList.add('warn');
      await closeUnlockedAudioContext();
      return;
    }
    const audioResumeError=await startDecision.audioResumeResult;
    if(audioResumeError){
      renderStatus.textContent='音声開始エラー';
      diagnostics.textContent=`音声を有効化できませんでした：${audioResumeError.message||audioResumeError}。もう一度「動画を生成」から開始してください。`;
      diagnostics.classList.add('warn');
      await closeUnlockedAudioContext();
      return;
    }
    renderController=new AbortController();root.querySelector('#cancelRender').disabled=false;root.querySelector('#generateVideo').disabled=true;root.querySelector('#previewVideo').disabled=true;progress.value=0;
    try{
      let assets=await preparedPromise;
      const preparedSceneNarrations=Array.isArray(assets.sceneNarrations)?assets.sceneNarrations.filter(item=>item?.arrayBuffer).length:0;
      if((project.output?.bgmEnabled&&project.bgm?.audioData&&!assets.audioArrayBuffer)||(project.narration?.audioData&&!expectedSceneNarrations&&!assets.narrationArrayBuffer)||(expectedSceneNarrations&&preparedSceneNarrations<expectedSceneNarrations)){assets=await prepareVideoProject(project,{onStatus:text=>renderStatus.textContent=text});prepared=assets;describeAssets(assets);}
      const result=await exportProjectVideo(project,assets,canvas,{durationLimit:limit,signal:renderController.signal,onProgress:updateProgress,onStatus:text=>renderStatus.textContent=text,audioContext:unlockedAudioContext});
      if(resultUrl)URL.revokeObjectURL(resultUrl);resultUrl=URL.createObjectURL(result.blob);resultFile=new File([result.blob],`${safeName(project.title)}.${result.extension}`,{type:result.mimeType});
      const resultBox=root.querySelector('#renderResult');resultBox.hidden=false;const resultVideo=root.querySelector('#resultVideo');resultVideo.src=resultUrl;const link=root.querySelector('#downloadVideo');link.href=resultUrl;link.download=resultFile.name;const info=root.querySelector('#resultInfo');const verifyInfo=root.querySelector('#verifySavedVideoInfo');verifyInfo.textContent='保存後に「保存後ファイルを検証」で同じ動画を選ぶと、変換・縮小の有無を確認できます。';const d=result.diagnostics||{};const captureSize=d.captureWidth&&d.captureHeight?`${d.captureWidth}×${d.captureHeight}`:'取得不可';const captureFps=d.captureFrameRate?`・約${Number(d.captureFrameRate).toFixed(1)}fps`:'';const baseInfo=`${result.extension.toUpperCase()}・${result.mimeType}・${(result.blob.size/1024/1024).toFixed(1)}MB・${result.durationSec.toFixed(1)}秒`;generatedMeta={size:result.blob.size,width:null,height:null,mime:result.mimeType};try{if(globalThis.crypto?.subtle){const buf=await result.blob.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buf);generatedHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}}catch{}info.textContent=`${baseInfo}\n要求 ${d.requestedWidth||'?'}×${d.requestedHeight||'?'} ／ Canvas ${d.canvasWidth||'?'}×${d.canvasHeight||'?'} ／ captureStream ${captureSize}`;resultVideo.onloadedmetadata=()=>{generatedMeta.width=resultVideo.videoWidth||null;generatedMeta.height=resultVideo.videoHeight||null;info.textContent=`${baseInfo}\n要求 ${d.requestedWidth||'?'}×${d.requestedHeight||'?'} ／ Canvas ${d.canvasWidth||'?'}×${d.canvasHeight||'?'} ／ captureStream ${captureSize}${captureFps} ／ 生成Blob ${resultVideo.videoWidth||'?'}×${resultVideo.videoHeight||'?'}${isMvpShortsProject(project)?`\nMVP確認：${assessMvpVideoResult({project,durationSec:result.durationSec,mimeType:result.mimeType,selectedMimeType:d.selectedMimeType,videoWidth:resultVideo.videoWidth,videoHeight:resultVideo.videoHeight,captureFrameRate:d.captureFrameRate,hasAudio:d.hasAudio}).text}`:''}`;};renderStatus.textContent='動画生成が完了しました。';
      resultBox.scrollIntoView({behavior:'smooth',block:'center'});
    }catch(error){if(error.name!=='AbortError'){console.error(error);alert(`動画生成に失敗しました。\n\n${describeVideoExportFailure(error,{durationSec:duration,width:o.width,height:o.height,fps:o.fps})}`);}renderStatus.textContent=error.name==='AbortError'?'動画生成を中止しました':'動画生成エラー';}
    finally{await closeUnlockedAudioContext();renderController=null;root.querySelector('#cancelRender').disabled=true;root.querySelector('#generateVideo').disabled=!(capabilities.supported && project.finalReview?.approved && project.finalReview?.signature===finalReviewSignature(project));root.querySelector('#previewVideo').disabled=false;}
  };
  root.querySelector('#cancelRender').onclick=()=>renderController?.abort();
  root.querySelector('#shareVideo').onclick=async()=>{if(!resultFile)return;try{if(navigator.canShare?.({files:[resultFile]}))await navigator.share({title:project.title,files:[resultFile]});else alert('この端末ではファイル共有を利用できません。「動画を保存」をお使いください。');}catch(error){if(error.name!=='AbortError')alert(`共有できませんでした：${error.message}`);}};
  const verifyInput=root.querySelector('#verifySavedVideoInput');
  root.querySelector('#verifySavedVideo').onclick=()=>{if(!resultFile)return alert('先に動画を生成してください。');verifyInput.value='';verifyInput.click();};
  verifyInput.onchange=async()=>{const file=verifyInput.files?.[0];if(!file)return;const verifyInfo=root.querySelector('#verifySavedVideoInfo');verifyInfo.textContent='保存後ファイルを検証しています…';const url=URL.createObjectURL(file);try{const meta=await new Promise((resolve,reject)=>{const v=document.createElement('video');v.preload='metadata';v.playsInline=true;v.onloadedmetadata=()=>resolve({width:v.videoWidth,height:v.videoHeight,duration:v.duration});v.onerror=()=>reject(new Error('動画メタデータを読み込めませんでした。'));v.src=url;});let savedHash='';try{if(globalThis.crypto?.subtle){const buf=await file.arrayBuffer();const digest=await crypto.subtle.digest('SHA-256',buf);savedHash=Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,'0')).join('');}}catch{}const sameSize=generatedMeta&&file.size===generatedMeta.size;const sameHash=Boolean(generatedHash&&savedHash&&generatedHash===savedHash);const sameResolution=generatedMeta?.width===meta.width&&generatedMeta?.height===meta.height;const verdict=sameHash?'完全一致：保存後も生成Blobと同一ファイルです。':sameSize&&sameResolution?'見た目の主要情報は一致（ハッシュは不一致または取得不可）。':sameResolution?'解像度は一致していますが、ファイル内容またはサイズが変化しています。':'解像度が変化しています。保存・共有経路で変換された可能性があります。';verifyInfo.textContent=`検証結果：${verdict}\n生成 ${generatedMeta?.width||'?'}×${generatedMeta?.height||'?'}・${generatedMeta?Math.round(generatedMeta.size/1024):'?'}KB ／ 保存後 ${meta.width||'?'}×${meta.height||'?'}・${Math.round(file.size/1024)}KB${sameHash?' ／ SHA-256一致':''}`;}catch(error){verifyInfo.textContent=`検証できませんでした：${error.message}`;}finally{URL.revokeObjectURL(url);}};

  root.querySelector('#exportSrt').onclick=()=>{const srt=buildSrt(project);if(!srt.trim())return alert('書き出せる字幕がありません。');downloadText(`${safeName(project.title)}.srt`,srt,'application/x-subrip;charset=utf-8');};
  root.querySelector('#exportPlan').onclick=()=>downloadJson(`${safeName(project.title)}-production-plan.json`,{schemaVersion:3,title:project.title,output:o,scenes,bgm:project.bgm,narration:project.narration,subtitleStyle:st,subtitles:buildSubtitleTimeline(project),scripts:{display:project.displayScript,speech:project.speechScript}});root.querySelector('#exportJson').onclick=()=>downloadProjectBackup(project);
}

async function renderPublish(id) {
  const project=await getProject(id);if(!project){goHome();return;}ensureProjectSettings(project);const p=project.publish;
  root.innerHTML=`<main class="shell editor-shell"><header class="editor-head"><button id="back">←</button><div><span>投稿準備</span><h1>${escapeHtml(project.title)}</h1></div><button id="menu">•••</button></header><section class="editor-card"><div class="section-head"><div><h2>YouTube投稿情報</h2><p>タイトル・概要欄・タグをまとめます。</p></div><span id="saveState">保存済み</span></div><label>タイトル<input id="publishTitle" value="${escapeHtml(p.title)}"></label><label>概要欄<textarea id="description" placeholder="動画の概要、出典、クレジットなど">${escapeHtml(p.description)}</textarea></label><label>タグ<input id="tags" value="${escapeHtml(p.tags)}" placeholder="偉人, 名言, Shorts"></label><label>サムネ文字<input id="thumbnailText" value="${escapeHtml(p.thumbnailText)}" placeholder="短く強い言葉"></label><label>公開設定<select id="visibility"><option value="private">非公開</option><option value="unlisted">限定公開</option><option value="public">公開</option></select></label><div class="tool-row"><button id="copyTitle">タイトルをコピー</button><button id="copyDescription">概要欄をコピー</button><button id="copyAll" class="primary">全部コピー</button></div></section><section class="actions"><button id="backOutput">← 出力へ</button><button id="exportJson">投稿情報JSON</button><button class="primary" id="done">Studioへ戻る</button></section></main>`;
  root.querySelector('#visibility').value=p.visibility;attachProjectMenu(project,root.querySelector('#menu'),()=>goStudio(studioForGenre(project.genre)));
  const persist=async()=>{Object.assign(p,{title:root.querySelector('#publishTitle').value,description:root.querySelector('#description').value,tags:root.querySelector('#tags').value,thumbnailText:root.querySelector('#thumbnailText').value,visibility:root.querySelector('#visibility').value});project.updatedAt=new Date().toISOString();await saveProject(project);};
  const {scheduleSave:save,flushSave}=createSaveController({delay:400,persist,setStatus:text=>root.querySelector('#saveState').textContent=text});
  bindSavedNavigation(root.querySelector('#back'),flushSave,()=>goOutput(id));
  bindSavedNavigation(root.querySelector('#backOutput'),flushSave,()=>goOutput(id));
  bindSavedNavigation(root.querySelector('#done'),flushSave,()=>goStudio(studioForGenre(project.genre)));
  ['publishTitle','description','tags','thumbnailText','visibility'].forEach(k=>root.querySelector('#'+k).oninput=save);
  const copy=async t=>{try{await navigator.clipboard.writeText(t);alert('コピーしました');}catch{prompt('コピーしてください',t);}};root.querySelector('#copyTitle').onclick=()=>copy(root.querySelector('#publishTitle').value);root.querySelector('#copyDescription').onclick=()=>copy(root.querySelector('#description').value);root.querySelector('#copyAll').onclick=()=>copy(`${root.querySelector('#publishTitle').value}\n\n${root.querySelector('#description').value}\n\n${root.querySelector('#tags').value}`);root.querySelector('#exportJson').onclick=()=>downloadJson(`${safeName(project.title)}-publish.json`,p);
}



const BRAND_KEY = "creator-os-brands-v1";
const DEFAULT_BRANDS = [
  {
    id:"great-wisdom", studio:"great-person", name:"偉人の知恵",
    worldview:"偉人の知恵を現代へ翻訳し、面白さだけでなく人生で使える学びを届ける。",
    voice:"落ち着いた教養系。難しい言葉を避け、具体的な出来事から現代の行動へつなげる。",
    imageRules:"縦9:16。1シーン1枚。人物の顔・年齢・服装・時代背景・画風を全シーンで統一する。",
    ngRules:"出典不明の名言を本人の言葉として断定しない。史実と推測を混同しない。同じ人物・テーマを短期間で重複させない。",
    postingRules:"YouTube Shortsは冒頭3秒の引き、具体的な逸話、現代への翻訳、締めの順。45〜60秒を基本とする。"
  },
  {
    id:"rain-library", studio:"bgm", name:"Rain Library",
    worldview:"日常の集中・読書・睡眠を邪魔せず、静かに寄り添う長時間BGM。",
    voice:"言葉は最小限。穏やかで静かな表現を使い、過剰な癒やし効果を断定しない。",
    imageRules:"雨上がりの窓辺、青〜緑の寒色、観葉植物、カーテン、絵本など暮らしの気配。雷なし。水滴、微かな葉揺れ、ゆっくりしたカメラ移動。",
    ngRules:"著作権・商用利用条件が不明な音源を採用しない。医学的効果や周波数効果を断定しない。",
    postingRules:"用途、雰囲気、動画時間、音源条件、クレジットを整理。1時間・3時間・8時間など長時間動画を想定する。"
  },
  {
    id:"learning-lab", studio:"education", name:"知育ラボ",
    worldview:"親子が無理なく試せる遊びと学びを、発達段階に合わせて分かりやすく届ける。",
    voice:"保護者を責めない、やさしく具体的な言葉。できないことより、今できる小さな一歩を示す。",
    imageRules:"親子の安心感、清潔で見やすい画面、年齢に合う安全な玩具。カルーセル画像は1枚ずつ個別生成する。",
    ngRules:"発達を断定しない。医療診断の代替にしない。誤飲・窒息・転倒などの安全配慮を省略しない。",
    postingRules:"対象年齢、ねらい、やり方、安全上の注意、親への声かけを明示する。"
  },
  {
    id:"mochizuki-koyomi", studio:"fortune", name:"望月こよみ",
    worldview:"暦と暮らしを結び、日常に取り入れやすい小さな開運行動を届ける。世界観で統一し、ブランド名を毎回強く主張しない。",
    voice:"穏やかで生活に寄り添う文章。強い断定や不安を煽る表現を避け、1分でできる行動へ落とし込む。",
    imageRules:"正方形を基本。投稿1件につき画像1枚。タイトル最優先、左上の余白を活かす。ロゴ風ラベルを入れない。ブランド名を入れる場合は最下部に小さく。カルーセルは必ず1枚ずつ生成する。",
    ngRules:"暦・天体・日付を未確認で断定しない。吉凶だけで恐怖を煽らない。根拠の弱いスピリチュアル表現を事実として扱わない。",
    postingRules:"情報優先順位は、1.暦・天体、2.風水、3.陰陽五行、4.心理、5.スピリチュアル。Xは非プレミアム想定で文字数を抑え、ハッシュタグは2〜3個。根拠と低ハードルの1分アクションを入れる。"
  },
  {
    id:"creator-sns", studio:"sns", name:"Creator SNS",
    worldview:"媒体ごとの特徴を活かし、制作物の価値を正確かつ魅力的に伝える。",
    voice:"簡潔で読みやすく、目的と行動導線が明確な文章。",
    imageRules:"媒体の推奨比率と安全領域を守り、タイトルの視認性を優先する。",
    ngRules:"釣りタイトル、虚偽、過剰な誇張、無関係なハッシュタグを避ける。",
    postingRules:"YouTube、Instagram、Xごとの文字数・導線・ハッシュタグ・投稿形式へ最適化する。"
  }
];

const CONTENT_TYPES = {
  "great-person":[
    ["shorts-life","人生で使えるShorts"],
    ["challenge","挑戦・失敗・再起"],
    ["relationships","人間関係・リーダーシップ"],
    ["philosophy","哲学・幸福"],
    ["learning","学び直し・習慣"]
  ],
  "bgm":[
    ["rain","雨・窓辺"],
    ["sleep","睡眠・夜"],
    ["study","集中・読書"],
    ["cafe","カフェ・Lo-Fi"],
    ["nature","森・波・小川"]
  ],
  "education":[
    ["play","親子遊び"],
    ["learning","幼児学習"],
    ["voice","親子の声かけ"],
    ["carousel","Instagramカルーセル"],
    ["reel","リール・Shorts"]
  ],
  "fortune":[
    ["daily","毎日の開運"],
    ["fortune","今日・明日の運勢"],
    ["moon","新月・満月"],
    ["doyo","土用・季節の節目"],
    ["sekki","二十四節気"],
    ["lucky-day","吉日・暦特集"],
    ["misoka","ミソカモウデ・月末振り返り"]
  ],
  "sns":[
    ["youtube","YouTube投稿"],
    ["instagram","Instagram投稿"],
    ["x","X投稿"],
    ["review","投稿審査"],
    ["analysis","結果分析"]
  ]
};

const AI_ROLES = {
  "great-person": [
    {id:"editor", icon:"👔", name:"編集長AI", purpose:"人物・テーマ・視聴者・動画の狙いを決める"},
    {id:"research", icon:"🔍", name:"リサーチAI", purpose:"史実・逸話・名言・出典候補を整理する"},
    {id:"script", icon:"✍️", name:"脚本AI", purpose:"調査結果をShorts向けの台本へ変換する"},
    {id:"image", icon:"🎨", name:"画像AI", purpose:"各シーンの画像生成プロンプトを作る"},
    {id:"narration", icon:"🎙", name:"ナレーションAI", purpose:"聞きやすい語り口・読み・間へ整える"},
    {id:"review", icon:"✅", name:"審査AI", purpose:"史実・出典・重複・構成・表現を審査する"},
    {id:"publish", icon:"📈", name:"投稿AI", purpose:"タイトル・概要欄・タグ・サムネ文言を作る"}
  ],
  "bgm": [
    {id:"producer", icon:"🎧", name:"BGMプロデューサーAI", purpose:"用途・世界観・長さ・視聴場面を設計する"},
    {id:"music", icon:"🎼", name:"音源設計AI", purpose:"作曲依頼または無料音源選定用の条件を作る"},
    {id:"visual", icon:"🌧️", name:"背景映像AI", purpose:"背景画像・微細な動き・ループ演出を設計する"},
    {id:"loop", icon:"🔁", name:"ループ品質AI", purpose:"音と映像が自然につながる確認項目を作る"},
    {id:"review", icon:"✅", name:"権利・品質AI", purpose:"利用条件、音量、ノイズ、長時間視聴の品質を審査する"},
    {id:"publish", icon:"📈", name:"投稿AI", purpose:"タイトル・概要欄・タグ・サムネ文言を作る"}
  ],
  "education": [
    {id:"editor", icon:"👔", name:"企画AI", purpose:"対象年齢・発達・保護者の悩みを整理する"},
    {id:"safety", icon:"🛡️", name:"安全確認AI", purpose:"遊びや教材の安全上の注意を確認する"},
    {id:"writer", icon:"✍️", name:"解説AI", purpose:"親子に分かりやすい投稿・動画構成を作る"},
    {id:"visual", icon:"🎨", name:"画像AI", purpose:"カルーセル・リール用の画面指示を作る"},
    {id:"review", icon:"✅", name:"審査AI", purpose:"年齢適合、安全性、表現、仕様を審査する"},
    {id:"publish", icon:"📈", name:"投稿AI", purpose:"キャプション・タイトル・タグを作る"}
  ],
  "fortune": [
    {id:"calendar", icon:"📅", name:"暦調査AI", purpose:"暦・天体・五行など確認項目を整理する"},
    {id:"editor", icon:"👔", name:"編集長AI", purpose:"その日の発信テーマと優先順位を決める"},
    {id:"writer", icon:"✍️", name:"ライターAI", purpose:"生活に取り入れやすい投稿文へ変換する"},
    {id:"visual", icon:"🎨", name:"画像AI", purpose:"望月こよみの画像生成指示を作る"},
    {id:"review", icon:"✅", name:"審査AI", purpose:"根拠・断定表現・日付・文字数・画像仕様を確認する"}
  ],
  "sns": [
    {id:"strategy", icon:"🧭", name:"運用AI", purpose:"媒体・目的・投稿形式を決める"},
    {id:"writer", icon:"✍️", name:"投稿文AI", purpose:"媒体に合わせて文章を整える"},
    {id:"visual", icon:"🎨", name:"クリエイティブAI", purpose:"画像・サムネ文言・構成を作る"},
    {id:"review", icon:"✅", name:"品質管理AI", purpose:"文字数・重複・表現を確認する"},
    {id:"analysis", icon:"📊", name:"分析AI", purpose:"結果を振り返り次の改善案を出す"}
  ]
};

const COMMON_RULES = `あなたはCreator OS内の専門AIスタッフです。
不明点を勝手に埋めず、事実・推測・提案を区別してください。
ユーザーの既存資産、ブランドルール、媒体仕様を優先してください。
回答はCreator OSへ貼り戻しやすい見出し付きプレーンテキストで出力してください。
必要な情報が不足している場合は、成果物の前に「確認事項」を短く示してください。`;

const STUDIO_RULES = {
  "great-person":`目的は「偉人の知恵を現代へ翻訳する」ことです。
面白いだけでなく、視聴後に人生で使える行動や見方が残る内容にしてください。
男性・女性、国・時代、努力・人間関係・幸福・挑戦・哲学・歴史・リーダーシップ・教育・習慣の偏りを避けてください。`,
  "bgm":`目的は、集中・読書・睡眠・休息などの視聴用途に合う長時間BGM動画を作ることです。
音源、背景、ループ、長さ、権利条件、投稿情報を一体で設計してください。
音や映像は主張しすぎず、長時間視聴を妨げないことを優先してください。`,
  "education":`目的は、親子が安全に実践できる知育・学習コンテンツを作ることです。
対象年齢、発達段階、安全性、保護者の見守り、準備物、ねらいを明確にしてください。`,
  "fortune":`目的は、暦・天体・風水・陰陽五行を暮らしへ落とし込むことです。
日付依存情報は必ず確認対象として扱い、強い吉凶断定や不安を煽る表現を避けてください。`,
  "sns":`目的は、各媒体の形式に合わせ、内容の価値が正確に伝わる投稿を作ることです。
媒体ごとの文字数、視認性、導線、ハッシュタグ、投稿形式を守ってください。`
};

const FORMAT_RULES = {
  "shorts-life":"45〜60秒のYouTube Shorts。冒頭3秒の引き、具体的な逸話、現代への翻訳、締めの順。",
  "challenge":"失敗・壁・転機・再起を具体的な出来事で描き、根性論だけにしない。",
  "relationships":"人間関係やリーダーシップの場面を具体化し、現代の職場や家庭へ翻訳する。",
  "philosophy":"抽象論だけで終わらず、日常の選択や行動へ落とし込む。",
  "learning":"学び直し・習慣・教育の具体的な行動を中心にする。",
  "rain":"雨や窓辺を中心に、雷なし。音と映像のループ境界を自然にする。",
  "sleep":"急な音量変化や強い高音を避け、睡眠を妨げない設計にする。",
  "study":"集中を邪魔しない一定の音量と穏やかな反復を重視する。",
  "cafe":"カフェの生活感とLo-Fi感を持たせつつ、権利条件を明確にする。",
  "nature":"自然音の不自然な反復や突然の大音量を避ける。",
  "play":"対象年齢、ねらい、手順、安全上の注意、保護者の声かけを出す。",
  "learning":"学習目標を一つに絞り、家庭で無理なく試せる形にする。",
  "voice":"親を責めず、具体的な言い換え例と理由を示す。",
  "carousel":"画像は1枚ずつ独立して設計し、各枚の役割と文字量を明確にする。",
  "reel":"短い導入、実演、ポイント、安全注意、締めの順にする。",
  "daily":"その日の根拠情報と、1分でできる低ハードル行動を一つ示す。",
  "fortune":"西洋占星術・九星気学・数秘術・四柱推命等を扱う場合、占術ごとの根拠と総合判断を分ける。",
  "moon":"新月・満月の日時、星座、観測・占星術上の扱いを混同しない。",
  "doyo":"土用期間、丑の日、季節の養生、食文化を区別し、過度な開運断定を避ける。",
  "sekki":"二十四節気の意味、季節の変化、暮らしの行動へ落とし込む。",
  "lucky-day":"吉日が重なる場合も、注意日や行動の規模を含めてバランス良く示す。",
  "misoka":"月末の振り返りと感謝、翌月準備を中心にし、夜間参拝を安易に勧めない。",
  "youtube":"タイトル、概要欄、タグ、サムネ文字をYouTube向けに作る。",
  "instagram":"キャプション、カルーセル構成、リール導入、ハッシュタグをInstagram向けに作る。",
  "x":"短い本文と必要に応じたスレッド、ハッシュタグ2〜3個をX向けに作る。",
  "review":"仕様適合、根拠、誤字、断定、文字数、重複を順に審査する。",
  "analysis":"数値と感想を分け、次回に試す改善を最大3件に絞る。"
};

const ROLE_RULES = {
  editor:"全体の偏り、シリーズ重複、対象視聴者、今回の一番伝えたいメッセージ、次工程への指示を出してください。",
  research:"一次資料・公式情報・信頼できる資料を優先し、史実・引用・推測・確認待ちを分けてください。引用候補は出典確認が必要です。",
  script:"導入、具体的な出来事、転換、現代への翻訳、締めを明確にし、聞いて理解できる日本語にしてください。",
  image:"1画像1役割。サイズ、構図、人物一貫性、時代背景、文字内容、禁止事項を明示してください。",
  narration:"字幕表示用原稿と音声用原稿を分け、漢字の読み候補、間、息継ぎ、強調語を示してください。",
  review:"最初に依頼仕様への適合を判定し、次に事実・表現・文字数・画像・重複を審査してください。不合格なら修正指示を具体化してください。",
  publish:"媒体に合わせたタイトル、概要欄・本文、タグ、サムネ文字、必要なクレジットを作ってください。",
  producer:"用途、視聴場面、世界観、感情曲線、尺、音と映像の役割を決めてください。",
  music:"ループ可能で主張しすぎない音設計にし、商用利用・収益化・クレジット条件を必ず確認してください。",
  visual:"長時間視聴を邪魔しない背景、微細な動き、カメラ移動、ループ方法を設計してください。",
  loop:"音量差、クリック音、無音、映像の飛び、ループ境界を確認するチェックリストを作ってください。",
  safety:"誤飲、窒息、転倒、アレルギー、保護者の見守りなど対象年齢に応じた安全確認を優先してください。",
  writer:"ブランドの文体と媒体の文字数に合わせ、具体的で実行しやすい文章を作ってください。",
  calendar:"対象日、タイムゾーン、旧暦、六曜、十二直、二十八宿、日干支、月相、天体イベント等を確認項目として分けてください。",
  strategy:"目的、媒体、ターゲット、投稿形式、導線、KPIを整理してください。",
  analysis:"成果数値、仮説、外部要因、次に試す改善を分けてください。",
  quality:"権利条件、音質、映像品質、ループ、長時間視聴への影響を審査してください。"
};

function loadBrands() {
  try {
    const saved = JSON.parse(localStorage.getItem(BRAND_KEY) || "null");
    if (Array.isArray(saved) && saved.length) return saved;
  } catch {}
  localStorage.setItem(BRAND_KEY, JSON.stringify(DEFAULT_BRANDS));
  return structuredClone(DEFAULT_BRANDS);
}
function saveBrands(brands) { localStorage.setItem(BRAND_KEY, JSON.stringify(brands)); }
function defaultBrandForStudio(studio) {
  return loadBrands().find(brand => brand.studio === studio) || loadBrands()[0];
}
function contentTypesForStudio(studio) { return CONTENT_TYPES[studio] || CONTENT_TYPES.sns; }
function contentTypeLabel(studio, id) {
  return contentTypesForStudio(studio).find(item => item[0] === id)?.[1] || id;
}
function rolesForProject(project) {
  return AI_ROLES[studioForGenre(project.genre)] || AI_ROLES.sns;
}
function ensureAiWorkspace(project) {
  project.aiWorkspace = project.aiWorkspace || {};
  project.promptProfile = project.promptProfile || {};
  project.promptLibrary = Array.isArray(project.promptLibrary) ? project.promptLibrary : [];
  const studio = studioForGenre(project.genre);
  const brand = defaultBrandForStudio(studio);
  project.promptProfile.brandId = project.promptProfile.brandId || brand.id;
  project.promptProfile.contentType = project.promptProfile.contentType || contentTypesForStudio(studio)[0][0];
}
function selectedBrand(project) {
  const brands = loadBrands();
  return brands.find(brand => brand.id === project.promptProfile?.brandId) || defaultBrandForStudio(studioForGenre(project.genre));
}
function composePrompt(project, role, brief) {
  ensureAiWorkspace(project);
  const studio = studioForGenre(project.genre);
  const brand = selectedBrand(project);
  const contentType = project.promptProfile.contentType;
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const sourceResults = Object.entries(project.aiWorkspace || {})
    .filter(([key,value]) => key !== role.id && value?.result)
    .map(([key,value]) => `## ${key}の保存済み回答\n${value.result}`)
    .join("\n\n");

  return `# Creator OS 完成プロンプト

## 1. 共通ルール
${COMMON_RULES}

## 2. Studioルール
Studio：${STUDIO[studio]?.title || studio}
${STUDIO_RULES[studio] || ""}

## 3. ブランドルール
ブランド：${brand.name}
世界観：${brand.worldview}
文体・語り口：${brand.voice}
画像ルール：${brand.imageRules}
NG表現・禁止事項：${brand.ngRules}
投稿・運用ルール：${brand.postingRules}

## 4. 作成形式ルール
作成形式：${contentTypeLabel(studio, contentType)}
${FORMAT_RULES[contentType] || ""}

## 5. 担当AI
担当：${role.name}
担当目的：${role.purpose}
${ROLE_RULES[role.id] || "担当目的に沿って成果物を作成してください。"}

## 6. 媒体・プロジェクト情報
タイトル：${project.title}
ジャンル：${labelGenre(project.genre)}
媒体：${labelPlatform(project.platform)}
目標尺：${project.targetDurationSec}秒
シーン数：${scenes.length}
BGM：${project.bgm?.title || project.bgm?.category || "未設定"}

## 7. 今回の依頼
${brief || "この担当として、次工程に必要な完成成果物を作成してください。"}

## 8. 現在の表示用台本
${project.displayScript || "未入力"}

## 9. 他担当から引き継ぐ保存済み成果
${sourceResults || "なし"}

## 10. 出力条件
- 最初に「確認事項」がある場合のみ短く示す
- 次に、そのまま次工程へ渡せる完成成果物を出す
- 事実・推測・提案を混同しない
- 不確かな固有名詞・日付・引用は確認対象として明示する
- Creator OSへ一括コピーしやすい見出し付きプレーンテキストで出力する`;
}

async function copyText(value) {
  try { await navigator.clipboard.writeText(value); alert("コピーしました。"); }
  catch { prompt("コピーしてください", value); }
}
function promptVersions(project, roleId) {
  return project.promptLibrary.filter(item => item.roleId === roleId).sort((a,b) => new Date(b.createdAt)-new Date(a.createdAt));
}
function promptDiffSummary(a="", b="") {
  if (a === b) return "変更なし";
  const aLines = a.split("\n"), bLines = b.split("\n");
  let changed = 0;
  const max = Math.max(aLines.length,bLines.length);
  for(let i=0;i<max;i++) if(aLines[i] !== bLines[i]) changed++;
  return `行数 ${aLines.length} → ${bLines.length}／変更行の目安 ${changed}`;
}

async function renderAi(id) {
  const project = await getProject(id);
  if (!project) { goHome(); return; }
  ensureAiWorkspace(project);
  const studio = studioForGenre(project.genre);
  const roles = rolesForProject(project);
  const firstRole = roles[0];
  const brands = loadBrands().filter(brand => brand.studio === studio);
  const types = contentTypesForStudio(studio);

  root.innerHTML = `
    <main class="shell editor-shell">
      <header class="editor-head"><button id="back">←</button><div><span>Prompt Engine v1</span><h1>🧠 AIスタッフ・プロンプト資産</h1></div><button id="menu">•••</button></header>
      <nav class="steps"><button class="active">0 AIスタッフ</button><button id="stepScript">1 台本</button><button id="stepScenes">2 シーン・ナレーション</button><button id="stepBgm">3 字幕・BGM</button><button id="stepOutput">4 出力</button></nav>
      <section class="editor-card ai-mode-notice">
        <div><strong>現在の接続方法：手動コピーモード</strong><p>Studio・ブランド・作成形式・担当AIのルールを自動合成します。API料金は発生しません。</p></div>
        <span class="status-chip">無料運用</span>
      </section>
      <section class="editor-card prompt-profile">
        <div class="section-head"><div><h2>プロンプトプロファイル</h2><p>選択内容に応じて内部プロンプトが自動で切り替わります。</p></div><button id="editBrand">ブランド設定</button></div>
        <div class="form-grid">
          <label>Studio<input value="${escapeHtml(STUDIO[studio]?.title || studio)}" disabled></label>
          <label>ブランド<select id="brandSelect">${brands.map(brand=>`<option value="${brand.id}">${escapeHtml(brand.name)}</option>`).join("")}</select></label>
          <label>作成形式<select id="contentType">${types.map(item=>`<option value="${item[0]}">${escapeHtml(item[1])}</option>`).join("")}</select></label>
          <label>媒体<input value="${escapeHtml(labelPlatform(project.platform))}" disabled></label>
        </div>
      </section>
      <section class="ai-layout">
        <aside class="ai-role-list">
          ${roles.map((role,index)=>`<button class="ai-role ${index===0?"active":""}" data-role="${role.id}"><span>${role.icon}</span><div><b>${role.name}</b><small>${role.purpose}</small></div></button>`).join("")}
        </aside>
        <section class="ai-workspace">
          <div class="editor-card">
            <div class="section-head"><div><h2 id="roleTitle">${firstRole.icon} ${firstRole.name}</h2><p id="rolePurpose">${firstRole.purpose}</p></div><span id="saveState">保存済み</span></div>
            <label>今回この担当へ依頼すること<textarea id="aiBrief" placeholder="今回だけの目的・対象・条件を入力します。"></textarea></label>
            <div class="tool-row"><button class="primary" id="generatePrompt">完成プロンプトを合成</button><button id="copyPrompt">ChatGPT用にコピー</button><button id="saveVersion">版として保存</button></div>
          </div>
          <div class="editor-card"><div class="section-head"><div><h2>完成プロンプト</h2><p>共通＋Studio＋ブランド＋作成形式＋担当＋今回情報を合成します。</p></div><span id="promptLength">0文字</span></div><textarea id="aiPrompt" class="code-area" placeholder="ここに完成プロンプトが生成されます。"></textarea></div>
          <div class="editor-card"><div class="section-head"><div><h2>AIからの回答</h2><p>返ってきた成果物を貼り付け、次の担当へ引き継ぎます。</p></div><button id="useAsScript">台本へ反映</button></div><textarea id="aiResult" placeholder="AIの回答をここへ貼り付けます。"></textarea><div class="tool-row"><button class="primary" id="saveResult">回答を保存</button><button id="copyResult">回答をコピー</button></div></div>
          <div class="editor-card">
            <div class="section-head"><div><h2>Prompt Library</h2><p>担当ごとの版を保存し、復元・評価できます。</p></div><span id="versionCount">0版</span></div>
            <div id="versionList" class="version-list"></div>
          </div>
        </section>
      </section>
      <dialog id="brandDialog"><form method="dialog" id="brandForm"><h2>ブランド設定</h2><input type="hidden" name="brandId"><label>ブランド名<input name="name" required></label><label>世界観<textarea name="worldview"></textarea></label><label>文体・語り口<textarea name="voice"></textarea></label><label>画像ルール<textarea name="imageRules"></textarea></label><label>NG表現・禁止事項<textarea name="ngRules"></textarea></label><label>投稿・運用ルール<textarea name="postingRules"></textarea></label><div class="dialog-actions"><button type="button" id="cancelBrand">キャンセル</button><button class="primary" type="submit">保存</button></div></form></dialog>
      <dialog id="versionDialog"><form method="dialog" id="versionForm"><h2>プロンプト版を保存</h2><label>版名<input name="name" required placeholder="例：v2 冒頭3秒強化"></label><label>変更メモ<textarea name="note" placeholder="今回改善した点"></textarea></label><label>評価<select name="rating"><option value="0">未評価</option><option value="3">★★★</option><option value="4">★★★★</option><option value="5">★★★★★</option></select></label><div class="dialog-actions"><button type="button" id="cancelVersion">キャンセル</button><button class="primary" type="submit">保存</button></div></form></dialog>
    </main>`;

  root.querySelector("#back").onclick = () => goStudio(studio);
  root.querySelector("#stepScript").onclick = () => goProject(project.id);
  root.querySelector("#stepScenes").onclick = () => goScenes(project.id);
  root.querySelector("#stepBgm").onclick = () => goBgm(project.id);
  root.querySelector("#stepOutput").onclick = () => goOutput(project.id);
  attachProjectMenu(project, root.querySelector("#menu"), () => goStudio(studio));

  const brandSelect = root.querySelector("#brandSelect");
  const contentType = root.querySelector("#contentType");
  brandSelect.value = project.promptProfile.brandId;
  contentType.value = project.promptProfile.contentType;

  let active = firstRole;
  const brief = root.querySelector("#aiBrief");
  const promptArea = root.querySelector("#aiPrompt");
  const resultArea = root.querySelector("#aiResult");
  const saveState = root.querySelector("#saveState");
  const promptLength = root.querySelector("#promptLength");

  const saveWorkspace = async () => {
    saveState.textContent = "保存中…";
    project.promptProfile.brandId = brandSelect.value;
    project.promptProfile.contentType = contentType.value;
    project.aiWorkspace[active.id] = {
      brief:brief.value, prompt:promptArea.value, result:resultArea.value,
      brandId:brandSelect.value, contentType:contentType.value,
      updatedAt:new Date().toISOString()
    };
    project.updatedAt = new Date().toISOString();
    await saveProject(project);
    saveState.textContent = "保存済み";
  };
  const updateLength = () => promptLength.textContent = `${promptArea.value.length.toLocaleString("ja-JP")}文字`;

  const renderVersions = () => {
    const versions = promptVersions(project, active.id);
    root.querySelector("#versionCount").textContent = `${versions.length}版`;
    root.querySelector("#versionList").innerHTML = versions.length ? versions.map((item,index)=>`
      <article class="version-card ${item.favorite?"favorite":""}">
        <div><div class="version-title"><b>${escapeHtml(item.name)}</b><span>${item.favorite?"★":"☆"}</span></div>
        <small>${formatDate(item.createdAt)}・使用${item.useCount||0}回・${item.rating?`評価${"★".repeat(item.rating)}`:"未評価"}</small>
        <p>${escapeHtml(item.note || "変更メモなし")}</p>
        <p class="diff">${escapeHtml(promptDiffSummary(index<versions.length-1?versions[index+1].prompt:"",item.prompt))}</p></div>
        <div class="version-actions"><button data-restore="${item.id}">復元</button><button data-favorite="${item.id}">${item.favorite?"お気に入り解除":"お気に入り"}</button><button class="danger" data-version-delete="${item.id}">削除</button></div>
      </article>`).join("") : `<div class="dictionary-empty">この担当の保存版はまだありません。</div>`;
    root.querySelectorAll("[data-restore]").forEach(button=>button.onclick=async()=>{
      const item=project.promptLibrary.find(x=>x.id===button.dataset.restore);
      if(!item)return;
      promptArea.value=item.prompt; brief.value=item.brief||brief.value; item.useCount=(item.useCount||0)+1;
      await saveProject(project); updateLength(); renderVersions();
    });
    root.querySelectorAll("[data-favorite]").forEach(button=>button.onclick=async()=>{
      const item=project.promptLibrary.find(x=>x.id===button.dataset.favorite); if(!item)return;
      item.favorite=!item.favorite; await saveProject(project); renderVersions();
    });
    root.querySelectorAll("[data-version-delete]").forEach(button=>button.onclick=async()=>{
      if(!confirm("このプロンプト版を削除しますか？"))return;
      project.promptLibrary=project.promptLibrary.filter(x=>x.id!==button.dataset.versionDelete);
      await saveProject(project); renderVersions();
    });
  };

  const loadRole = role => {
    active = role;
    root.querySelector("#roleTitle").textContent = `${role.icon} ${role.name}`;
    root.querySelector("#rolePurpose").textContent = role.purpose;
    const saved = project.aiWorkspace[role.id] || {};
    brief.value = saved.brief || "";
    promptArea.value = saved.prompt || "";
    resultArea.value = saved.result || "";
    root.querySelectorAll(".ai-role").forEach(button => button.classList.toggle("active", button.dataset.role === role.id));
    updateLength(); renderVersions();
  };
  root.querySelectorAll(".ai-role").forEach(button => button.onclick = () => loadRole(roles.find(role => role.id === button.dataset.role)));

  brandSelect.onchange = async()=>{project.promptProfile.brandId=brandSelect.value;await saveWorkspace();};
  contentType.onchange = async()=>{project.promptProfile.contentType=contentType.value;await saveWorkspace();};

  root.querySelector("#generatePrompt").onclick = async () => {
    promptArea.value = composePrompt(project, active, brief.value.trim());
    updateLength(); await saveWorkspace();
  };
  root.querySelector("#copyPrompt").onclick = async () => {
    if(!promptArea.value.trim()) promptArea.value=composePrompt(project,active,brief.value.trim());
    const latest = promptVersions(project,active.id)[0];
    if(latest && latest.prompt===promptArea.value){latest.useCount=(latest.useCount||0)+1;}
    updateLength(); await saveWorkspace(); await saveProject(project); renderVersions(); await copyText(promptArea.value);
  };
  root.querySelector("#saveResult").onclick = saveWorkspace;
  root.querySelector("#copyResult").onclick = () => copyText(resultArea.value);
  root.querySelector("#useAsScript").onclick = async () => {
    if (!resultArea.value.trim()) return alert("回答を貼り付けてください。");
    if (!confirm("AIの回答を表示用台本へ反映しますか？現在の台本は置き換わります。")) return;
    project.displayScript = resultArea.value.trim();
    project.speechScript = resultArea.value.trim();
    await saveWorkspace(); await saveProject(project); alert("台本へ反映しました。");
  };
  [brief,promptArea,resultArea].forEach(area => area.addEventListener("change", saveWorkspace));
  promptArea.addEventListener("input",updateLength);

  const brandDialog=root.querySelector("#brandDialog"),brandForm=root.querySelector("#brandForm");
  root.querySelector("#editBrand").onclick=()=>{
    const brand=selectedBrand(project);
    brandForm.elements.brandId.value=brand.id;brandForm.elements.name.value=brand.name;
    brandForm.elements.worldview.value=brand.worldview;brandForm.elements.voice.value=brand.voice;
    brandForm.elements.imageRules.value=brand.imageRules;brandForm.elements.ngRules.value=brand.ngRules;
    brandForm.elements.postingRules.value=brand.postingRules;brandDialog.showModal();
  };
  root.querySelector("#cancelBrand").onclick=()=>brandDialog.close();
  brandForm.onsubmit=async event=>{
    event.preventDefault();
    const data=new FormData(brandForm),all=loadBrands(),idx=all.findIndex(x=>x.id===String(data.get("brandId")));
    if(idx<0)return;
    Object.assign(all[idx],{
      name:String(data.get("name")).trim(),worldview:String(data.get("worldview")).trim(),
      voice:String(data.get("voice")).trim(),imageRules:String(data.get("imageRules")).trim(),
      ngRules:String(data.get("ngRules")).trim(),postingRules:String(data.get("postingRules")).trim()
    });
    saveBrands(all);brandDialog.close();alert("ブランドルールを保存しました。再度プロンプトを合成すると反映されます。");
  };

  const versionDialog=root.querySelector("#versionDialog"),versionForm=root.querySelector("#versionForm");
  root.querySelector("#saveVersion").onclick=()=>{
    if(!promptArea.value.trim())return alert("先に完成プロンプトを作成してください。");
    versionForm.reset();versionDialog.showModal();
  };
  root.querySelector("#cancelVersion").onclick=()=>versionDialog.close();
  versionForm.onsubmit=async event=>{
    event.preventDefault();const data=new FormData(versionForm);
    project.promptLibrary.push({
      id:crypto.randomUUID?.()||`prompt-${Date.now()}`,roleId:active.id,
      name:String(data.get("name")).trim(),note:String(data.get("note")).trim(),
      rating:Number(data.get("rating"))||0,favorite:false,useCount:0,
      prompt:promptArea.value,brief:brief.value,brandId:brandSelect.value,
      contentType:contentType.value,createdAt:new Date().toISOString()
    });
    await saveProject(project);versionDialog.close();renderVersions();
  };

  loadRole(firstRole);
}

function labelPlatform(value){return({"youtube-shorts":"YouTube Shorts","instagram-reels":"Instagram Reels","tiktok":"TikTok"})[value]||value;}
function labelGenre(value){return({"great-person":"偉人・教養","education":"知育・教育","fortune":"開運・占い","bgm":"BGM","other":"その他"})[value]||value;}
function safeName(value){return value.replace(/[\\/:*?"<>|]/g,"_")||"creator-os-project";}

async function render(){
  try{
    const route=readRoute();
    if(route.page==="ai") await renderAi(route.id);
    else if(route.page==="project") await renderProject(route.id);
    else if(route.page==="scenes") await renderScenes(route.id);
    else if(route.page==="bgm") await renderBgm(route.id);
    else if(route.page==="output") await renderOutput(route.id);
    else if(route.page==="publish") await renderPublish(route.id);
    else if(route.page==="studio") await renderStudio(route.studio);
    else await renderHome();
  }catch(error){
    console.error(error);
    root.innerHTML=`<main class="shell"><div class="error"><h1>読み込みに失敗しました</h1><p>${escapeHtml(error instanceof Error?error.message:"不明なエラー")}</p><button onclick="location.reload()">再読み込み</button></div></main>`;
  }
}
window.addEventListener("hashchange",render);
void render();
