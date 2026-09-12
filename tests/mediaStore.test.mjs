import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteMediaBlob, mediaBlobExists, readMediaBlob, saveMediaBlob } from '../mediaStore.js';

class MemoryFileHandle {
  constructor(name, files) { this.name = name; this.files = files; }
  async createWritable() {
    const name = this.name, files = this.files;
    let current = new Blob();
    return {
      async write(blob) { current = blob; },
      async close() { files.set(name, current); },
      async abort() { current = new Blob(); }
    };
  }
  async getFile() {
    if (!this.files.has(this.name)) { const e = new Error('missing'); e.name = 'NotFoundError'; throw e; }
    return this.files.get(this.name);
  }
}

class MemoryDirectory {
  constructor() { this.directories = new Map(); this.files = new Map(); }
  async getDirectoryHandle(name, { create = false } = {}) {
    if (!this.directories.has(name)) {
      if (!create) { const e = new Error('missing'); e.name = 'NotFoundError'; throw e; }
      this.directories.set(name, new MemoryDirectory());
    }
    return this.directories.get(name);
  }
  async getFileHandle(name, { create = false } = {}) {
    if (!this.files.has(name) && !create) { const e = new Error('missing'); e.name = 'NotFoundError'; throw e; }
    return new MemoryFileHandle(name, this.files);
  }
  async removeEntry(name) {
    if (!this.files.delete(name)) { const e = new Error('missing'); e.name = 'NotFoundError'; throw e; }
  }
}

test('save/read media blob returns metadata-only MediaRef and original Blob', async () => {
  const root = new MemoryDirectory();
  const blob = new Blob(['image-bytes'], { type: 'image/png' });
  const ref = await saveMediaBlob({ projectId:'project/1', kind:'image', blob, fileName:'scene.png' }, { rootDirectory:root, createId:()=> 'fixed-id' });
  assert.equal(ref.kind, 'image');
  assert.equal(ref.id, 'image-fixed-id');
  assert.equal(ref.mimeType, 'image/png');
  assert.equal(ref.bytes, blob.size);
  assert.equal(ref.fileName, 'scene.png');
  assert.equal('data' in ref, false);
  const restored = await readMediaBlob('project/1', ref, { rootDirectory:root });
  assert.equal(await restored.text(), 'image-bytes');
  assert.equal(await mediaBlobExists('project/1', ref, { rootDirectory:root }), true);
});

test('missing media returns null/false and delete is idempotent', async () => {
  const root = new MemoryDirectory();
  const ref = { version:1, id:'image-missing', kind:'image', mimeType:'image/png', bytes:1, fileName:'' };
  assert.equal(await readMediaBlob('p', ref, { rootDirectory:root }), null);
  assert.equal(await deleteMediaBlob('p', ref, { rootDirectory:root }), false);
});

test('delete removes only the referenced media blob', async () => {
  const root = new MemoryDirectory();
  const ref = await saveMediaBlob({ projectId:'p', kind:'image', blob:new Blob(['x'], {type:'image/png'}) }, { rootDirectory:root, createId:()=> 'x' });
  assert.equal(await deleteMediaBlob('p', ref, { rootDirectory:root }), true);
  assert.equal(await readMediaBlob('p', ref, { rootDirectory:root }), null);
});
