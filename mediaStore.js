import { createMediaRef, normalizeMediaRef } from './mediaRef.js';

const ROOT_DIR = 'creator-os-media-v1';

const clean = value => String(value || '').trim();
const safeSegment = value => clean(value).replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120);

function requireProjectId(projectId) {
  const id = safeSegment(projectId);
  if (!id) throw new Error('projectId がありません。');
  return id;
}

function requireKind(kind) {
  const value = safeSegment(kind);
  if (!value) throw new Error('media kind がありません。');
  return value;
}

function createId(kind, createId) {
  const raw = clean(createId?.() || globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
  const id = safeSegment(raw);
  if (!id) throw new Error('media id を作成できません。');
  return `${requireKind(kind)}-${id}`;
}

async function getRootDirectory(rootDirectory) {
  if (rootDirectory) return rootDirectory;
  if (!globalThis.navigator?.storage?.getDirectory) throw new Error('このブラウザはローカルメディア保存に対応していません。');
  return await globalThis.navigator.storage.getDirectory();
}

async function getProjectDirectory(projectId, { rootDirectory, create = false } = {}) {
  const root = await getRootDirectory(rootDirectory);
  const store = await root.getDirectoryHandle(ROOT_DIR, { create });
  return await store.getDirectoryHandle(requireProjectId(projectId), { create });
}

export function supportsLocalMediaStore() {
  return Boolean(globalThis.navigator?.storage?.getDirectory);
}

export async function saveMediaBlob({ projectId, kind, blob, fileName = '', id = '' } = {}, options = {}) {
  if (!(blob instanceof Blob)) throw new Error('保存するメディアBlobがありません。');
  const mediaId = safeSegment(id) || createId(kind, options.createId);
  const directory = await getProjectDirectory(projectId, { rootDirectory: options.rootDirectory, create: true });
  const handle = await directory.getFileHandle(mediaId, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (error) {
    try { await writable.abort?.(); } catch {}
    throw error;
  }
  return createMediaRef({
    id: mediaId,
    kind,
    mimeType: blob.type || '',
    bytes: blob.size,
    fileName
  });
}

export async function readMediaBlob(projectId, mediaRef, options = {}) {
  const ref = normalizeMediaRef(mediaRef);
  if (!ref) return null;
  try {
    const directory = await getProjectDirectory(projectId, { rootDirectory: options.rootDirectory, create: false });
    const handle = await directory.getFileHandle(safeSegment(ref.id), { create: false });
    return await handle.getFile();
  } catch (error) {
    if (error?.name === 'NotFoundError') return null;
    throw error;
  }
}

export async function mediaBlobExists(projectId, mediaRef, options = {}) {
  return Boolean(await readMediaBlob(projectId, mediaRef, options));
}

export async function deleteMediaBlob(projectId, mediaRef, options = {}) {
  const ref = normalizeMediaRef(mediaRef);
  if (!ref) return false;
  try {
    const directory = await getProjectDirectory(projectId, { rootDirectory: options.rootDirectory, create: false });
    await directory.removeEntry(safeSegment(ref.id));
    return true;
  } catch (error) {
    if (error?.name === 'NotFoundError') return false;
    throw error;
  }
}

export const MEDIA_STORE_ROOT_DIR = ROOT_DIR;
