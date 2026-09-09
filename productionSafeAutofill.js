export function safeAutofillScene(scene = {}) {
  const next = { ...scene };
  const text = String(next.text || '').trim();
  const changed = [];

  if (text && !String(next.speechText || '').trim()) {
    next.speechText = text;
    changed.push('speechText');
  }
  if (text && !String(next.subtitleText || '').trim()) {
    next.subtitleText = text;
    changed.push('subtitleText');
  }
  if (!next.motion) {
    next.motion = 'zoom-in';
    changed.push('motion');
  }
  if (!next.transition) {
    next.transition = 'fade';
    changed.push('transition');
  }
  return { scene: next, changed };
}

export function safeAutofillProject(project = {}) {
  const source = { ...project };
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  let changedScenes = 0;
  let changedFields = 0;
  source.scenes = scenes.map(scene => {
    const result = safeAutofillScene(scene);
    if (result.changed.length) changedScenes++;
    changedFields += result.changed.length;
    return result.scene;
  });
  return { project: source, changedScenes, changedFields };
}
