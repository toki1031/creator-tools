import { resolveShortsWorkspace } from './shortsWorkspace.js';

function clone(value) {
  try { return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value)); }
  catch { return null; }
}

export function createShortsRenderProject(project, draftId) {
  const workspace = resolveShortsWorkspace(project, draftId);
  if (!workspace) throw new Error('Shorts案が見つかりません。');
  if (!workspace.scenes.length) throw new Error('Shorts出力に使えるSceneがありません。');

  const scenes = workspace.scenes.map(item => clone(item.scene) || item.scene);
  const hasSceneNarration = scenes.some(scene => Boolean(scene?.narration?.audioData));
  const sourceNarration = project?.narration && typeof project.narration === 'object' ? project.narration : {};
  const output = project?.output && typeof project.output === 'object' ? project.output : {};

  return {
    ...project,
    id: `${String(project?.id || 'project')}:shorts:${String(draftId || '')}`,
    title: workspace.draft.title || `${String(project?.title || 'Creator OS')} Shorts`,
    aspectRatio: '9:16',
    targetDurationSec: Math.max(15, Math.min(60, Number(workspace.draft.targetDurationSec || workspace.draft.durationSec || 45))),
    scenes,
    // Runtime reference only. This object is never persisted, so large media payloads are not duplicated in IndexedDB.
    mediaLibrary: Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : [],
    subtitleStyle: project?.subtitleStyle || {},
    bgm: project?.bgm || {},
    narration: {
      ...sourceNarration,
      // Whole-project narration cannot be time-shifted safely for an extracted segment.
      audioData: '',
      fileName: '',
      mimeType: '',
      shortsSceneNarrationOnly: hasSceneNarration
    },
    output: {
      ...output,
      width: 1080,
      height: 1920,
      fps: Number(output.fps) || 30,
      subtitles: output.subtitles !== false
    },
    shortsRuntime: {
      sourceProjectId: String(project?.id || ''),
      draftId: String(draftId || ''),
      sourceSceneIds: workspace.scenes.map(item => item.sceneId),
      missingSceneIds: [...workspace.missingSceneIds],
      suppressedWholeNarration: Boolean(sourceNarration.audioData)
    }
  };
}

export function summarizeShortsRenderProject(project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  return {
    sceneCount: scenes.length,
    durationSec: scenes.reduce((sum, scene) => sum + Math.max(0, Number(scene?.durationSec) || 0), 0),
    sceneNarrationCount: scenes.filter(scene => Boolean(scene?.narration?.audioData)).length,
    suppressedWholeNarration: Boolean(project?.shortsRuntime?.suppressedWholeNarration),
    missingSceneCount: Array.isArray(project?.shortsRuntime?.missingSceneIds) ? project.shortsRuntime.missingSceneIds.length : 0,
    width: Number(project?.output?.width) || 0,
    height: Number(project?.output?.height) || 0
  };
}
