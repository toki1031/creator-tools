const DB_NAME = "creator-os";
const DB_VERSION = 1;
const PROJECTS = "projects";
const STORAGE_TIMEOUT_MS = 8000;
const pendingProjectDecisions = new Map();

function cloneDecision(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  try {
    return typeof structuredClone === 'function'
      ? structuredClone(value)
      : JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function setBootStorageStage(message) {
  try {
    const note = document.querySelector('#app .boot p');
    if (note) note.textContent = message;
  } catch {}
}

function storageTimeoutError(stage) {
  const error = new Error(`端末保存の${stage}が${Math.round(STORAGE_TIMEOUT_MS / 1000)}秒以内に完了しませんでした。SafariのWebサイトデータは削除せず、ページを閉じてから再度お試しください。`);
  error.name = 'StorageTimeoutError';
  return error;
}

function withStorageTimeout(executor, stage) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };
    const timer = setTimeout(() => finish(reject, storageTimeoutError(stage)), STORAGE_TIMEOUT_MS);
    try {
      executor(value => finish(resolve, value), error => finish(reject, error));
    } catch (error) {
      finish(reject, error);
    }
  });
}

export function queueProjectDecision(projectId, decision) {
  const id = String(projectId || '').trim();
  const record = cloneDecision(decision);
  const decisionId = String(record?.id || '').trim();
  if (!id || !record || !decisionId) return false;
  const pending = pendingProjectDecisions.get(id) || [];
  if (pending.some(item => String(item?.id || '') === decisionId)) return false;
  pending.push(record);
  pendingProjectDecisions.set(id, pending);
  return true;
}

export function applyQueuedProjectDecisions(project) {
  const projectId = String(project?.id || '').trim();
  if (!projectId || !project || typeof project !== 'object') return [];
  const pending = pendingProjectDecisions.get(projectId) || [];
  if (!pending.length) return [];

  if (!project.learning || typeof project.learning !== 'object' || Array.isArray(project.learning)) project.learning = {};
  if (!Array.isArray(project.learning.decisions)) project.learning.decisions = [];
  const existingIds = new Set(project.learning.decisions.map(item => String(item?.id || '')).filter(Boolean));
  const queuedIds = [];

  for (const pendingRecord of pending) {
    const record = cloneDecision(pendingRecord);
    const decisionId = String(record?.id || '').trim();
    if (!record || !decisionId) continue;
    queuedIds.push(decisionId);
    if (existingIds.has(decisionId)) continue;
    project.learning.decisions.push(record);
    existingIds.add(decisionId);
  }
  return queuedIds;
}

function acknowledgeQueuedProjectDecisions(projectId, decisionIds = []) {
  const id = String(projectId || '').trim();
  const acknowledged = new Set(decisionIds.map(value => String(value || '')).filter(Boolean));
  if (!id || !acknowledged.size) return;
  const current = pendingProjectDecisions.get(id) || [];
  const remaining = current.filter(item => !acknowledged.has(String(item?.id || '')));
  if (remaining.length) pendingProjectDecisions.set(id, remaining);
  else pendingProjectDecisions.delete(id);
}

export function sortProjectsByUpdatedAt(projects) {
  const items = Array.isArray(projects) ? projects : [];
  return [...items].sort((a, b) => String(b?.updatedAt || "").localeCompare(String(a?.updatedAt || "")));
}

export function normalizeStorageError(error, fallback = '保存できませんでした。') {
  const name = String(error?.name || '');
  if (name === 'QuotaExceededError') {
    const result = new Error('端末の保存容量が不足しています。未使用の画像素材や不要なプロジェクトを整理してから再度保存してください。Creator OSのプロジェクトが消える可能性があるため、SafariのWebサイトデータ削除は行わないでください。');
    result.name = 'QuotaExceededError';
    return result;
  }
  return error instanceof Error ? error : new Error(fallback);
}

function openDb() {
  setBootStorageStage('端末データベースを開いています…');
  return withStorageTimeout((resolve, reject) => {
    if (!('indexedDB' in globalThis)) return reject(new Error('このブラウザでは端末保存を利用できません。'));
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(PROJECTS)) {
        const store = db.createObjectStore(PROJECTS, { keyPath: "id" });
        store.createIndex("updatedAt", "updatedAt");
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("データベースを開けませんでした。"));
    request.onblocked = () => reject(new Error('端末データベースが他のタブまたは古い接続によりブロックされています。開いているCreator OSのタブを閉じてから再度お試しください。'));
  }, 'データベース接続');
}

export async function listProjects() {
  const db = await openDb();
  setBootStorageStage('保存済みプロジェクトを読み込んでいます…');
  return withStorageTimeout((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readonly");
    const request = tx.objectStore(PROJECTS).getAll();
    let result = [];
    request.onsuccess = () => { result = sortProjectsByUpdatedAt(request.result); };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { try { db.close(); } catch {} reject(tx.error ?? request.error); };
    tx.onabort = () => { try { db.close(); } catch {} reject(tx.error ?? request.error ?? new Error('プロジェクト読み込みが中断されました。')); };
  }, 'プロジェクト読み込み').catch(error => {
    try { db.close(); } catch {}
    throw error;
  });
}

export async function getProject(id) {
  const db = await openDb();
  return withStorageTimeout((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readonly");
    const request = tx.objectStore(PROJECTS).get(id);
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => { db.close(); resolve(result); };
    tx.onerror = () => { try { db.close(); } catch {} reject(tx.error ?? request.error); };
    tx.onabort = () => { try { db.close(); } catch {} reject(tx.error ?? request.error ?? new Error('プロジェクト読み込みが中断されました。')); };
  }, 'プロジェクト読み込み').catch(error => {
    try { db.close(); } catch {}
    throw error;
  });
}
export async function saveProject(project) {
  const projectId = String(project?.id || '').trim();
  const queuedDecisionIds = applyQueuedProjectDecisions(project);
  const db = await openDb();
  return withStorageTimeout((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readwrite");
    const request = tx.objectStore(PROJECTS).put(project);
    let settled = false;
    const fail = error => {
      if (settled) return;
      settled = true;
      try { db.close(); } catch {}
      reject(normalizeStorageError(error));
    };
    request.onerror = () => fail(request.error || tx.error);
    tx.oncomplete = () => {
      if (settled) return;
      settled = true;
      acknowledgeQueuedProjectDecisions(projectId, queuedDecisionIds);
      db.close();
      resolve();
    };
    tx.onerror = () => fail(tx.error || request.error);
    tx.onabort = () => fail(tx.error || request.error);
  }, 'プロジェクト保存').catch(error => {
    try { db.close(); } catch {}
    throw normalizeStorageError(error);
  });
}
export async function deleteProject(id) {
  const db = await openDb();
  return withStorageTimeout((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readwrite");
    tx.objectStore(PROJECTS).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { try { db.close(); } catch {} reject(tx.error ?? new Error("削除できませんでした。")); };
    tx.onabort = () => { try { db.close(); } catch {} reject(tx.error ?? new Error("削除処理が中断されました。")); };
  }, 'プロジェクト削除').catch(error => {
    try { db.close(); } catch {}
    throw normalizeStorageError(error, '削除できませんでした。');
  });
}
