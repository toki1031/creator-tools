import { inspectProductionProject } from './productionPreflight.js';
import { publishMetadataApprovalMatches } from './decisionLog.js';

const ROUTES = {
  project: 'project',
  scenes: 'scenes',
  narration: 'narration',
  bgm: 'bgm',
  output: 'output',
  publish: 'publish'
};

export function routeForProductionIssue(issue = {}) {
  const code = String(issue.code || '');
  if (['no-scenes','scene-text-empty','scene-image-missing','scene-duration-invalid'].includes(code)) return ROUTES.scenes;
  if (code === 'narration-missing') return ROUTES.narration;
  if (['subtitle-empty','bgm-missing'].includes(code)) return ROUTES.bgm;
  return ROUTES.output;
}

export function buildProductionChecklist(project = {}) {
  const report = inspectProductionProject(project);
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const hasScenes = scenes.length > 0;
  const hasImages = hasScenes && scenes.every(scene => Boolean(scene.imageAssetId || scene.imageData));
  const hasNarration = hasScenes && scenes.every(scene => Boolean(scene?.narration?.audioData));
  const subtitlesReady = project?.subtitleStyle?.enabled === false || (hasScenes && scenes.every(scene => String(scene.subtitleText ?? scene.text ?? '').trim()));
  const bgmReady = project?.bgm?.enabled === false || Boolean(project?.bgm?.audioData || project?.bgm?.dataUrl);
  const exportReady = report.errors === 0 && report.warnings === 0;
  const publish = project?.publish || {};
  const publishReady = Boolean(publish?.approval?.approved && publishMetadataApprovalMatches(publish.approval, publish));
  return [
    { id:'scenes', label:'Scene', done:hasScenes, route:ROUTES.scenes },
    { id:'images', label:'画像素材', done:hasImages, route:ROUTES.scenes },
    { id:'narration', label:'ナレーション', done:hasNarration, route:ROUTES.narration },
    { id:'subtitles', label:'字幕', done:subtitlesReady, route:ROUTES.bgm },
    { id:'bgm', label:'BGM', done:bgmReady, route:ROUTES.bgm },
    { id:'output', label:'出力準備', done:exportReady, route:ROUTES.output },
    { id:'publish', label:'公開準備', done:publishReady, route:ROUTES.publish }
  ];
}

export function nextProductionDestination(project = {}) {
  const checklist = buildProductionChecklist(project);
  const next = checklist.find(item => !item.done);
  return next || { id:'complete', label:'制作完了', done:true, route:ROUTES.publish };
}

export function preflightNavigation(project = {}) {
  const report = inspectProductionProject(project);
  return report.issues.map(issue => ({ ...issue, route: routeForProductionIssue(issue) }));
}
