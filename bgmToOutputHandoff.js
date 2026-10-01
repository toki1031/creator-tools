import { hasReadyProjectBgm, hasReadySceneNarration } from './productionReadiness.js';
import { hasReadySceneImage } from './assetToVoiceHandoff.js';

const clean=value=>String(value??'').trim();

export function evaluateBgmToOutputHandoff(project){
  if(project?.autoProduction?.mode!=='production-request'){
    return {canContinue:false,reason:'自動制作プロジェクトではありません'};
  }
  const scenes=Array.isArray(project?.scenes)?project.scenes:[];
  if(!scenes.length)return {canContinue:false,reason:'シーンがありません'};

  const missingImages=scenes.flatMap((scene,index)=>hasReadySceneImage(scene)?[]:[index+1]);
  if(missingImages.length){
    return {canContinue:false,reason:`画像未登録：シーン${missingImages.join('・')}`,missingImages};
  }

  const missingNarrations=scenes.flatMap((scene,index)=>hasReadySceneNarration(scene)?[]:[index+1]);
  if(missingNarrations.length){
    return {canContinue:false,reason:`ナレーション未生成：シーン${missingNarrations.join('・')}`,missingNarrations};
  }

  const invalidDurations=scenes.flatMap((scene,index)=>Number(scene?.durationSec)>0?[]:[index+1]);
  if(invalidDurations.length){
    return {canContinue:false,reason:`Scene尺が不正：シーン${invalidDurations.join('・')}`,invalidDurations};
  }

  const subtitlesEnabled=project?.output?.subtitles ?? project?.subtitleStyle?.enabled !== false;
  if(subtitlesEnabled){
    const enabledScenes=scenes
      .map((scene,index)=>({scene,index}))
      .filter(({scene})=>scene?.subtitleEnabled!==false);
    if(!enabledScenes.length){
      return {canContinue:false,reason:'表示可能な字幕がありません'};
    }
    const missingSubtitles=enabledScenes
      .filter(({scene})=>!clean(scene?.subtitleText ?? scene?.text))
      .map(({index})=>index+1);
    if(missingSubtitles.length){
      return {canContinue:false,reason:`字幕未設定：シーン${missingSubtitles.join('・')}`,missingSubtitles};
    }
  }

  if(!hasReadyProjectBgm(project)){
    return {canContinue:false,reason:'BGMが準備できていません'};
  }

  return {canContinue:true,reason:''};
}
