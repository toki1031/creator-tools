import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const renderer=fs.readFileSync(new URL('../videoRenderer.js',import.meta.url),'utf8');
test('renderer recognizes lightweight Scene narration MediaRef',()=>{assert.match(renderer,/narration\?\.mediaRef\?\.id/);assert.match(renderer,/getMedia\(\{projectId:project\.id,\s*mediaId:meta\.mediaRef\.id\}\)/);});
test('renderer keeps lazy current-plus-next narration window',()=>{assert.match(renderer,/const primeSceneWindow = async index/);assert.match(renderer,/\[index, index \+ 1\]/);assert.match(renderer,/entry\.source\.buffer = null/);});
