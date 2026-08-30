export function projectExpectsVideoAudio(project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const hasSceneNarration = scenes.some(scene => Boolean(scene?.narration?.audioData));
  const hasBgm = Boolean(project?.output?.bgmEnabled && project?.bgm?.audioData);
  const hasNarration = Boolean(project?.narration?.audioData);
  return hasBgm || hasNarration || hasSceneNarration;
}

export function createGenerationStartController({
  expectsAudio = false,
  AudioContextClass = null,
  onApprove = () => {},
  onCancel = () => {}
} = {}) {
  let settled = false;

  const approve = () => {
    if (settled) return false;
    settled = true;

    let audioContext = null;
    let audioStartError = null;
    let audioResumeResult = Promise.resolve(null);

    if (expectsAudio) {
      if (!AudioContextClass) {
        audioStartError = new Error('この端末では動画音声に必要なWeb Audioを利用できません。');
      } else {
        try {
          audioContext = new AudioContextClass();
          try {
            const resumeResult = audioContext.resume?.();
            if (resumeResult?.then) {
              audioResumeResult = Promise.resolve(resumeResult).then(() => null, error => error);
            }
          } catch (error) {
            audioStartError = error instanceof Error ? error : new Error(String(error));
          }
        } catch (error) {
          audioStartError = error instanceof Error ? error : new Error(String(error));
        }
      }
    }

    onApprove({ audioContext, audioStartError, audioResumeResult });
    return true;
  };

  const cancel = () => {
    if (settled) return false;
    settled = true;
    onCancel();
    return true;
  };

  return { approve, cancel };
}
