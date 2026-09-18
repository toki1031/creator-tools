import { createMediaRef } from './mediaRef.js';

const MEDIA_DB_NAME = 'creator-os-media';
const MEDIA_DB_VERSION = 1;
const MEDIA_STORE = 'media';

function clean(value = '') {
  return String(value ?? '').trim();
}

export function mediaStorageKey(projectId, mediaId) {
  const project = clean(projectId);
  const media = clean(mediaId);
  return project && media ? `${project}::${media}` : '';
}

export function createMediaRecord({ projectId, mediaId, kind = 'other', blob } = {}) {
  const key = mediaStorageKey(projectId, mediaId);
  if (!key || !blob || typeof blob.size !== 'number' || blob.size < 0) return null;
  const ref = createMediaRef({
    id: clean(mediaId),
    kind,
    mimeType: clean(blob.type),
    sizeBytes: blob.size
  });
  if (!ref) return null;
  return { key, projectId: clean(projectId), mediaId: ref.id, ref, blob };
}

function openMediaDb(indexedDb = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    if (!indexedDb?.open) return reject(new Error('このブラウザではメディア保存を利用できません。'));
    const request = indexedDb.open(MEDIA_DB_NAME, MEDIA_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(MEDIA_STORE)) db.createObjectStore(MEDIA_STORE, { keyPath: 'key' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('メディアデータベースを開けませんでした。'));
    request.onblocked = () => reject(new Error('メディアデータベースが他のタブによりブロックされています。'));
  });
}

function runRequest(db, mode, action) {
  return new Promise((resolve, reject) => {
    let result;
    const tx = db.transaction(MEDIA_STORE, mode);
    const request = action(tx.objectStore(MEDIA_STORE));
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(request.error || tx.error);
    tx.oncomplete = () => { try { db.close(); } catch {} resolve(result); };
    tx.onerror = () => { try { db.close(); } catch {} reject(tx.error || request.error); };
    tx.onabort = () => { try { db.close(); } catch {} reject(tx.error || request.error || new Error('メディア保存処理が中断されました。')); };
  });
}

export async function putMedia({ projectId, mediaId, kind = 'other', blob, indexedDb } = {}) {
  const record = createMediaRecord({ projectId, mediaId, kind, blob });
  if (!record) return { status: 'blocked', reason: '保存するメディア情報が不正です', mediaRef: null };
  try {
    const db = await openMediaDb(indexedDb);
    await runRequest(db, 'readwrite', store => store.put(record));
    return { status: 'stored', mediaRef: record.ref };
  } catch (error) {
    return { status: 'error', reason: clean(error?.message) || 'メディアを保存できませんでした', errorName: clean(error?.name), mediaRef: null };
  }
}

export async function getMedia({ projectId, mediaId, indexedDb } = {}) {
  const key = mediaStorageKey(projectId, mediaId);
  if (!key) return { status: 'blocked', reason: '読み出すメディア情報が不正です', mediaRef: null, blob: null };
  try {
    const db = await openMediaDb(indexedDb);
    const record = await runRequest(db, 'readonly', store => store.get(key));
    if (!record?.ref || !record?.blob) return { status: 'missing', reason: '保存済みメディアが見つかりません', mediaRef: null, blob: null };
    return { status: 'resolved', mediaRef: record.ref, blob: record.blob };
  } catch (error) {
    return { status: 'error', reason: clean(error?.message) || 'メディアを読み出せませんでした', errorName: clean(error?.name), mediaRef: null, blob: null };
  }
}

export async function deleteMedia({ projectId, mediaId, indexedDb } = {}) {
  const key = mediaStorageKey(projectId, mediaId);
  if (!key) return { status: 'blocked', reason: '削除するメディア情報が不正です' };
  try {
    const db = await openMediaDb(indexedDb);
    await runRequest(db, 'readwrite', store => store.delete(key));
    return { status: 'deleted' };
  } catch (error) {
    return { status: 'error', reason: clean(error?.message) || 'メディアを削除できませんでした', errorName: clean(error?.name) };
  }
}

export { MEDIA_DB_NAME, MEDIA_DB_VERSION, MEDIA_STORE };
