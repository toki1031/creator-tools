export const MVP_SHORTS_SPEC = Object.freeze({ width:1080, height:1920, fps:30, maxDurationSec:180, format:'mp4' });
export const SAFE_SHORTS_SPEC = Object.freeze({ width:720, height:1280, fps:30, format:'mp4' });

export function isMvpShortsProject(project) {
  return project?.platform === 'youtube-shorts' && project?.genre !== 'bgm';
}

export function validateMvpShortsOutput(project, durationSec = 0) {
  const applicable=isMvpShortsProject(project), errors=[], warnings=[];
  if(!applicable) return {applicable,pass:true,errors,warnings};
  const output=project?.output||{}, width=Number(output.width)||0, height=Number(output.height)||0, fps=Number(output.fps)||0;
  const format=String(output.format||'mp4').toLowerCase(), duration=Math.max(0,Number(durationSec)||0);
  const isFullHd=width===MVP_SHORTS_SPEC.width&&height===MVP_SHORTS_SPEC.height;
  const isSafeHd=width===SAFE_SHORTS_SPEC.width&&height===SAFE_SHORTS_SPEC.height;
  if(!isFullHd&&!isSafeHd) errors.push('解像度を1080×1920または720×1280にしてください。');
  if(isSafeHd) warnings.push('iPhone安定生成用の720×1280です。1080×1920より画質は下がります。');
  if(fps!==30) errors.push('フレームレートを30fpsにしてください。');
  if(format!=='mp4') errors.push('出力形式をMP4にしてください。');
  if(duration>MVP_SHORTS_SPEC.maxDurationSec+0.001) errors.push(`YouTube Shortsは${MVP_SHORTS_SPEC.maxDurationSec}秒以内にしてください。`);
  if(duration>170&&duration<=MVP_SHORTS_SPEC.maxDurationSec+0.001) warnings.push('3分上限に近いため、完成後の再生時間も確認してください。');
  return {applicable,pass:errors.length===0,errors,warnings,width,height,fps,format,durationSec:duration};
}

export function assessMvpVideoResult({project,durationSec,mimeType,selectedMimeType,videoWidth,videoHeight,captureFrameRate,hasAudio=false}={}) {
  const pre=validateMvpShortsOutput(project,durationSec);
  if(!pre.applicable) return {applicable:false,pass:true,issues:[],warnings:[],text:'MVP Shorts対象外'};
  const issues=[...pre.errors], warnings=[...pre.warnings];
  if(videoWidth&&videoHeight){
    const width=Number(videoWidth),height=Number(videoHeight);
    const isFullHd=width===MVP_SHORTS_SPEC.width&&height===MVP_SHORTS_SPEC.height;
    const isSafeHd=width===SAFE_SHORTS_SPEC.width&&height===SAFE_SHORTS_SPEC.height;
    if(!isFullHd&&!isSafeHd) issues.push(`生成動画が${videoWidth}×${videoHeight}です。`);
    else if(isSafeHd&&!warnings.some(x=>x.includes('720×1280'))) warnings.push('生成動画はiPhone安定生成用の720×1280です。');
  }
  if(!String(mimeType||'').toLowerCase().includes('video/mp4')) issues.push(`生成形式がMP4ではありません（${mimeType||'不明'}）。`);
  const selected=String(selectedMimeType||'').toLowerCase();
  if(selected&&!selected.includes('avc1')) warnings.push('H.264(avc1)を明示指定できず、ブラウザ既定のMP4 codecで生成しています。');
  if(selected&&hasAudio&&!selected.includes('mp4a')) warnings.push('AAC(mp4a)を明示指定できず、ブラウザ既定のMP4 audio codecで生成しています。');
  const captureFps=Number(captureFrameRate)||0;
  if(captureFps&&Math.abs(captureFps-30)>1) issues.push(`captureStreamのフレームレートが約${captureFps.toFixed(1)}fpsです。`);
  const pass=issues.length===0;
  return {applicable:true,pass,issues,warnings,text:pass?`PASS${warnings.length?`（${warnings.join('／')}）`:''}`:`要確認：${issues.join('／')}`};
}

export function describeVideoExportFailure(error,{durationSec=0,width=0,height=0,fps=0}={}) {
  const name=String(error?.name||'Error'), message=String(error?.message||error||'不明なエラー'), combined=`${name} ${message}`.toLowerCase();
  let cause='ブラウザの動画生成処理でエラーが発生しました。';
  let next='画面を開いたまま再試行してください。iPhoneで全編生成が繰り返し失敗する場合は720×1280の安定生成を使用してください。';
  if(/memory|out of memory|allocation|resource|quota/.test(combined)){
    cause='端末のメモリまたはブラウザ資源が不足した可能性があります。';
    next='他のタブや重いアプリを閉じ、iPhoneでは720×1280 / 30fpsの安定生成で再試行してください。';
  }else if(/codec|mime|mediarecorder|not.?supported|notsupported|encoding/.test(combined)){
    cause='このブラウザでMP4/H.264系の録画形式を開始できなかった可能性があります。';
    next='Safariを最新版にして通常再読み込みし、再試行してください。MP4非対応表示の場合は別の対応端末で生成してください。';
  }else if(/audio|decode|bgm|narration/.test(combined)){
    cause='BGMまたはナレーション音声の読み込み・デコードに失敗した可能性があります。';
    next='BGM・ナレーションをMP3/M4A/AAC/WAVで再登録して確認してください。';
  }
  const spec=width&&height?`\n設定：${width}×${height} / ${fps||'?'}fps / 約${Math.ceil(Number(durationSec)||0)}秒`:'';
  return `${cause}\n詳細：${message}${spec}\n次の操作：${next}`;
}
