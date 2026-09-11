from pathlib import Path

path = Path('main.js')
text = path.read_text()

import_anchor = 'import { getVideoCapabilities, getProjectDuration, validateVideoProject, prepareVideoProject, runVisualPreview, exportProjectVideo, drawProjectFrame } from "./videoRenderer.js";\n'
import_line = 'import { createRenderJob } from "./renderJob.js";\n'
if import_line not in text:
    if import_anchor not in text:
        raise SystemExit('videoRenderer import anchor not found')
    text = text.replace(import_anchor, import_anchor + import_line, 1)

old = '''    try{\n      let assets=await ensurePreparedAssets();\n      const preparedSceneNarrations=Array.isArray(assets.sceneNarrations)?assets.sceneNarrations.filter(item=>item?.arrayBuffer).length:0;\n      if((project.output?.bgmEnabled&&project.bgm?.audioData&&!assets.audioArrayBuffer)||(project.narration?.audioData&&!expectedSceneNarrations&&!assets.narrationArrayBuffer)||(expectedSceneNarrations&&preparedSceneNarrations<expectedSceneNarrations)){assets=await prepareVideoProject(project,{onStatus:text=>renderStatus.textContent=text});prepared=assets;describeAssets(assets);}\n      const result=await exportProjectVideo(project,assets,canvas,{durationLimit:limit,signal:renderController.signal,onProgress:updateProgress,onStatus:text=>renderStatus.textContent=text,audioContext:unlockedAudioContext});\n'''
new = '''    try{\n      const renderJob=createRenderJob(project);\n      prepared=null;\n      preparedPromise=null;\n      const assets=await prepareVideoProject(renderJob,{onStatus:text=>renderStatus.textContent=text});\n      describeAssets(assets);\n      const result=await exportProjectVideo(renderJob,assets,canvas,{durationLimit:limit,signal:renderController.signal,onProgress:updateProgress,onStatus:text=>renderStatus.textContent=text,audioContext:unlockedAudioContext});\n'''
if old not in text:
    if 'const renderJob=createRenderJob(project);' not in text:
        raise SystemExit('generation block anchor not found')
else:
    text = text.replace(old, new, 1)

path.write_text(text)
