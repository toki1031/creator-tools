const RENDER_JOB_FILE = 'creator-os-render-job.json';

async function getRoot() {
  if (!globalThis.navigator?.storage?.getDirectory) throw new Error('この端末では専用動画生成用ストレージを利用できません。');
  return await navigator.storage.getDirectory();
}

export async function saveRenderJobEnvelope(envelope) {
  const root = await getRoot();
  const handle = await root.getFileHandle(RENDER_JOB_FILE, { create: true });
  const writable = await handle.createWritable();
  try {
    await writable.write(JSON.stringify(envelope));
    await writable.close();
  } catch (error) {
    try { await writable.abort(); } catch {}
    throw error;
  }
}

export async function loadRenderJobEnvelope() {
  const root = await getRoot();
  const handle = await root.getFileHandle(RENDER_JOB_FILE);
  const file = await handle.getFile();
  return JSON.parse(await file.text());
}

export async function removeRenderJobEnvelope() {
  try {
    const root = await getRoot();
    await root.removeEntry(RENDER_JOB_FILE);
  } catch {}
}

export { RENDER_JOB_FILE };
