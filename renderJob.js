import { resolveSceneImageSource } from './mediaLibrary.js';

function pickNarration(narration) {
  if (!narration?.audioData) return null;
  return {
    audioData: narration.audioData,
    mimeType: narration.mimeType || '',
    fileName: narration.fileName || '',
    durationSec: Number(narration.durationSec) || 0
  };
}

function pickScene(project, scene) {
  const imageData = resolveSceneImageSource(project, scene).data || '';
  return {
    id: scene?.id || '',
    durationSec: Math.max(0, Number(scene?.durationSec) || 0),
    motion: scene?.motion || 'none',
    transition: scene?.transition || 'cut',
    text: scene?.text || '',
    subtitleText: scene?.subtitleText || '',
    subtitleEnabled: scene?.subtitleEnabled !== false,
    subtitleStartSec: Number(scene?.subtitleStartSec) || 0,
    subtitleEndSec: Number(scene?.subtitleEndSec) || 0,
    subtitlePhraseSync: scene?.subtitlePhraseSync !== false,
    subtitlePosition: scene?.subtitlePosition,
    subtitleOffsetPercent: scene?.subtitleOffsetPercent,
    imageData,
    narration: pickNarration(scene?.narration)
  };
}

export function createRenderJob(project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes.map(scene => pickScene(project, scene)) : [];
  const hasSceneNarration = scenes.some(scene => scene?.narration?.audioData);
  return {
    __renderJob: true,
    id: project?.id || '',
    scenes,
    mediaLibrary: [],
    subtitleStyle: project?.subtitleStyle ? { ...project.subtitleStyle } : {},
    output: project?.output ? { ...project.output } : {},
    bgm: project?.bgm ? {
      source: project.bgm.source,
      audioData: project.bgm.audioData || '',
      fileName: project.bgm.fileName || '',
      volume: project.bgm.volume,
      loop: project.bgm.loop,
      ducking: project.bgm.ducking,
      fadeInSec: project.bgm.fadeInSec,
      fadeOutSec: project.bgm.fadeOutSec
    } : {},
    narration: hasSceneNarration ? {
      volume: project?.narration?.volume
    } : {
      ...(pickNarration(project?.narration) || {}),
      volume: project?.narration?.volume
    }
  };
}

export function isRenderJob(value) {
  return value?.__renderJob === true && Array.isArray(value?.scenes);
}
