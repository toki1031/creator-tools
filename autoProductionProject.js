import { createProject } from './projectFactory.js';
import { parseProductionRequest } from './productionBriefParser.js';
import { applyProductionBriefScenes } from './productionBriefScenes.js';
import { distributeGlobalNarration } from './autoNarrationScenes.js';
import { createProceduralBgmSettings } from './proceduralBgm.js';

export function createAutoProductionProject({ requestText, title = '', genre = 'great-person', platform = 'youtube-shorts', targetDurationSec = 60 } = {}) {
  const request = String(requestText ?? '').trim();
  if (!request) return { ok: false, reason: 'empty-request', project: null, brief: null };

  const brief = parseProductionRequest(request);
  if (!Array.isArray(brief.sceneDirectives) || !brief.sceneDirectives.length) {
    return { ok: false, reason: 'no-scenes', project: null, brief };
  }

  const project = createProject(String(title ?? ''), genre, platform);
  project.targetDurationSec = Math.max(5, Number(targetDurationSec) || 60);
  const built = applyProductionBriefScenes(project, brief);
  built.scenes = distributeGlobalNarration(built.scenes, brief);
  const autoBgm = createProceduralBgmSettings(brief.bgmGuidance);
  if (autoBgm) built.bgm = autoBgm;
  built.autoProduction = {
    mode: 'production-request',
    source: 'local-parser',
    createdAt: new Date().toISOString()
  };
  built.updatedAt = new Date().toISOString();
  return { ok: true, reason: '', project: built, brief };
}
