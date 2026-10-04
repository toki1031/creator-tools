import { applyFinalReviewCommand } from './finalReviewCommands.js';

export function createFinalReviewHistory(initialProject, limit = 50) {
  const maxEntries = Math.max(1, Number(limit) || 50);
  let current = structuredClone(initialProject);
  let undoStack = [];
  let redoStack = [];

  const snapshot = () => structuredClone(current);
  const trim = stack => stack.length > maxEntries ? stack.slice(-maxEntries) : stack;

  const apply = command => {
    const before = snapshot();
    const result = applyFinalReviewCommand(current, command);
    if (!result.changed) return { ...result, project: snapshot() };
    current = result.project;
    undoStack = trim([...undoStack, { before, after: snapshot(), command: structuredClone(command) }]);
    redoStack = [];
    return { project: snapshot(), changed: true };
  };

  const undo = () => {
    const entry = undoStack.pop();
    if (!entry) return { project: snapshot(), changed: false };
    redoStack.push(entry);
    current = structuredClone(entry.before);
    return { project: snapshot(), changed: true, command: structuredClone(entry.command) };
  };

  const redo = () => {
    const entry = redoStack.pop();
    if (!entry) return { project: snapshot(), changed: false };
    undoStack.push(entry);
    current = structuredClone(entry.after);
    return { project: snapshot(), changed: true, command: structuredClone(entry.command) };
  };

  const replace = project => {
    current = structuredClone(project);
    undoStack = [];
    redoStack = [];
    return snapshot();
  };

  return {
    apply,
    undo,
    redo,
    replace,
    snapshot,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0
  };
}

export function createFinalReviewSaveController({ persist, delay = 450, setStatus = () => {} }) {
  let timer = 0;
  let pendingProject = null;
  let savePromise = Promise.resolve();

  const flush = () => {
    clearTimeout(timer);
    timer = 0;
    if (!pendingProject) return savePromise;
    const project = pendingProject;
    pendingProject = null;
    savePromise = savePromise.catch(() => {}).then(async () => {
      setStatus('保存中…');
      await persist(project);
      setStatus('保存済み');
    });
    return savePromise;
  };

  const schedule = project => {
    pendingProject = structuredClone(project);
    setStatus('保存中…');
    clearTimeout(timer);
    timer = setTimeout(() => { void flush().catch(() => setStatus('保存失敗')); }, Math.max(0, Number(delay) || 0));
  };

  return { schedule, flush };
}
