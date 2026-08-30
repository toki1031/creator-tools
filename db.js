const DB_NAME = "creator-os";
const DB_VERSION = 1;
const PROJECTS = "projects";

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
  return new Promise((resolve, reject) => {
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
  });
}

export async function listProjects() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readonly");
    const request = tx.objectStore(PROJECTS).getAll();
    request.onsuccess = () => resolve(sortProjectsByUpdatedAt(request.result));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function getProject(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readonly");
    const request = tx.objectStore(PROJECTS).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}
export async function saveProject(project) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
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
    tx.oncomplete = () => { if (settled) return; settled = true; db.close(); resolve(); };
    tx.onerror = () => fail(tx.error || request.error);
    tx.onabort = () => fail(tx.error || request.error);
  });
}
export async function deleteProject(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readwrite");
    tx.objectStore(PROJECTS).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error ?? new Error("削除できませんでした。"));
  });
}
