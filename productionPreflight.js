const text = value => String(value ?? '').trim();

export function inspectProductionProject(project) {
  const issues = [];
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  if (!scenes.length) issues.push({ level: 'error', code: 'no-scenes', message: 'シーンがありません。' });
  scenes.forEach((scene, index) => {
    const label = `Scene ${index + 1}`;
    if (!text(scene?.text)) issues.push({ level: 'warning', code: 'scene-text-empty', sceneIndex: index, message: `${label} の本文が空です。` });
    if (!scene?.imageAssetId && !scene?.imageData) issues.push({ level: 'warning', code: 'scene-image-missing', sceneIndex: index, message: `${label} に画像がありません。` });
    if (project?.subtitleStyle?.enabled !== false && !text(scene?.subtitleText ?? scene?.text)) issues.push({ level: 'warning', code: 'subtitle-empty', sceneIndex: index, message: `${label} の字幕が空です。` });
    if (!scene?.narration?.audioData) issues.push({ level: 'warning', code: 'narration-missing', sceneIndex: index, message: `${label} のナレーション音声が未生成です。` });
    const duration = Number(scene?.durationSec);
    if (!Number.isFinite(duration) || duration <= 0) issues.push({ level: 'error', code: 'scene-duration-invalid', sceneIndex: index, message: `${label} の長さが不正です。` });
  });
  if (project?.bgm?.enabled && !project?.bgm?.audioData && !project?.bgm?.dataUrl) issues.push({ level: 'warning', code: 'bgm-missing', message: 'BGMが有効ですが音源がありません。' });
  return {
    ok: !issues.some(issue => issue.level === 'error'),
    errors: issues.filter(issue => issue.level === 'error').length,
    warnings: issues.filter(issue => issue.level === 'warning').length,
    issues
  };
}
