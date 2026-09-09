const KEY_PREFIX = 'creator-os-project-snapshots-v1:';
const MAX_SNAPSHOTS = 5;

function key(projectId) {
  return `${KEY_PREFIX}${String(projectId || '')}`;
}

export function readProjectSnapshots(projectId, storage = globalThis.localStorage) {
  if (!projectId || !storage) return [];
  try {
    const parsed = JSON.parse(storage.getItem(key(projectId)) || '[]');
    return Array.isArray(parsed) ? parsed.filter(item => item?.version === 1 && String(item?.projectId) === String(projectId)) : [];
  } catch {
    return [];
  }
}

export function saveProjectSnapshot(snapshot, storage = globalThis.localStorage) {
  if (!snapshot?.projectId || !storage) return [];
  const current = readProjectSnapshots(snapshot.projectId, storage);
  const next = [snapshot, ...current].slice(0, MAX_SNAPSHOTS);
  storage.setItem(key(snapshot.projectId), JSON.stringify(next));
  return next;
}

export function removeProjectSnapshot(projectId, createdAt, storage = globalThis.localStorage) {
  if (!projectId || !createdAt || !storage) return [];
  const next = readProjectSnapshots(projectId, storage).filter(item => item.createdAt !== createdAt);
  storage.setItem(key(projectId), JSON.stringify(next));
  return next;
}

export { MAX_SNAPSHOTS };
