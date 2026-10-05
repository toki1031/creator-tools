import { resolveSceneImageSource } from './mediaLibrary.js';

function copyMediaRef(ref) {
  return ref?.id ? { id:ref.id, kind:ref.kind, mimeType:ref.mimeType || '', sizeBytes:Number(ref.sizeBytes) || 0 } : null;
}

function pickNarration(narration) {
  if (!narration?.audioData && !narration?.mediaRef?.id) return null;
  return {
    audioData: narration.audioData || '',
    mediaRef: copyMediaRef(narration.mediaRef),
    mimeType: narration.mimeType || narration.mediaRef?.mimeType || '',
    fileName: narration.fileName || '',
    durationSec: Number(narration.durationSec) || 0
  };
}

function pickScene(project, scene) {
  const image = resolveSceneImageSource(project, scene);
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
    subtitlePositionOffsetPercent: scene?.subtitlePositionOffsetPercent,
    imageData: image.data || '',
    imageAssetId: image.assetId || '',
    narration: pickNarration(scene?.narration)
  };
}

function pickReferencedImageAssets(project, scenes) {
  const ids = new Set(scenes.filter(scene => scene?.imageAssetId && !scene?.imageData).map(scene => scene.imageAssetId));
  if (!ids.size) return [];
  return (Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : [])
    .filter(asset => asset?.type === 'image' && ids.has(asset.id))
    .map(asset => ({
      id: asset.id,
      type: 'image',
      data: asset.data || '',
      mediaRef: copyMediaRef(asset.mediaRef)
    }));
}

function pickBgm(bgm) {
  if (!bgm || typeof bgm !== 'object') return {};
  return {
    source: bgm.source,
    audioData: bgm.audioData || '',
    mediaRef: copyMediaRef(bgm.mediaRef),
    fileName: bgm.fileName || '',
    mimeType: bgm.mimeType || '',
    volume: bgm.volume,
    loop: bgm.loop,
    ducking: bgm.ducking,
    fadeInSec: bgm.fadeInSec,
    fadeOutSec: bgm.fadeOutSec,
    procedural: bgm.procedural && typeof bgm.procedural === 'object' ? { ...bgm.procedural } : undefined
  };
}

export function createRenderJob(project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes.map(scene => pickScene(project, scene)) : [];
  const hasSceneNarration = scenes.some(scene => Boolean(scene?.narration?.audioData || scene?.narration?.mediaRef?.id));
  return {
    __renderJob: true,
    id: project?.id || '',
    autoProduction: project?.autoProduction?.mode ? { mode: project.autoProduction.mode } : undefined,
    scenes,
    mediaLibrary: pickReferencedImageAssets(project, scenes),
    subtitleStyle: project?.subtitleStyle ? { ...project.subtitleStyle } : {},
    output: project?.output ? { ...project.output } : {},
    bgm: pickBgm(project?.bgm),
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
