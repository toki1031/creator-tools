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
    const g2pAsset = await checkVirtualAsset('./vendor/piper-g2p/index.js', 'STEP 1A G2P本体');

    status(out,'[2/9] G2Pモジュールを読み込んでいます…','warn');
    prog.value=16;
    let g2pModule;
    try { g2pModule = await import('@piper-plus/g2p'); }
    catch(e){ throw new Error(`STEP 1B @piper-plus/g2p 読込失敗: ${e?.message || e}`); }

    status(out,'[3/9] ONNX Runtime WASM bundleを確認しています…','warn');
    prog.value=23;
    const jsAsset = await checkVirtualAsset('./vendor/onnxruntime/ort.wasm.bundle.min.mjs', 'STEP 2A ONNX WASM bundle');

    status(out,'[4/9] ONNX Runtime WASM本体を確認しています…','warn');
    prog.value=30;
    const wasmBin = await checkVirtualAsset('./vendor/onnxruntime/ort-wasm-simd-threaded.wasm', 'STEP 2B ONNX WASM本体');

    status(out,'[5/9] ONNX Runtimeを初期化しています…','warn');
    prog.value=38;
    let ort;
    try {
      ort = await import('onnxruntime-web');
      if(!ort?.InferenceSession || !ort?.Tensor) throw new Error(`必要export不足: ${Object.keys(ort||{}).join(', ')}`);
      ort.env.wasm.wasmPaths = new URL('./vendor/onnxruntime/', location.href).href;
      ort.env.wasm.numThreads = 1;
      ort.env.wasm.proxy = false;
    } catch(e){ throw new Error(`STEP 3 ONNX Runtime初期化失敗: ${e?.message || e}`); }

    status(out,'[6/9] Piper Plus本体を同一オリジン経由で取得しています…','warn');
    prog.value=47;
    const piperAsset = await checkVirtualAsset('./vendor/piper-plus/index.js', 'STEP 4A Piper Plus本体');

    status(out,'[7/9] Piper Plusモジュールを解析・読込しています…','warn');
    prog.value=55;
    let piperModule;
    try { piperModule = await import('piper-plus'); }
    catch(e){ throw new Error(`STEP 4B piper-plus モジュール読込失敗: ${e?.message || e}`); }
    const PiperPlus = piperModule.PiperPlus;
    if(!PiperPlus) throw new Error(`STEP 4C PiperPlus exportなし: ${Object.keys(piperModule).join(', ')}`);

    // Piperが使う2つの主要依存が、すでに取得済みの同じmodule namespaceとして利用可能かを確認。
    if(!g2pModule || !ort?.InferenceSession) throw new Error('STEP 4D Piper依存接続確認失敗');

    status(out,'[8/9] 日本語音声モデルを準備しています…','warn');
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

    status(out,'[9/9] Voice Engine準備完了','ok');
    prog.value=100;
    status(out,'準備完了。日本語ナレーションを生成できます。','ok');
    $('#generate').disabled=false; btn.textContent='準備済み';
    showDiagnostics(`成功: Piper same-origin / Piper=${piperAsset.type} / G2P=${g2pAsset.type} / ORT=${jsAsset.type} / WASM=${wasmBin.type}`);
  }catch(err){
    console.error(err); status(out,`準備に失敗しました。\n${err?.message || err}`,'warn'); btn.disabled=false;
    showDiagnostics(`Voice Lab 3.2.1 初期化失敗 / ${err?.message || err}`);
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
