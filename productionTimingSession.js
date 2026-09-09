import { startProductionStage, finishProductionStage } from './productionTiming.js';

const KEY = 'creator-os-production-stage-v1';

export function routeStageFromHash(hash = '') {
  const value = String(hash);
  if (/\/scenes(?:\/|$)/.test(value)) return 'scenes';
  if (/\/bgm(?:\/|$)/.test(value)) return 'subtitles-bgm';
  if (/\/output(?:\/|$)/.test(value)) return 'output';
  if (/\/publish(?:\/|$)/.test(value)) return 'publish';
  if (/\/project\//.test(value)) return 'project';
  return null;
}

export function readTimingSession(storage = sessionStorage) {
  try { return JSON.parse(storage.getItem(KEY) || 'null'); } catch { return null; }
}

export function transitionTimingSession(hash, now = Date.now(), storage = sessionStorage) {
  const nextStage = routeStageFromHash(hash);
  const previous = readTimingSession(storage);
  let finished = null;
  if (previous && previous.stage !== nextStage) finished = finishProductionStage(previous, now);
  if (nextStage && previous?.stage !== nextStage) storage.setItem(KEY, JSON.stringify(startProductionStage(nextStage, now)));
  else if (!nextStage) storage.removeItem(KEY);
  return { finished, activeStage: nextStage };
}
