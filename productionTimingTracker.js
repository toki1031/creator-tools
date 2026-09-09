import { getProject, saveProject } from './db.js';
import { startProductionStage, finishProductionStage, appendProductionTiming } from './productionTiming.js';

const KEY='creator-os-production-active-stage-v1';
let committing=false;

function routeInfo() {
  const match=location.hash.match(/^#\/project\/([^/]+)(?:\/([^/]+))?/);
  if(!match) return null;
  const projectId=decodeURIComponent(match[1]);
  const sub=match[2]||'project';
  const stage=sub==='scenes'?'scenes':sub==='bgm'?'subtitles-bgm':sub==='output'?'output':sub==='publish'?'publish':sub==='ai'?'ai':'project';
  return {projectId,stage};
}
function readActive(){try{return JSON.parse(sessionStorage.getItem(KEY)||'null')}catch{return null}}
function writeActive(value){if(value)sessionStorage.setItem(KEY,JSON.stringify(value));else sessionStorage.removeItem(KEY)}

async function commitPrevious(nextInfo){
  if(committing) return;
  const previous=readActive();
  if(!previous){ if(nextInfo) writeActive({...startProductionStage(nextInfo.stage),projectId:nextInfo.projectId}); return; }
  if(nextInfo && previous.projectId===nextInfo.projectId && previous.stage===nextInfo.stage) return;
  committing=true;
  try{
    const finished=finishProductionStage(previous);
    if(previous.projectId && finished.durationMs!==null && finished.durationMs>=1000){
      const project=await getProject(previous.projectId);
      if(project){
        const safeEntry={stage:finished.stage,startedAt:finished.startedAt,finishedAt:finished.finishedAt,durationMs:finished.durationMs};
        const next=appendProductionTiming(project,safeEntry,100);
        next.updatedAt=new Date().toISOString();
        await saveProject(next);
      }
    }
    writeActive(nextInfo?{...startProductionStage(nextInfo.stage),projectId:nextInfo.projectId}:null);
  }catch(error){console.warn('Production timing was not saved',error)}
  finally{committing=false}
}

async function sync(){await commitPrevious(routeInfo())}
window.addEventListener('hashchange',()=>void sync());
void sync();
