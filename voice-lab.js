import { getProject, saveProject } from './db.js';

const $ = s => document.querySelector(s);
const params = new URLSearchParams(location.search);
const projectId = params.get('project') || '';
let project = null;
let piper = null;
let result = null;
let resultUrl = '';

const status = (el, text, kind='') => { el.textContent = text; el.className = `voice-status ${kind}`.trim(); };
const blobToDataUrl = blob => new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=()=>reject(r.error);r.readAsDataURL(blob);});

const JA_DICT_DB = 'creator-os-voice-assets';
const JA_DICT_STORE = 'assets';
const JA_DICT_KEY = 'open_jtalk_dic_utf_8-1.11.tar.gz';
const JA_DICT_MIN_BYTES = 5 * 1024 * 1024;

function openVoiceAssetDb(){
  return new Promise((resolve,reject)=>{
    const req = indexedDB.open(JA_DICT_DB, 1);
    req.onupgradeneeded = () => {
      const db=req.result;
      if(!db.objectStoreNames.contains(JA_DICT_STORE)) db.createObjectStore(JA_DICT_STORE);
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error);
  });
}
async function getStoredJaDict(){
  const db=await openVoiceAssetDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(JA_DICT_STORE,'readonly');
    const req=tx.objectStore(JA_DICT_STORE).get(JA_DICT_KEY);
    req.onsuccess=()=>resolve(req.result || null);
    req.onerror=()=>reject(req.error);
  });
}
async function putStoredJaDict(blob){
  const db=await openVoiceAssetDb();
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(JA_DICT_STORE,'readwrite');
    tx.objectStore(JA_DICT_STORE).put(blob,JA_DICT_KEY);
    tx.oncomplete=resolve;
    tx.onerror=()=>reject(tx.error);
  });
}
async function refreshJaDictStatus(){
  const el=$('#jaDictStatus');
  if(!el) return;
  try{
    const blob=await getStoredJaDict();
    if(blob && blob.size>=JA_DICT_MIN_BYTES){
      status(el,`登録済み：${(blob.size/1024/1024).toFixed(1)}MB。以後は端末内辞書を使用します。`,'ok');
    }else if(blob){
      status(el,`登録データが小さすぎます：${(blob.size/1024/1024).toFixed(1)}MB。正しいtar.gzを再登録してください。`,'warn');
    }else{
      status(el,'未登録。上のリンクから辞書を取得し、ファイルを選択して保存してください。','warn');
    }
  }catch(e){
    status(el,`辞書状態確認失敗：${e?.message || e}`,'warn');
  }
}


async function initProject(){
  if(projectId){
    project = await getProject(projectId);
    $('#backLink').href = `./#/project/${encodeURIComponent(projectId)}`;
    if(project){ $('#text').value = project.speechScript || project.displayScript || ''; }
  }
}

function showDiagnostics(extra=''){
  const lines = [
    `WebAssembly: ${typeof WebAssembly !== 'undefined' ? 'OK' : 'NG'}`,
    `Service Worker: ${'serviceWorker' in navigator ? 'OK' : 'NG'}`,
    `SW controller: ${navigator.serviceWorker?.controller ? 'あり' : 'なし'}`,
    `Web Audio: ${('AudioContext' in window || 'webkitAudioContext' in window) ? 'OK' : 'NG'}`,
    `IndexedDB: ${'indexedDB' in window ? 'OK' : 'NG'}`,
    `端末: ${navigator.userAgent}`,
    extra
  ].filter(Boolean);
  $('#diagnostics').textContent = lines.join('\n');
}
window.addEventListener('error', ev => showDiagnostics(`window error: ${ev?.error?.message || ev?.message || '不明'}`));
window.addEventListener('unhandledrejection', ev => showDiagnostics(`unhandledrejection: ${ev?.reason?.message || String(ev?.reason || '不明')}`));

showDiagnostics();
await initProject();

$('#saveJaDict').onclick = async () => {
  const file=$('#jaDictFile')?.files?.[0];
  if(!file){
    status($('#jaDictStatus'),'辞書ファイルを選択してください。','warn');
    return;
  }
  if(file.size < JA_DICT_MIN_BYTES){
    status($('#jaDictStatus'),`選択ファイルが小さすぎます（${(file.size/1024/1024).toFixed(1)}MB）。正しいOpenJTalk辞書tar.gzを選択してください。`,'warn');
    return;
  }
  try{
    status($('#jaDictStatus'),'端末へ保存しています…','warn');
    await putStoredJaDict(file);
    await refreshJaDictStatus();
  }catch(e){
    status($('#jaDictStatus'),`保存失敗：${e?.message || e}`,'warn');
  }
};
await refreshJaDictStatus();

async function ensureVendorServiceWorker(){
  if (!('serviceWorker' in navigator)) throw new Error('STEP 0 Service Worker非対応');
  const registration = await navigator.serviceWorker.register('./voice-vendor-sw.js', {scope:'./'});
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return registration;

  // clients.claim() normally takes control without reload. Give Safari a moment.
  await new Promise(resolve => {
    let done = false;
    const finish = () => { if(!done){ done=true; resolve(); } };
    navigator.serviceWorker.addEventListener('controllerchange', finish, {once:true});
    setTimeout(finish, 1500);
  });
  if (!navigator.serviceWorker.controller) {
    throw new Error('STEP 0 Service Worker登録済みですが、このページをまだ制御できていません。Safariでページを1回再読み込みしてから再度「準備」を押してください。');
  }
  return registration;
}

async function checkVirtualAsset(path, label){
  const url = new URL(path, location.href);
  const response = await fetch(url, {cache:'no-store'});
  if(!response.ok) throw new Error(`${label} 取得失敗 HTTP ${response.status}`);
  const type = response.headers.get('content-type') || '不明';
  const size = Number(response.headers.get('content-length') || 0);
  return {url:url.href, type, size};
}

$('#prepare').onclick = async () => {
  const btn=$('#prepare'), prog=$('#progress'), out=$('#engineStatus');
  btn.disabled=true; prog.value=1; status(out,'同一オリジン音声エンジンを準備しています…','warn');
  try{
    status(out,'[0/9] Safari用vendorブリッジを準備しています…','warn');
    prog.value=4;
    await ensureVendorServiceWorker();

    status(out,'[1/9] G2P本体を同一オリジン経由で取得しています…','warn');
    prog.value=10;
    const g2pUrl = 'https://cdn.jsdelivr.net/npm/@piper-plus/g2p@0.4.1/src/index.js';
    const g2pResp = await fetch(g2pUrl, {cache:'no-store', mode:'cors'});
    if(!g2pResp.ok) throw new Error(`STEP 1A G2P取得失敗 HTTP ${g2pResp.status}`);
    const g2pType = g2pResp.headers.get('content-type') || '不明';
    if(!/javascript|ecmascript|text\/plain/i.test(g2pType)) throw new Error(`STEP 1A G2P MIME異常: ${g2pType}`);
    const g2pSize = Number(g2pResp.headers.get('content-length') || 0);
    const g2pAsset = {url:g2pUrl, type:g2pType, size:g2pSize};

    status(out,'[2/9] G2Pモジュールを読み込んでいます…','warn');
    prog.value=16;
    let g2pModule;
    try { g2pModule = await import('@piper-plus/g2p'); }
    catch(e){ throw new Error(`STEP 1B @piper-plus/g2p 読込失敗: ${e?.message || e}`); }

    // Sprint 3.2.8:
    // Piper Plus 0.6.0 internally calls G2P.create() without enabling Japanese
    // in this Safari/CDN combination. Prepare the OpenJTalk dictionary here and
    // wrap G2P.create() so every internal call retains existing languages and
    // always enables "ja".
    status(out,'[2.5/10] 日本語G2P（OpenJTalk辞書）を初期化しています…','warn');
    prog.value=20;
    try {
      const { G2P, DictLoader } = g2pModule || {};
      if (!G2P || typeof G2P.create !== 'function') {
        throw new Error(`G2P.create exportなし: ${Object.keys(g2pModule || {}).join(', ')}`);
      }
      if (!DictLoader) {
        throw new Error(`DictLoader exportなし: ${Object.keys(g2pModule || {}).join(', ')}`);
      }

      const loader = new DictLoader();

      // Sprint 3.2.8:
      // Japanese dictionary is registered once by the user and persisted in IndexedDB.
      // DictLoader still requests its normal GitHub URL, but during loadJaDict() only,
      // that request is satisfied from the local Blob. Other fetches are untouched.
      const storedJaDict = await getStoredJaDict();
      if(!storedJaDict || storedJaDict.size < JA_DICT_MIN_BYTES){
        throw new Error('日本語辞書が未登録です。上の「OpenJTalk辞書を取得」→ ファイル選択 →「端末へ保存」を先に実行してください。');
      }

      const originalFetch = window.fetch.bind(window);
      const jaLoadTrace = [];
      window.fetch = async (...args) => {
        const input=args[0];
        const url=typeof input==='string' ? input : (input?.url || String(input));
        const started=Date.now();

        if(/open_jtalk_dic_utf_8-1\.11\.tar\.gz/i.test(url)){
          jaLoadTrace.push({
            url:'IndexedDB:'+JA_DICT_KEY,
            ok:true,
            status:200,
            type:storedJaDict.type || 'application/gzip',
            length:storedJaDict.size,
            ms:Date.now()-started,
            local:true
          });
          return new Response(storedJaDict, {
            status:200,
            headers:{
              'Content-Type': storedJaDict.type || 'application/gzip',
              'Content-Length': String(storedJaDict.size),
              'X-Creator-OS-Source':'IndexedDB'
            }
          });
        }

        try{
          const res=await originalFetch(...args);
          jaLoadTrace.push({
            url, ok:res.ok, status:res.status,
            type:res.headers.get('content-type')||'不明',
            length:res.headers.get('content-length')||'不明',
            ms:Date.now()-started
          });
          return res;
        }catch(err){
          jaLoadTrace.push({
            url, ok:false, status:'FETCH_ERROR', type:'-', length:'-',
            ms:Date.now()-started, error:err?.message||String(err)
          });
          throw err;
        }
      };

      let jaDict;
      try{
        jaDict=await loader.loadJaDict();
      }catch(e){
        const traceText=jaLoadTrace.length
          ? jaLoadTrace.map((x,i)=>`${i+1}. ${x.url}\n   status=${x.status} / MIME=${x.type} / size=${x.length}${x.local?' / LOCAL':''}`).join('\n')
          : '辞書要求を検出できませんでした。';
        throw new Error(`日本語辞書 loadJaDict() 失敗: ${e?.message||e}\n\n取得ログ:\n${traceText}`);
      }finally{
        window.fetch=originalFetch;
      }

      const traceTextOk=jaLoadTrace.length
        ? jaLoadTrace.map((x,i)=>`${i+1}. ${x.url} -> ${x.status} / ${x.type} / size=${x.length}${x.local?' / LOCAL':''}`).join('\n')
        : '辞書要求なし';
      status(out,`日本語辞書ロード成功。\n${traceTextOk}`,'ok');

      // Keep the original factory once. Re-preparing the engine must not stack wrappers.
      if (!G2P.__creatorOsOriginalCreate) {
        const originalCreate = G2P.create.bind(G2P);
        Object.defineProperty(G2P, '__creatorOsOriginalCreate', {
          value: originalCreate,
          configurable: true
        });

        G2P.create = async (options = {}) => {
          const current = Array.isArray(options.languages) ? options.languages : [];
          const languages = [...new Set(['ja', ...current])];
          return G2P.__creatorOsOriginalCreate({
            ...options,
            languages,
            jaDict: options.jaDict || jaDict
          });
        };
      }

      // Smoke-test the exact factory Piper Plus will call.
      const smoke = await G2P.create({ languages: ['ja'] });
      const smokeResult = smoke.phonemize('こんにちは', 'ja');
      if (!smokeResult) throw new Error('日本語phonemizeが空の結果を返しました');
      if (typeof smoke.dispose === 'function') smoke.dispose();

      status(out,'日本語G2P準備成功。Piper Plusへ接続します…','ok');
    } catch(e) {
      throw new Error(`STEP 1C 日本語G2P初期化失敗: ${e?.message || e}`);
    }

    status(out,'[3/10] ONNX Runtime WASM bundleを確認しています…','warn');
    prog.value=23;
    const jsAsset = await checkVirtualAsset('./vendor/onnxruntime/ort.wasm.bundle.min.mjs', 'STEP 2A ONNX WASM bundle');

    status(out,'[4/10] ONNX Runtime WASM本体を確認しています…','warn');
    prog.value=30;
    const wasmBin = await checkVirtualAsset('./vendor/onnxruntime/ort-wasm-simd-threaded.wasm', 'STEP 2B ONNX WASM本体');

    status(out,'[5/10] ONNX Runtimeを初期化しています…','warn');
    prog.value=38;
    let ort;
    try {
      ort = await import('onnxruntime-web');
      if(!ort?.InferenceSession || !ort?.Tensor) throw new Error(`必要export不足: ${Object.keys(ort||{}).join(', ')}`);
      ort.env.wasm.wasmPaths = new URL('./vendor/onnxruntime/', location.href).href;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
    } catch(e){ throw new Error(`STEP 3 ONNX Runtime初期化失敗: ${e?.message || e}`); }

    status(out,'[6/10] npm公開版 Piper Plus 0.6.0 を検証しています…','warn');
    prog.value=45;

    const piperCandidates = [
      'https://cdn.jsdelivr.net/npm/piper-plus@0.6.0/src/index.js',
      'https://unpkg.com/piper-plus@0.6.0/src/index.js',
      'https://esm.sh/piper-plus@0.6.0'
    ];
    let piperAsset = null;
    let piperSourceUrl = '';
    const failures = [];
    for (const candidate of piperCandidates) {
      try {
        const r = await fetch(candidate, {cache:'no-store', mode:'cors'});
        const type = r.headers.get('content-type') || '不明';
        const text = r.ok ? await r.text() : '';
        if (!r.ok) { failures.push(`${candidate} -> HTTP ${r.status}`); continue; }
        if (!/javascript|ecmascript|text\/plain/i.test(type)) {
          failures.push(`${candidate} -> MIME ${type}`); continue;
        }
        if (!text || text.length < 100) {
          failures.push(`${candidate} -> 内容が短すぎます (${text.length} bytes)`); continue;
        }
        piperSourceUrl = candidate;
        piperAsset = {url:candidate,type,size:text.length};
        break;
      } catch(e) {
        failures.push(`${candidate} -> ${e?.message || e}`);
      }
    }
    if (!piperSourceUrl) {
      throw new Error(`STEP 4A 公開版 Piper Plus 0.6.0取得失敗。配布元3系統すべてNG。\n${failures.join('\n')}`);
    }

    status(out,`[7/10] 公開版 Piper Plus 0.6.0取得成功。ES Module読込を検証しています…\n${piperSourceUrl}`,'warn');
    prog.value=53;
    let piperModule;
    try { piperModule = await import(piperSourceUrl); }
    catch(e){ throw new Error(`STEP 4B Piper Plus本体は取得成功しましたがES Module読込失敗: ${e?.message || e}\n取得元: ${piperSourceUrl}`); }
    const PiperPlus = piperModule.PiperPlus;
    const piperExports = Object.keys(piperModule);
    if(!PiperPlus) throw new Error(`STEP 4C PiperPlus exportなし。公開export: ${piperExports.join(', ') || '(なし)'}`);

    // Piperが使う2つの主要依存が、すでに取得済みの同じmodule namespaceとして利用可能かを確認。
    if(!g2pModule || !ort?.InferenceSession) throw new Error('STEP 4D Piper依存接続確認失敗');

    status(out,'[9/10] 日本語音声モデルを準備しています…','warn');
    prog.value=64;
    try {
      piper = await PiperPlus.initialize({
        model:'tsukuyomi',
        ort,
        onProgress: info => {
          const raw=Number(info?.progress ?? 0), pct=raw<=1?raw*100:raw;
          const mapped = 64 + (Math.max(0,Math.min(100,pct||0))*0.36);
          prog.value=Math.max(64,Math.min(100,mapped));
          status(out,`${info?.message || info?.stage || 'モデル準備中'}\n${Math.round(prog.value)}%`,'warn');
        }
      });
    } catch(e){ throw new Error(`STEP 5 Piper/音声モデル初期化失敗: ${e?.message || e}`); }

    status(out,'[10/10] Voice Engine準備完了','ok');
    prog.value=100;
    status(out,'準備完了。日本語ナレーションを生成できます。','ok');
    $('#generate').disabled=false; btn.textContent='準備済み';
    showDiagnostics(`成功: Piper Plus 0.6.0 / G2P 0.4.1 + JA/OpenJTalk / Piper=${piperAsset.type} / G2P=${g2pAsset.type} / ORT=${jsAsset.type} / WASM=${wasmBin.type}`);
  }catch(err){
    console.error(err); status(out,`準備に失敗しました。\n${err?.message || err}`,'warn'); btn.disabled=false;
    showDiagnostics(`Voice Lab 3.2.6 初期化失敗 / ${err?.message || err}`);
  }
};

$('#generate').onclick = async () => {
  const text=$('#text').value.trim(); if(!text)return alert('台本を入力してください。');
  const btn=$('#generate'); btn.disabled=true; status($('#generateStatus'),'音声を生成しています…','warn');
  try{
    result = await piper.synthesize(text,{language:'ja',noiseScale:0.667,lengthScale:Number($('#speed').value),noiseW:0.8});
    const blob=result.toBlob();
    if(resultUrl) URL.revokeObjectURL(resultUrl); resultUrl=URL.createObjectURL(blob);
    $('#preview').src=resultUrl; $('#register').disabled=false; $('#download').disabled=false;
    status($('#generateStatus'),`生成成功：${result.duration.toFixed(2)}秒 / ${result.sampleRate}Hz / WAV ${(blob.size/1024).toFixed(0)}KB`,'ok');
  }catch(err){console.error(err);status($('#generateStatus'),`生成に失敗しました。\n${err?.message || err}`,'warn');}
  finally{btn.disabled=false;}
};

$('#download').onclick=()=>{if(result)result.download('creator-os-narration.wav');};

$('#register').onclick = async () => {
  if(!projectId || !project){return alert('プロジェクトを特定できません。Creator OSの台本・音声画面からVoice Labを開いてください。');}
  if(!result)return;
  const btn=$('#register');btn.disabled=true;
  try{
    const blob=result.toBlob(); const audioData=await blobToDataUrl(blob);
    project.narration={...(project.narration||{}),audioData,fileName:'VoiceLab_PiperPlus.wav',mimeType:'audio/wav',source:'piper-plus',voiceId:'tsukuyomi-chan',volume:project.narration?.volume ?? 1};
    project.updatedAt=new Date().toISOString(); await saveProject(project);
    btn.textContent='✓ ナレーションへ登録済み';
    status($('#generateStatus'),`登録完了：${result.duration.toFixed(2)}秒のWAVをこのプロジェクトの動画用ナレーションに設定しました。`,'ok');
  }catch(err){console.error(err);alert(`登録に失敗しました：${err?.message||err}`);btn.disabled=false;}
};
