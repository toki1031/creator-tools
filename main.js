import { readRoute, goHome, goProject } from "./router.js";
import { createProject } from "./projectFactory.js";
import { deleteProject, getProject, listProjects, saveProject } from "./db.js";
import { downloadJson } from "./download.js";

const rootElement = document.querySelector("#app");
if (!rootElement) throw new Error("#app がありません。");
const root = rootElement;

const escapeHtml = (value) => value.replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c] ?? c));
const formatDate = (iso) => new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

async function renderHome() {
  const projects = await listProjects();
  root.innerHTML = `
    <main class="shell">
      <header class="brand"><div class="logo">✦</div><div><h1>Creator OS</h1><p>動画完成から逆算する、制作ワークスペース</p></div></header>
      <section class="hero"><span class="eyebrow">SPRINT 0</span><h2>今日は何を作りますか？</h2><p>まずプロジェクトを作り、台本・音声・画像・字幕・BGMを一つにまとめます。</p><button class="primary" id="openCreate">＋ 新しいプロジェクト</button></section>
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
      <nav class="steps"><button class="active">1 台本</button><button disabled>2 音声</button><button disabled>3 シーン</button><button disabled>4 BGM</button><button disabled>5 出力</button></nav>
      <section class="editor-card"><div class="section-head"><div><h2>表示用の台本</h2><p>字幕や画面に表示する文章です。</p></div><span id="displayCount">${project.displayScript.length}文字</span></div><textarea id="displayScript" placeholder="台本を貼り付けてください。">${escapeHtml(project.displayScript)}</textarea></section>
      <section class="editor-card"><div class="section-head"><div><h2>音声用の台本</h2><p>読み方辞書や間を反映する専用原稿です。</p></div><button id="copyDisplay">表示用からコピー</button></div><textarea id="speechScript" placeholder="音声用原稿">${escapeHtml(project.speechScript)}</textarea></section>
      <section class="editor-card compact"><label>目標尺<input id="duration" type="number" min="5" max="60" value="${project.targetDurationSec}"><span>秒</span></label><p id="saveState">保存済み</p></section>
      <section class="actions"><button id="exportJson">JSONを書き出す</button><button class="danger" id="delete">削除</button><button class="primary" disabled>次へ：音声設定</button></section>
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
      await saveProject(updated);
      Object.assign(project, updated);
      saveState.textContent = "保存済み";
    }, 600);
  };
  display.oninput = () => { root.querySelector("#displayCount").textContent = `${display.value.length}文字`; scheduleSave(); };
  speech.oninput = scheduleSave;
  duration.oninput = scheduleSave;
  root.querySelector("#copyDisplay").onclick = () => { speech.value = display.value; scheduleSave(); };
  root.querySelector("#exportJson").onclick = () => downloadJson(`${safeName(project.title)}.json`, project);
  root.querySelector("#delete").onclick = async () => { if (confirm("このプロジェクトを削除しますか？")) { await deleteProject(project.id); goHome(); } };
}

function labelPlatform(value) { return ({"youtube-shorts":"YouTube Shorts","instagram-reels":"Instagram Reels","tiktok":"TikTok"})[value]; }
function labelGenre(value) { return ({"great-person":"偉人・教養","education":"知育・教育","fortune":"開運・占い","bgm":"BGM","other":"その他"})[value]; }
function safeName(value) { return value.replace(/[\\/:*?"<>|]/g, "_") || "creator-os-project"; }

async function render() {
  try {
    const route = readRoute();
    route.page === "project" ? await renderProject(route.id) : await renderHome();
  } catch (error) {
    console.error(error);
    root.innerHTML = `<main class="shell"><div class="error"><h1>読み込みに失敗しました</h1><p>${escapeHtml(error instanceof Error ? error.message : "不明なエラー")}</p><button onclick="location.reload()">再読み込み</button></div></main>`;
  }
}
window.addEventListener("hashchange", render);
void render();
