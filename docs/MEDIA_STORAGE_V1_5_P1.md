# Creator OS v1.5 P1 — Media Storage audit

Issue: #239

## Purpose
Large media is currently embedded directly inside the project object as Data URLs. v1.5 will separate media bytes from project metadata without breaking existing projects.

## Current embedded media paths confirmed

### Images
- New Scene image uploads are read as Data URLs in `main.js`.
- `mediaLibrary.js` stores image bytes in `mediaLibrary[].data`.
- Older projects may still contain `scene.imageData`.
- `resolveSceneImageSource()` currently prefers `mediaLibrary[].data` and falls back to legacy `scene.imageData`.

### BGM
- `main.js` reads uploaded audio with `FileReader.readAsDataURL()`.
- The result is stored in `project.bgm.audioData`.

### Narration
- Scene narration is still detected through `scene.narration.audioData` throughout the current UI/render path.
- The legacy whole-project narration shape still exists as `project.narration.audioData` for compatibility.
- `voice-lab.js` still has a legacy registration path that writes generated WAV data to `project.narration.audioData`; this must not be silently deleted while v1.5 is introduced.

### Persistence
- `db.js` persists the project object as one IndexedDB project record.
- Therefore any embedded image/audio Data URL increases the size of the project record itself.

## P1 MediaRef decision
Introduce a small metadata-only reference object:

```js
{
  version: 1,
  id: 'media-...',
  kind: 'image' | 'scene-narration' | 'bgm' | 'narration' | 'video',
  mimeType: 'image/png',
  bytes: 123456,
  fileName: 'example.png'
}
```

`mediaRef.js` is intentionally pure in P1. It does not change IndexedDB, schemaVersion, DB_VERSION, existing project saves, or rendering.

## Dual-read policy
1. If a valid MediaRef is present, prefer it.
2. Otherwise continue to accept the existing Data URL field.
3. Do not delete legacy Data URLs until the referenced media has been written and read back successfully.
4. Never make an existing project depend on a migration completing during page boot.

## Safety constraints
- No DB reset.
- No destructive migration.
- No bulk conversion during startup.
- Existing backup JSON must remain readable.
- v1.4 Render Job / dedicated render page must continue to work.
- Hokusai ~30MB project remains the primary regression fixture.

## Next implementation slice
P2 should add a separate local media store behind an API such as `putMedia`, `getMedia`, and `deleteMedia`, then integrate only one media type first. Recommended first target: newly uploaded Scene images, because image selection already has a stable asset ID layer through `mediaLibrary`.
