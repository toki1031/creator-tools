import { inspectProductionProject } from './productionPreflight.js';

const text = value => String(value ?? '').trim();

function subtitleReadabilityIssues(project) {
  const issues = [];
  if (project?.subtitleStyle?.enabled === false) return issues;
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  scenes.forEach((scene, sceneIndex) => {
    const subtitle = text(scene?.subtitleText ?? scene?.text);
    if (!subtitle) return;
    const duration = Math.max(0.1, Number(scene?.durationSec) || 0.1);
    const charsPerSec = subtitle.replace(/\s/g, '').length / duration;
    if (charsPerSec > 12) issues.push({
      level: 'warning', code: 'subtitle-too-fast', route: 'subtitles-bgm', sceneIndex,
      message: `Scene ${sceneIndex + 1} は字幕量が多く、読み切れない可能性があります。`
    });
  });
  return issues;
}

function bgmRightsIssues(project) {
  const bgm = project?.bgm;
  if (!bgm?.enabled) return [];
  if (bgm.commercialUse === 'not-allowed') return [{ level: 'error', code: 'bgm-commercial-use-blocked', route: 'subtitles-bgm', message: 'このBGMは商用利用不可として登録されています。' }];
  if (!text(bgm.license) || !text(bgm.sourceUrl) || !text(bgm.commercialUse)) return [{ level: 'warning', code: 'bgm-rights-unconfirmed', route: 'subtitles-bgm', message: 'BGMのライセンス・出典・商用利用可否を確認してください。' }];
  return [];
}

function publishIssues(project) {
  const publish = project?.publish || {};
  const issues = [];
  if (!text(publish.title)) issues.push({ level: 'warning', code: 'publish-title-missing', route: 'publish', message: '公開タイトルが未設定です。' });
  if (!text(publish.description)) issues.push({ level: 'warning', code: 'publish-description-missing', route: 'publish', message: '公開説明文が未設定です。' });
  return issues;
}

export function inspectSmartFinish(project) {
  const base = inspectProductionProject(project);
  const issues = [
    ...base.issues.map(issue => ({ ...issue, route: issue.route || (issue.code === 'narration-missing' ? 'narration' : issue.code === 'bgm-missing' ? 'subtitles-bgm' : 'scenes') })),
    ...subtitleReadabilityIssues(project),
    ...bgmRightsIssues(project),
    ...publishIssues(project)
  ];
  return {
    ready: !issues.some(issue => issue.level === 'error') && issues.length === 0,
    errors: issues.filter(issue => issue.level === 'error').length,
    warnings: issues.filter(issue => issue.level === 'warning').length,
    issues
  };
}

export function firstSmartFinishAction(project) {
  const report = inspectSmartFinish(project);
  const issue = report.issues[0];
  return issue ? { route: issue.route, code: issue.code, message: issue.message } : { route: 'output', code: 'ready', message: '仕上げチェック完了。出力できます。' };
}
