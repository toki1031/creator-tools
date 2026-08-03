import { readRoute, goHome, goStudio, goProject, goScenes } from "./router.js";
import { createProject } from "./projectFactory.js";
import { deleteProject, getProject, listProjects, saveProject } from "./db.js";
import { downloadJson } from "./download.js";

const rootElement = document.querySelector("#app");
if (!rootElement) throw new Error("#app がありません。");
const root = rootElement;
const DICT_KEY = "creator-os-pronunciation-v1";

const escapeHtml = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c] ?? c));
const formatDate = (iso) => new Intl.DateTimeFormat("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
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
function applyDictionary(text, entries = loadDictionary()) {
  return [...entries].sort((a,b) => b.from.length - a.from.length).reduce((result, item) => result.split(item.from).join(item.to), text);
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
      <section class="hero"><span class="eyebrow">STUDIO HUB</span><h2>今日は、どの事業を進めますか？</h2><p>共通機能は共有しながら、チャンネルごとに必要な作業と制作手順を分けて管理します。</p></section>
      <section class="studio-grid">
        ${Object.entries(STUDIO).map(([key,s]) => `<button class="studio-card ${s.status==="準備中"?"muted":""}" data-studio="${key}"><span class="studio-icon">${s.icon}</span><div><h3>${s.title}</h3><p>${s.desc}</p></div><small>${s.status}</small></button>`).join("")}
      </section>
      <section class="section-head recent-head"><div><h2>最近のプロジェクト</h2><p>${projects.length}件をこの端末に保存中</p></div></section>
      <section class="project-grid">
        ${projects.length ? projects.slice(0,6).map(p => `<article class="project-card" data-id="${p.id}"><span>${labelPlatform(p.platform)}</span><h3>${escapeHtml(p.title)}</h3><p>${labelGenre(p.genre)}・目標${p.targetDurationSec}秒</p><small>更新 ${formatDate(p.updatedAt)}</small></article>`).join("") : `<div class="empty"><div>🎬</div><h3>まだプロジェクトがありません</h3><p>上のStudioから最初の制作を始めましょう。</p></div>`}
      </section>
    </main>`;
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
      <section class="studio-hero"><h2>${isBgm ? "長時間BGM動画を、迷わず組み立てる" : "企画から完成動画までを一つの制作線に"}</h2><p>${studio.desc}</p><button class="primary" id="openCreate">＋ 新しいプロジェクト</button></section>
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
      <dialog id="createDialog"><form method="dialog" id="createForm"><h2>新規プロジェクト</h2><label>タイトル<input name="title" required placeholder="${isBgm?"例：雨上がりの窓辺｜読書用BGM":"例：本田宗一郎｜学び直し"}"></label><label>投稿先<select name="platform">${isBgm?`<option value="youtube-shorts">YouTube（設定は後で長時間へ拡張）</option>`:`<option value="youtube-shorts">YouTube Shorts</option><option value="instagram-reels">Instagram Reels</option><option value="tiktok">TikTok</option>`}</select></label><div class="dialog-actions"><button value="cancel">キャンセル</button><button class="primary" value="default">作成する</button></div></form></dialog>
    </main>`;
  root.querySelector("#back").onclick = goHome;
  root.querySelectorAll(".project-card").forEach(card => card.onclick = () => goProject(card.dataset.id));
  const dialog = root.querySelector("#createDialog");
  root.querySelector("#openCreate").onclick = () => dialog.showModal();
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
  root.innerHTML = `
    <main class="shell editor-shell">
      <header class="editor-head"><button id="back">←</button><div><span>${labelPlatform(project.platform)}</span><h1>${escapeHtml(project.title)}</h1></div><button id="menu">•••</button></header>
      <nav class="steps"><button class="active">1 台本・音声</button><button id="stepScenes">2 シーン</button><button disabled>3 BGM</button><button disabled>4 出力</button></nav>
      <section class="editor-card"><div class="section-head"><div><h2>表示用の台本</h2><p>字幕や画面に表示する文章です。</p></div><span id="displayCount">${project.displayScript.length}文字</span></div><textarea id="displayScript" placeholder="台本を貼り付けてください。">${escapeHtml(project.displayScript)}</textarea></section>
      <section class="editor-card"><div class="section-head"><div><h2>音声用の台本</h2><p>読み方辞書と語り口調整を反映する専用原稿です。</p></div><button id="copyDisplay">表示用からコピー</button></div><textarea id="speechScript" placeholder="音声用原稿">${escapeHtml(project.speechScript)}</textarea><div class="tool-row"><select id="narrationStyle"><option value="standard">標準</option><option value="shorts">Shorts・テンポ重視</option><option value="documentary">ドキュメンタリー</option><option value="gentle">やさしい語り</option></select><button id="naturalize">自然な語り口に整える</button><button id="applyDictionary">辞書を反映</button></div></section>
      <section class="editor-card"><div class="section-head"><div><h2>読み方辞書</h2><p>字幕は漢字のまま、音声原稿だけ読みを置き換えます。</p></div><button id="addDictionary">＋ 追加</button></div><div id="dictionaryList" class="dictionary-list"></div></section>
      <section class="editor-card"><div class="section-head"><div><h2>試聴</h2><p>選択範囲があればその部分だけ、なければ全文を読み上げます。</p></div><span id="voiceStatus">待機中</span></div><label>音声<select id="voiceSelect"><option>音声を読み込み中…</option></select></label><div class="voice-controls"><label>速度<div class="range-line"><input id="rate" type="range" min="0.6" max="1.5" value="${project.narration?.rate ?? .92}" step="0.01"><span id="rateValue">${Number(project.narration?.rate ?? .92).toFixed(2)}</span></div></label><label>高さ<div class="range-line"><input id="pitch" type="range" min="0.7" max="1.3" value="${project.narration?.pitch ?? .95}" step="0.01"><span id="pitchValue">${Number(project.narration?.pitch ?? .95).toFixed(2)}</span></div></label></div><div class="tool-row"><button class="primary" id="preview">▶ 部分試聴</button><button id="pause">⏸ 一時停止</button><button class="danger" id="stop">■ 停止</button></div></section>
      <section class="editor-card compact"><label>目標尺<input id="duration" type="number" min="5" max="28800" value="${project.targetDurationSec}"><span>秒</span></label><p id="saveState">保存済み</p></section>
      <section class="actions"><button id="exportJson">JSONを書き出す</button><button class="danger" id="delete">削除</button><button class="primary" id="nextScenes">次へ：シーン編集</button></section>
      <dialog id="dictDialog"><form method="dialog" id="dictForm"><h2>読み方を登録</h2><input type="hidden" name="index"><label>表示語<input name="from" required placeholder="例：本田宗一郎"></label><label>読み<input name="to" required placeholder="例：ほんだ そういちろう"></label><div class="dialog-actions"><button value="cancel">キャンセル</button><button class="primary" value="default">保存</button></div></form></dialog>
    </main>`;

  root.querySelector("#back").onclick = () => goStudio(studioForGenre(project.genre));
  root.querySelector("#stepScenes").onclick = () => goScenes(project.id);
  root.querySelector("#nextScenes").onclick = () => goScenes(project.id);
  const display = root.querySelector("#displayScript");
  const speech = root.querySelector("#speechScript");
  const duration = root.querySelector("#duration");
  const saveState = root.querySelector("#saveState");
  let timer;
  const scheduleSave = () => {
    saveState.textContent = "保存中…";
    clearTimeout(timer);
    timer = setTimeout(async () => {
      const updated = { ...project, displayScript: display.value, speechScript: speech.value, targetDurationSec: Math.max(5, Number(duration.value) || 60), narration:{...(project.narration||{}),rate:Number(root.querySelector("#rate").value),pitch:Number(root.querySelector("#pitch").value)}, updatedAt:new Date().toISOString() };
      await saveProject(updated); Object.assign(project, updated); saveState.textContent = "保存済み";
    }, 500);
  };
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
  root.querySelector("#preview").onclick=()=>{const selected=speech.value.slice(speech.selectionStart,speech.selectionEnd).trim(),text=applyDictionary(selected||speech.value||display.value).trim();if(!text)return alert("試聴する文章を入力してください。");synth.cancel();const u=new SpeechSynthesisUtterance(text),select=root.querySelector("#voiceSelect"),list=select._voices||[];u.voice=list[Number(select.value)]||null;u.lang=u.voice?.lang||"ja-JP";u.rate=Number(root.querySelector("#rate").value);u.pitch=Number(root.querySelector("#pitch").value);u.onstart=()=>setStatus("読み上げ中");u.onend=()=>setStatus("完了");u.onerror=()=>setStatus("エラー");synth.speak(u);};
  root.querySelector("#pause").onclick=()=>{if(synth.paused){synth.resume();setStatus("読み上げ中");}else{synth.pause();setStatus("一時停止中");}};
  root.querySelector("#stop").onclick=()=>{synth.cancel();setStatus("停止しました");};
  root.querySelector("#exportJson").onclick=()=>downloadJson(`${safeName(project.title)}.json`,{...project,pronunciationDictionary:loadDictionary()});
  root.querySelector("#delete").onclick=async()=>{if(confirm("このプロジェクトを削除しますか？")){await deleteProject(project.id);goStudio(studioForGenre(project.genre));}};
}

function splitIntoScenes(text, targetDuration=60) {
  const blocks = text.trim().split(/\n{2,}|(?<=[。！？])\s*/).map(x=>x.trim()).filter(Boolean);
  if (!blocks.length) return [];
  const per = Math.max(2, Math.round(targetDuration / blocks.length));
  return blocks.map((text,index)=>({id:crypto.randomUUID?.()||`scene-${Date.now()}-${index}`,order:index+1,text,speechText:text,durationSec:per,imageData:"",motion:"zoom-in",transition:"fade"}));
}

async function fileToDataUrl(file) {
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(file);});
}

async function renderScenes(id) {
  const project=await getProject(id);
  if(!project){goHome();return;}
  if(!Array.isArray(project.scenes)) project.scenes=[];
  root.innerHTML=`
    <main class="shell editor-shell">
      <header class="editor-head"><button id="back">←</button><div><span>${labelPlatform(project.platform)}</span><h1>${escapeHtml(project.title)}</h1></div><button id="menu">•••</button></header>
      <nav class="steps"><button id="stepScript">1 台本・音声</button><button class="active">2 シーン</button><button disabled>3 BGM</button><button disabled>4 出力</button></nav>
      <section class="editor-card"><div class="section-head"><div><h2>シーン編集</h2><p>台本を場面に分け、画像・表示秒数・演出を設定します。</p></div><span id="sceneCount">${project.scenes.length}シーン</span></div><div class="tool-row"><button class="primary" id="autoSplit">台本から自動分割</button><button id="addScene">＋ 空のシーン</button></div></section>
      <section id="sceneList" class="scene-list"></section>
      <section class="editor-card compact"><div><b>合計時間</b><p id="totalDuration">0秒</p></div><p id="saveState">保存済み</p></section>
      <section class="actions"><button id="backScript">← 台本へ</button><button id="exportJson">JSONを書き出す</button><button class="primary" disabled>次へ：BGM・字幕</button></section>
    </main>`;
  root.querySelector("#back").onclick=()=>goStudio(studioForGenre(project.genre));
  root.querySelector("#stepScript").onclick=()=>goProject(project.id);
  root.querySelector("#backScript").onclick=()=>goProject(project.id);
  const saveState=root.querySelector("#saveState"); let timer;
  const save=()=>{saveState.textContent="保存中…";clearTimeout(timer);timer=setTimeout(async()=>{project.scenes.forEach((s,i)=>s.order=i+1);project.updatedAt=new Date().toISOString();await saveProject(project);saveState.textContent="保存済み";},400);};
  const total=()=>project.scenes.reduce((sum,s)=>sum+(Number(s.durationSec)||0),0);
  const renderList=()=>{
    root.querySelector("#sceneCount").textContent=`${project.scenes.length}シーン`;
    root.querySelector("#totalDuration").textContent=`${total()}秒`;
    root.querySelector("#sceneList").innerHTML=project.scenes.length?project.scenes.map((s,i)=>`
      <article class="scene-card" data-index="${i}">
        <div class="scene-preview">${s.imageData?`<img src="${s.imageData}" alt="">`:`<span>画像未登録</span>`}</div>
        <div class="scene-body"><div class="scene-title"><b>シーン ${i+1}</b><div><button data-up="${i}" ${i===0?"disabled":""}>↑</button><button data-down="${i}" ${i===project.scenes.length-1?"disabled":""}>↓</button><button class="danger" data-remove="${i}">削除</button></div></div>
        <textarea data-text="${i}" placeholder="このシーンの字幕・内容">${escapeHtml(s.text||"")}</textarea>
        <div class="scene-settings"><label>画像<input data-image="${i}" type="file" accept="image/*"></label><label>秒数<input data-duration="${i}" type="number" min="1" max="3600" value="${Number(s.durationSec)||5}"></label><label>動き<select data-motion="${i}"><option value="none" ${s.motion==="none"?"selected":""}>なし</option><option value="zoom-in" ${s.motion==="zoom-in"?"selected":""}>ズームイン</option><option value="zoom-out" ${s.motion==="zoom-out"?"selected":""}>ズームアウト</option><option value="pan-left" ${s.motion==="pan-left"?"selected":""}>左へパン</option><option value="pan-right" ${s.motion==="pan-right"?"selected":""}>右へパン</option></select></label></div></div>
      </article>`).join(""):`<div class="empty"><div>🖼️</div><h3>シーンがありません</h3><p>「台本から自動分割」または「空のシーン」を押してください。</p></div>`;
    root.querySelectorAll("[data-text]").forEach(el=>el.oninput=()=>{project.scenes[Number(el.dataset.text)].text=el.value;save();});
    root.querySelectorAll("[data-duration]").forEach(el=>el.oninput=()=>{project.scenes[Number(el.dataset.duration)].durationSec=Math.max(1,Number(el.value)||1);root.querySelector("#totalDuration").textContent=`${total()}秒`;save();});
    root.querySelectorAll("[data-motion]").forEach(el=>el.onchange=()=>{project.scenes[Number(el.dataset.motion)].motion=el.value;save();});
    root.querySelectorAll("[data-image]").forEach(el=>el.onchange=async()=>{const file=el.files?.[0];if(!file)return;if(file.size>3_000_000&&!confirm("画像が大きいため保存容量を圧迫する可能性があります。続けますか？"))return;project.scenes[Number(el.dataset.image)].imageData=await fileToDataUrl(file);save();renderList();});
    root.querySelectorAll("[data-remove]").forEach(el=>el.onclick=()=>{project.scenes.splice(Number(el.dataset.remove),1);save();renderList();});
    root.querySelectorAll("[data-up]").forEach(el=>el.onclick=()=>{const i=Number(el.dataset.up);[project.scenes[i-1],project.scenes[i]]=[project.scenes[i],project.scenes[i-1]];save();renderList();});
    root.querySelectorAll("[data-down]").forEach(el=>el.onclick=()=>{const i=Number(el.dataset.down);[project.scenes[i+1],project.scenes[i]]=[project.scenes[i],project.scenes[i+1]];save();renderList();});
  };
  root.querySelector("#autoSplit").onclick=()=>{if(project.scenes.length&&!confirm("現在のシーンを削除して、台本から作り直しますか？"))return;project.scenes=splitIntoScenes(project.displayScript||project.speechScript,project.targetDurationSec);save();renderList();};
  root.querySelector("#addScene").onclick=()=>{project.scenes.push({id:crypto.randomUUID?.()||`scene-${Date.now()}`,order:project.scenes.length+1,text:"",speechText:"",durationSec:5,imageData:"",motion:"zoom-in",transition:"fade"});save();renderList();};
  root.querySelector("#exportJson").onclick=()=>downloadJson(`${safeName(project.title)}.json`,project);
  renderList();
}

function labelPlatform(value){return({"youtube-shorts":"YouTube Shorts","instagram-reels":"Instagram Reels","tiktok":"TikTok"})[value]||value;}
function labelGenre(value){return({"great-person":"偉人・教養","education":"知育・教育","fortune":"開運・占い","bgm":"BGM","other":"その他"})[value]||value;}
function safeName(value){return value.replace(/[\\/:*?"<>|]/g,"_")||"creator-os-project";}

async function render(){
  try{
    const route=readRoute();
    if(route.page==="project") await renderProject(route.id);
    else if(route.page==="scenes") await renderScenes(route.id);
    else if(route.page==="studio") await renderStudio(route.studio);
    else await renderHome();
  }catch(error){
    console.error(error);
    root.innerHTML=`<main class="shell"><div class="error"><h1>読み込みに失敗しました</h1><p>${escapeHtml(error instanceof Error?error.message:"不明なエラー")}</p><button onclick="location.reload()">再読み込み</button></div></main>`;
  }
}
window.addEventListener("hashchange",render);
void render();
