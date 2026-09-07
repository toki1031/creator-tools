import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const dbSource = await readFile(new URL('../db.js', import.meta.url), 'utf8');
const bootSource = await readFile(new URL('../bootLoader.js', import.meta.url), 'utf8');

test('IndexedDB startup cannot wait forever', () => {
  assert.match(dbSource, /STORAGE_TIMEOUT_MS\s*=\s*8000/);
  assert.match(dbSource, /request\.onblocked/);
  assert.match(dbSource, /withStorageTimeout/);
  assert.match(dbSource, /端末データベースを開いています/);
  assert.match(dbSource, /保存済みプロジェクトを読み込んでいます/);
  assert.doesNotMatch(dbSource, /indexedDB\.deleteDatabase/);
  assert.doesNotMatch(dbSource, /localStorage\.clear/);
});

test('boot loader exposes a bounded startup watchdog without deleting user data', () => {
  assert.match(bootSource, /Creator OS本体を読み込んでいます/);
  assert.match(bootSource, /setTimeout/);
  assert.match(bootSource, /12000/);
  assert.match(bootSource, /起動処理が12秒以内に完了しませんでした/);
  assert.doesNotMatch(bootSource, /indexedDB\.deleteDatabase/);
  assert.doesNotMatch(bootSource, /localStorage\.clear/);
});
