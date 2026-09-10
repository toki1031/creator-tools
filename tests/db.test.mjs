import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStorageError, sortProjectsByUpdatedAt } from '../db.js';
import { readFile } from 'node:fs/promises';

const dbSource = await readFile(new URL('../db.js', import.meta.url), 'utf8');

test('updatedAtがない旧projectを含んでも安全に一覧を並べ替える', () => {
  const input=[
    {id:'old',title:'旧project'},
    {id:'new',updatedAt:'2026-08-29T01:00:00.000Z'},
    {id:'mid',updatedAt:'2026-08-28T01:00:00.000Z'}
  ];
  const snapshot=structuredClone(input);
  const sorted=sortProjectsByUpdatedAt(input);
  assert.deepEqual(sorted.map(item=>item.id),['new','mid','old']);
  assert.deepEqual(input,snapshot,'元配列を変更しない');
});

test('project一覧が不正値でも空配列として扱う', () => {
  assert.deepEqual(sortProjectsByUpdatedAt(null),[]);
});

test('一覧表示はgetAllで巨大projectを一括保持せずcursorで軽量要約する', () => {
  assert.match(dbSource, /openCursor\(\)/);
  assert.match(dbSource, /projectListSummary\(cursor\.value\)/);
  assert.doesNotMatch(dbSource, /objectStore\(PROJECTS\)\.getAll\(\)/);
});

test('大容量project保存は固定8秒ではなく容量に応じて猶予を延長する', () => {
  assert.match(dbSource, /payloadBytes >= 20 \* 1024 \* 1024 \? 30000/);
  assert.match(dbSource, /payloadBytes >= 8 \* 1024 \* 1024 \? 15000/);
});

test('IndexedDB容量不足を原因と整理方法が分かるエラーへ変換する', () => {
  const source=new Error('quota');
  source.name='QuotaExceededError';
  const error=normalizeStorageError(source);
  assert.equal(error.name,'QuotaExceededError');
  assert.match(error.message,/保存容量が不足/);
  assert.match(error.message,/未使用の画像素材|不要なプロジェクト/);
  assert.match(error.message,/Webサイトデータ削除は行わない/);
});

test('容量不足以外のErrorは詳細を失わない', () => {
  const source=new Error('disk failure');
  assert.equal(normalizeStorageError(source),source);
});
