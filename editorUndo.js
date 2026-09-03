const TEXT_INPUT_TYPES = new Set(['text', 'search', 'email', 'url', 'tel']);

export function isUndoableTextTarget(node) {
  const tag = String(node?.tagName || '').toUpperCase();
  if (!tag || node?.disabled || node?.readOnly) return false;
  if (tag === 'TEXTAREA') return true;
  if (tag !== 'INPUT') return false;
  const type = String(node?.type || node?.getAttribute?.('type') || 'text').toLowerCase();
  return TEXT_INPUT_TYPES.has(type);
}

export function createTextEditHistory(limit = 50) {
  const maxEntries = Math.max(1, Number(limit) || 50);
  let undoStack = [];
  let redoStack = [];

  const push = entry => {
    const before = String(entry?.before ?? '');
    const after = String(entry?.after ?? '');
    if (!entry?.target || before === after) return false;
    undoStack.push({ target: entry.target, before, after });
    if (undoStack.length > maxEntries) undoStack = undoStack.slice(-maxEntries);
    redoStack = [];
    return true;
  };

  const undo = () => {
    const entry = undoStack.pop() || null;
    if (entry) redoStack.push(entry);
    return entry;
  };

  const redo = () => {
    const entry = redoStack.pop() || null;
    if (entry) undoStack.push(entry);
    return entry;
  };

  const clear = () => { undoStack = []; redoStack = []; };
  const clearRedo = () => { redoStack = []; };
  const snapshot = () => ({ undo: [...undoStack], redo: [...redoStack] });

  return {
    push,
    undo,
    redo,
    clear,
    clearRedo,
    snapshot,
    canUndo: () => undoStack.length > 0,
    canRedo: () => redoStack.length > 0,
  };
}

export function installEditorUndo(doc = document, win = window) {
  if (!doc?.body || doc.documentElement?.dataset?.editorUndoInstalled === 'true') return null;
  doc.documentElement.dataset.editorUndoInstalled = 'true';

  const history = createTextEditHistory(50);
  let focusBefore = new WeakMap();
  let applying = false;
  let toolbar = null;
  let undoButton = null;
  let redoButton = null;

  const targetValue = target => String(target?.value ?? '');
  const activeTarget = () => isUndoableTextTarget(doc.activeElement) ? doc.activeElement : null;
  const hasPendingActiveEdit = () => {
    const target = activeTarget();
    return !!target && focusBefore.has(target) && focusBefore.get(target) !== targetValue(target);
  };

  const updateControls = () => {
    if (!undoButton || !redoButton) return;
    undoButton.disabled = !hasPendingActiveEdit() && !history.canUndo();
    redoButton.disabled = !history.canRedo();
  };

  const resetHistory = () => {
    history.clear();
    focusBefore = new WeakMap();
    updateControls();
  };

  const commitActiveEdit = () => {
    const target = activeTarget();
    if (!target || !focusBefore.has(target)) return false;
    const before = String(focusBefore.get(target) ?? '');
    const after = targetValue(target);
    if (before === after) return false;
    const pushed = history.push({ target, before, after });
    focusBefore.set(target, after);
    return pushed;
  };

  const applyEntryValue = (entry, value) => {
    const target = entry?.target;
    if (!target?.isConnected || !isUndoableTextTarget(target)) {
      resetHistory();
      return false;
    }
    const wasActive = doc.activeElement === target;
    applying = true;
    try {
      target.value = String(value ?? '');
      target.dispatchEvent(new Event('input', { bubbles: true }));
      target.dispatchEvent(new Event('change', { bubbles: true }));
      if (wasActive && typeof target.setSelectionRange === 'function') {
        const end = target.value.length;
        try { target.setSelectionRange(end, end); } catch {}
      }
      if (wasActive) focusBefore.set(target, targetValue(target));
    } finally {
      applying = false;
    }
    return true;
  };

  const performUndo = () => {
    commitActiveEdit();
    const entry = history.undo();
    if (!entry) { updateControls(); return false; }
    const applied = applyEntryValue(entry, entry.before);
    updateControls();
    return applied;
  };

  const performRedo = () => {
    const entry = history.redo();
    if (!entry) { updateControls(); return false; }
    const applied = applyEntryValue(entry, entry.after);
    updateControls();
    return applied;
  };

  const createToolbar = shell => {
    const bar = doc.createElement('div');
    bar.className = 'editor-undo-toolbar';
    bar.setAttribute('data-editor-undo-toolbar', '');
    bar.setAttribute('aria-label', '文字編集の元に戻す・やり直す');
    bar.innerHTML = '<button type="button" data-editor-undo disabled>↶ 元に戻す</button><button type="button" data-editor-redo disabled>↷ やり直す</button>';
    const steps = shell.querySelector('.steps');
    const head = shell.querySelector('.editor-head');
    if (steps) steps.insertAdjacentElement('afterend', bar);
    else if (head) head.insertAdjacentElement('afterend', bar);
    else shell.prepend(bar);
    toolbar = bar;
    undoButton = bar.querySelector('[data-editor-undo]');
    redoButton = bar.querySelector('[data-editor-redo]');
    [undoButton, redoButton].forEach(button => {
      button.addEventListener('pointerdown', event => event.preventDefault());
      button.addEventListener('mousedown', event => event.preventDefault());
    });
    undoButton.addEventListener('click', performUndo);
    redoButton.addEventListener('click', performRedo);
    updateControls();
  };

  const ensureToolbar = () => {
    const shell = doc.querySelector('.editor-shell');
    const hasEditableText = !!shell && [...shell.querySelectorAll('textarea, input')].some(isUndoableTextTarget);
    if (!shell || !hasEditableText) {
      if (toolbar?.isConnected) toolbar.remove();
      toolbar = undoButton = redoButton = null;
      return;
    }
    if (toolbar?.isConnected && toolbar.closest('.editor-shell') === shell) return;
    createToolbar(shell);
  };

  doc.addEventListener('focusin', event => {
    const target = event.target;
    if (!isUndoableTextTarget(target)) return;
    focusBefore.set(target, targetValue(target));
    updateControls();
  }, true);

  doc.addEventListener('input', event => {
    const target = event.target;
    if (!isUndoableTextTarget(target) || applying) return;
    if (!focusBefore.has(target) && doc.activeElement === target) focusBefore.set(target, targetValue(target));
    if (history.canRedo()) history.clearRedo();
    updateControls();
  }, true);

  doc.addEventListener('focusout', event => {
    const target = event.target;
    if (!isUndoableTextTarget(target) || applying || !focusBefore.has(target)) return;
    const before = String(focusBefore.get(target) ?? '');
    const after = targetValue(target);
    focusBefore.delete(target);
    history.push({ target, before, after });
    updateControls();
  }, true);

  doc.addEventListener('keydown', event => {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
    const key = String(event.key || '').toLowerCase();
    const redoShortcut = (key === 'z' && event.shiftKey) || (key === 'y' && event.ctrlKey && !event.metaKey);
    if (redoShortcut) {
      if (!history.canRedo()) return;
      event.preventDefault();
      performRedo();
      return;
    }
    if (key === 'z' && !event.shiftKey) {
      if (!hasPendingActiveEdit() && !history.canUndo()) return;
      event.preventDefault();
      performUndo();
    }
  }, true);

  win.addEventListener('hashchange', resetHistory);

  const observer = new MutationObserver(() => {
    const stacks = history.snapshot();
    const disconnected = [...stacks.undo, ...stacks.redo].some(entry => entry?.target && !entry.target.isConnected);
    if (disconnected) resetHistory();
    ensureToolbar();
  });
  observer.observe(doc.body, { childList: true, subtree: true });
  ensureToolbar();

  return { history, performUndo, performRedo, resetHistory, updateControls };
}

if (typeof document !== 'undefined' && typeof window !== 'undefined') installEditorUndo(document, window);
