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
    if(project){
      $('#text').value = project.speechScript || project.displayScript || '';
    }
  }
}

function showDiagnostics(extra=''){
  const lines = [
    `WebAssembly: ${typeof WebAssembly !== 'undefined' ? 'OK' : 'NG'}`,
    `Web Audio: ${('AudioContext' in window || 'webkitAudioContext' in window) ? 'OK' : 'NG'}`,
    `IndexedDB: ${'indexedDB' in window ? 'OK' : 'NG'}`,
    `端末: ${navigator.userAgent}`,
    extra
  ].filter(Boolean);
  $('#diagnostics').textContent = lines.join('\n');
}
window.addEventListener('error', (ev) => {
  const msg = ev?.error?.message || ev?.message || '不明なwindow error';
  showDiagnostics(`window error: ${msg}`);
});
window.addEventListener('unhandledrejection', (ev) => {
  const reason = ev?.reason?.message || String(ev?.reason || '不明なPromise rejection');
  showDiagnostics(`unhandledrejection: ${reason}`);
});

showDiagnostics();
await initProject();

$('#prepare').onclick = async () => {
  const btn=$('#prepare'), prog=$('#progress'), out=$('#engineStatus');
  btn.disabled=true; prog.value=1; status(out,'ライブラリを読み込んでいます…','warn');
  try{
    // Piper Plus公式の「importmap / No Bundler」方式で読み込む。
    // +esm変換CDNはWASM/依存モジュールの解決でSafariが失敗することがあるため使用しない。
    // Safariではimport失敗が汎用エラーになりやすいため、依存を1つずつ確認する。
    status(out,'[1/3] G2Pモジュールを読み込んでいます…','warn');
    prog.value=8;
    let g2pModule;
    try {
      g2pModule = await import('@piper-plus/g2p');
    } catch (e) {
      throw new Error(`STEP 1 @piper-plus/g2p 読込失敗: ${e?.message || e}`);
    }

    status(out,'[2/3] ONNX Runtimeを読み込んでいます…','warn');
    prog.value=16;
    let ortModule;
    try {
      ortModule = await import('onnxruntime-web');
    } catch (e) {
      throw new Error(`STEP 2 onnxruntime-web 読込失敗: ${e?.message || e}`);
    }

    status(out,'[3/3] Piper Plus本体を読み込んでいます…','warn');
    prog.value=24;
    let piperModule;
    try {
      piperModule = await import('piper-plus');
    } catch (e) {
      throw new Error(`STEP 3 piper-plus 読込失敗: ${e?.message || e}`);
    }

    const PiperPlus = piperModule.PiperPlus;
    if(!PiperPlus) throw new Error(`PiperPlus exportが見つかりません。exports=${Object.keys(piperModule).join(', ')}`);
    const ort = ortModule;
    globalThis.ort = ort;
    status(out,'音声モデルを準備しています。初回は約40MBの取得に時間がかかります…','warn');
    piper = await PiperPlus.initialize({
      model:'tsukuyomi',
      ort,
      onProgress: info => {
        const raw=Number(info?.progress ?? 0); const pct=raw<=1?raw*100:raw;
        prog.value=Math.max(1,Math.min(100,pct||1));
        status(out,`${info?.message || info?.stage || '準備中'}\n${Math.round(prog.value)}%`,'warn');
      }
    });
    prog.value=100; status(out,'準備完了。日本語ナレーションを生成できます。','ok');
    $('#generate').disabled=false; btn.textContent='準備済み';
    showDiagnostics(`Piper Plus 0.7.0: 3依存Import Map読込・初期化成功 / G2P exports=${Object.keys(g2pModule).slice(0,8).join(', ')} / config sampleRate=${piper.config?.audio?.sample_rate ?? '不明'}`);
  }catch(err){
    console.error(err); status(out,`準備に失敗しました。\n${err?.message || err}`,'warn'); btn.disabled=false;
    showDiagnostics(`Piper Plus 0.7.0: 初期化失敗 / ${err?.message || err}`);
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
