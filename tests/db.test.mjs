import test from 'node:test';
import assert from 'node:assert/strict';
import { sortProjectsByUpdatedAt } from '../db.js';

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
