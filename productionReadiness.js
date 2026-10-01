import { isProceduralBgm } from './proceduralBgm.js';

const clean=value=>String(value??'').trim();

export function hasReadySceneNarration(scene){
  return Boolean(
    clean(scene?.narration?.audioData)
    || clean(scene?.narration?.mediaRef?.id)
  );
}

export function isProjectBgmEnabled(project){
  if(typeof project?.output?.bgmEnabled==='boolean')return project.output.bgmEnabled;
  if(typeof project?.bgm?.enabled==='boolean')return project.bgm.enabled;
  const source=clean(project?.bgm?.source).toLowerCase();
  return Boolean(source&&source!=='none');
}

export function hasReadyProjectBgm(project){
  const source=clean(project?.bgm?.source).toLowerCase();
  if(!isProjectBgmEnabled(project))return true;
  if(source==='none')return true;
  return Boolean(
    clean(project?.bgm?.audioData)
    || clean(project?.bgm?.dataUrl)
    || isProceduralBgm(project?.bgm)
  );
}
