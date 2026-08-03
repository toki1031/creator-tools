import { readRoute, goHome, goProject } from "./router.js";
import { createProject } from "./projectFactory.js";
import { deleteProject, getProject, listProjects, saveProject } from "./db.js";
import { downloadJson } from "./download.js";

const rootElement = document.querySelector("#app");
if (!rootElement) throw new Error("#app がありません。");
const root = rootElement;
const DICT_KEY = "creator-os-pronunciation-v1";

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c] ?? c));
const formatDate = (iso) => new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

function loadDictionary() {
  try {
    const value = JSON.parse(localStorage.getItem(DICT_KEY) || "[]");
    return Array.isArray(value) ? value.filter(x => x && x.from && x.to) : [];
  } catch { return []; }
}
function saveDictionary(entries) { localStorage.setItem(DICT_KEY, JSON.stringify(entries)); }
function applyDictionary(text, entries = loadDictionary()) {
  return [...entries].sort((a,b) => b.from.length - a.from.length).reduce((result, item) => result.split(item.from).join(item.to), text);
}
function naturalize(text, style) {
  let result = text.trim().replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
  if (style === "shorts") {
    result = result.replace(/([。！？])/g, "$1\n").replace(/、/g, "、\n").replace(/\n{2,}/g, "\n");
  } else if (style === "documentary") {
    result = result.replace(/([。！？])/g, "$1\n\n").replace(/(しかし|ところが|実は|そして)/g, "\n$1、").replace(/\n{3,}/g, "\n\n");
  } else if (style === "gentle") {
    result = result.replace(/([。！？])/g, "$1\n").replace(/、/g, "、 ").replace(/\n{2,}/g, "\n");
  } else {
    result = result.replace(/([。！？])/g, "$1\n").replace(/\n{2,}/g, "\n");
  }
  return result.trim();
}

async function renderHome() {
  const projects = await listProjects();
  root.innerHTML = `
    <main class="shell">
      <header class="brand"><div class="logo">✦</div><div><h1>Creator OS</h1><p>動画完成から逆算する、制作ワークスペース</p></div></header>
      <section class="hero"><span class="eyebrow">SPRINT 1</span><h2>台本から、自然なナレーションへ</h2><p>読み方辞書・語り口調整・部分試聴を使って、聞きやすい音声原稿を作れます。</p><button class="primary" id="openCreate">＋ 新しいプロジェクト</button></section>
      <section class="section-head"><div><h2>プロジェクト</h2><p>${projects.length}件をこの端末に保存中</p></div></section>
      <section class="project-grid">
        ${projects.length ? projects.map(p => `<article class="project-card" data-id="${p.id}"><span>${labelPlatform(p.platform)}</span><h3>${escapeHtml(p.title)}</h3><p>${labelGenre(p.genre)}・目標${p.targetDurationSec}秒</p><small>更新 ${formatDate(p.updatedAt)}</small></article>`).join("") : `<div class="empty"><div>🎬</div><h3>まだプロジェクトがありません</h3><p>最初のShorts制作を始めましょう。</p></div>`}
      </section>
      <dialog id="createDialog"><form method="dialog" id="createForm"><h2>新規プロジェクト</h2><label>タイトル<input name="title" required placeholder="例：本田宗一郎｜学び直し"></label><label>ジャンル<select name="genre"><option value="great-person">偉人・教養</option><option value="education">知育・教育</option><option value="fortune">開運・占い</option><option value="bgm">BGM</option><option value="other">その他</option></select></label><label>投稿先<select name="platform"><option value="youtube-shorts">YouTube Shorts</option><option value="instagram-reels">Instagram Reels</option><option value="tiktok">TikTok</option></select></label><div class="dialog-actions"><button value="cancel">キャンセル</button><button class="primary" value="default">作成する</button></div></form></dialog>
    </main>`;
  root.querySelectorAll(".project-card").forEach(card => card.onclick = () => card.dataset.id && goProject(card.dataset.id));
  const dialog = root.querySelector("#createDialog");
  root.querySelector("#openCreate").onclick = () => dialog.showModal();
  root.querySelector("#createForm").onsubmit = async event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const project = createProject(String(data.get("title")), String(data.get("genre")), String(data.get("platform")));
    await saveProject(project);
    dialog.close();
    goProject(project.id);
  };
}

async function renderProject(id) {
  const project = await getProject(id);
  if (!project) { goHome(); return; }
  root.innerHTML = `
    <main class="shell editor-shell">
      <header class="editor-head"><button id="back">←</button><div><span>${labelPlatform(project.platform)}</span><h1>${escapeHtml(project.title)}</h1></div><button id="menu">•••</button></header>
      <nav class="steps"><button class="active">1 台本・音声</button><button disabled>2 シーン</button><button disabled>3 BGM</button><button disabled>4 出力</button></nav>
      <section class="editor-card"><div class="section-head"><div><h2>表示用の台本</h2><p>字幕や画面に表示する文章です。</p></div><span id="displayCount">${project.displayScript.length}文字</span></div><textarea id="displayScript" placeholder="台本を貼り付けてください。">${escapeHtml(project.displayScript)}</textarea></section>
      <section class="editor-card"><div class="section-head"><div><h2>音声用の台本</h2><p>読み方辞書と語り口調整を反映する専用原稿です。</p></div><button id="copyDisplay">表示用からコピー</button></div><textarea id="speechScript" placeholder="音声用原稿">${escapeHtml(project.speechScript)}</textarea><div class="tool-row"><select id="narrationStyle"><option value="standard">標準</option><option value="shorts">Shorts・テンポ重視</option><option value="documentary">ドキュメンタリー</option><option value="gentle">やさしい語り</option></select><button id="naturalize">自然な語り口に整える</button><button id="applyDictionary">辞書を反映</button></div></section>
      <section class="editor-card"><div class="section-head"><div><h2>読み方辞書</h2><p>字幕は漢字のまま、音声原稿だけ読みを置き換えます。</p></div><button id="addDictionary">＋ 追加</button></div><div id="dictionaryList" class="dictionary-list"></div></section>
      <section class="editor-card"><div class="section-head"><div><h2>試聴</h2><p>選択範囲があればその部分だけ、なければ全文を読み上げます。</p></div><span id="voiceStatus">待機中</span></div><label>音声<select id="voiceSelect"><option>音声を読み込み中…</option></select></label><div class="voice-controls"><label>速度<div class="range-line"><input id="rate" type="range" min="0.6" max="1.5" value="0.92" step="0.01"><span id="rateValue">0.92</span></div></label><label>高さ<div class="range-line"><input id="pitch" type="range" min="0.7" max="1.3" value="0.95" step="0.01"><span id="pitchValue">0.95</span></div></label></div><div class="tool-row"><button class="primary" id="preview">▶ 部分試聴</button><button id="pause">⏸ 一時停止</button><button class="danger" id="stop">■ 停止</button></div></section>
      <section class="editor-card compact"><label>目標尺<input id="duration" type="number" min="5" max="60" value="${project.targetDurationSec}"><span>秒</span></label><p id="saveState">保存済み</p></section>
      <section class="actions"><button id="exportJson">JSONを書き出す</button><button class="danger" id="delete">削除</button><button class="primary" disabled>次へ：シーン編集</button></section>
      <dialog id="dictDialog"><form method="dialog" id="dictForm"><h2>読み方を登録</h2><input type="hidden" name="index"><label>表示語<input name="from" required placeholder="例：本田宗一郎"></label><label>読み<input name="to" required placeholder="例：ほんだ そういちろう"></label><div class="dialog-actions"><button value="cancel">キャンセル</button><button class="primary" value="default">保存</button></div></form></dialog>
    </main>`;

  root.querySelector("#back").onclick = goHome;
  const display = root.querySelector("#displayScript");
  const speech = root.querySelector("#speechScript");
  const duration = root.querySelector("#duration");
  const saveState = root.querySelector("#saveState");
  let timer;
  const scheduleSave = () => {
    saveState.textContent = "保存中…";
    window.clearTimeout(timer);
    timer = window.setTimeout(async () => {
      const updated = { ...project, displayScript: display.value, speechScript: speech.value, targetDurationSec: Math.max(5, Math.min(60, Number(duration.value) || 60)), updatedAt: new Date().toISOString() };
      await saveProject(updated); Object.assign(project, updated); saveState.textContent = "保存済み";
    }, 600);
  };
  display.oninput = () => { root.querySelector("#displayCount").textContent = `${display.value.length}文字`; scheduleSave(); };
  speech.oninput = scheduleSave; duration.oninput = scheduleSave;
  root.querySelector("#copyDisplay").onclick = () => { speech.value = display.value; scheduleSave(); };
  root.querySelector("#naturalize").onclick = () => { speech.value = naturalize(speech.value || display.value, root.querySelector("#narrationStyle").value); scheduleSave(); };
  root.querySelector("#applyDictionary").onclick = () => { speech.value = applyDictionary(speech.value || display.value); scheduleSave(); };

  const dialog = root.querySelector("#dictDialog");
  const dictForm = root.querySelector("#dictForm");
  const renderDictionary = () => {
    const entries = loadDictionary();
    root.querySelector("#dictionaryList").innerHTML = entries.length ? entries.map((item,index) => `<div class="dictionary-item"><div><strong>${escapeHtml(item.from)}</strong><span>→ ${escapeHtml(item.to)}</span></div><div><button data-edit="${index}">編集</button><button class="danger" data-remove="${index}">削除</button></div></div>`).join("") : `<div class="dictionary-empty">まだ登録がありません。</div>`;
    root.querySelectorAll("[data-edit]").forEach(button => button.onclick = () => { const item = entries[Number(button.dataset.edit)]; dictForm.elements.index.value = button.dataset.edit; dictForm.elements.from.value = item.from; dictForm.elements.to.value = item.to; dialog.showModal(); });
    root.querySelectorAll("[data-remove]").forEach(button => button.onclick = () => { entries.splice(Number(button.dataset.remove),1); saveDictionary(entries); renderDictionary(); });
  };
  root.querySelector("#addDictionary").onclick = () => { dictForm.reset(); dictForm.elements.index.value = ""; dialog.showModal(); };
  dictForm.onsubmit = event => { event.preventDefault(); const data = new FormData(dictForm); const entries = loadDictionary(); const item = { from: String(data.get("from")).trim(), to: String(data.get("to")).trim() }; const index = String(data.get("index")); if (!item.from || !item.to) return; if (index === "") entries.push(item); else entries[Number(index)] = item; saveDictionary(entries); dialog.close(); renderDictionary(); };
  renderDictionary();

  const synth = window.speechSynthesis;
  let voices = [];
  let currentUtterance = null;
  const loadVoices = () => {
    voices = synth?.getVoices?.() || [];
    const japanese = voices.filter(v => v.lang.toLowerCase().startsWith("ja"));
    const use = japanese.length ? japanese : voices;
    const select = root.querySelector("#voiceSelect");
    select.innerHTML = use.length ? use.map((voice,index) => `<option value="${index}">${escapeHtml(voice.name)}（${escapeHtml(voice.lang)}）</option>`).join("") : `<option>利用できる音声がありません</option>`;
    select._voices = use;
  };
  loadVoices(); if (synth) synth.onvoiceschanged = loadVoices;
  ["rate","pitch"].forEach(id => { const el = root.querySelector(`#${id}`); const out = root.querySelector(`#${id}Value`); el.oninput = () => out.textContent = Number(el.value).toFixed(2); });
  const setStatus = text => root.querySelector("#voiceStatus").textContent = text;
  root.querySelector("#preview").onclick = () => {
    const selected = speech.value.slice(speech.selectionStart, speech.selectionEnd).trim();
    const text = applyDictionary(selected || speech.value || display.value).trim();
    if (!text) return alert("試聴する文章を入力してください。");
    synth.cancel(); currentUtterance = new SpeechSynthesisUtterance(text);
    const select = root.querySelector("#voiceSelect"); const list = select._voices || [];
    currentUtterance.voice = list[Number(select.value)] || null;
    currentUtterance.lang = currentUtterance.voice?.lang || "ja-JP";
    currentUtterance.rate = Number(root.querySelector("#rate").value);
    currentUtterance.pitch = Number(root.querySelector("#pitch").value);
    currentUtterance.onstart = () => setStatus("読み上げ中"); currentUtterance.onend = () => setStatus("完了"); currentUtterance.onerror = () => setStatus("エラー"); synth.speak(currentUtterance);
  };
  root.querySelector("#pause").onclick = () => { if (synth.paused) { synth.resume(); setStatus("読み上げ中"); } else { synth.pause(); setStatus("一時停止中"); } };
  root.querySelector("#stop").onclick = () => { synth.cancel(); setStatus("停止しました"); };

  root.querySelector("#exportJson").onclick = () => downloadJson(`${safeName(project.title)}.json`, { ...project, pronunciationDictionary: loadDictionary() });
  root.querySelector("#delete").onclick = async () => { if (confirm("このプロジェクトを削除しますか？")) { await deleteProject(project.id); goHome(); } };
}

function labelPlatform(value) { return ({"youtube-shorts":"YouTube Shorts","instagram-reels":"Instagram Reels","tiktok":"TikTok"})[value] || value; }
function labelGenre(value) { return ({"great-person":"偉人・教養","education":"知育・教育","fortune":"開運・占い","bgm":"BGM","other":"その他"})[value] || value; }
function safeName(value) { return value.replace(/[\\/:*?"<>|]/g, "_") || "creator-os-project"; }

async function render() {
  try { const route = readRoute(); route.page === "project" ? await renderProject(route.id) : await renderHome(); }
  catch (error) { console.error(error); root.innerHTML = `<main class="shell"><div class="error"><h1>読み込みに失敗しました</h1><p>${escapeHtml(error instanceof Error ? error.message : "不明なエラー")}</p><button onclick="location.reload()">再読み込み</button></div></main>`; }
}
window.addEventListener("hashchange", render);
void render();
