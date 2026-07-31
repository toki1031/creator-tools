import type { CreatorProject } from "./project";

const DB_NAME = "creator-os";
const DB_VERSION = 1;
const PROJECTS = "projects";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
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

export async function listProjects(): Promise<CreatorProject[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readonly");
    const request = tx.objectStore(PROJECTS).getAll();
    request.onsuccess = () => {
      const projects = (request.result as CreatorProject[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      resolve(projects);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function getProject(id: string): Promise<CreatorProject | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readonly");
    const request = tx.objectStore(PROJECTS).get(id);
    request.onsuccess = () => resolve(request.result as CreatorProject | undefined);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

export async function saveProject(project: CreatorProject): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readwrite");
    tx.objectStore(PROJECTS).put(project);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error ?? new Error("保存できませんでした。"));
  });
}

export async function deleteProject(id: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PROJECTS, "readwrite");
    tx.objectStore(PROJECTS).delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => reject(tx.error ?? new Error("削除できませんでした。"));
  });
}
