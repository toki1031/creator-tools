export const PRESET_LIST_KEY='creator-os-production-presets-v2';
export const LEGACY_PRESET_KEY='creator-os-production-preset-v1';

function parse(value,fallback){try{return JSON.parse(value)}catch{return fallback}}
export function readProductionPresets(storage=localStorage){
  const current=parse(storage.getItem(PRESET_LIST_KEY)||'[]',[]);
  if(Array.isArray(current)&&current.length) return current.filter(Boolean);
  const legacy=parse(storage.getItem(LEGACY_PRESET_KEY)||'null',null);
  return legacy?[legacy]:[];
}
export function writeProductionPresets(presets,storage=localStorage){
  const clean=(Array.isArray(presets)?presets:[]).filter(Boolean).slice(-20);
  storage.setItem(PRESET_LIST_KEY,JSON.stringify(clean));
  return clean;
}
export function upsertProductionPreset(preset,storage=localStorage){
  if(!preset) return readProductionPresets(storage);
  const name=String(preset.name||'制作プリセット').trim()||'制作プリセット';
  const current=readProductionPresets(storage);
  const next=[...current.filter(item=>String(item?.name||'')!==name),{...preset,name,updatedAt:new Date().toISOString()}];
  return writeProductionPresets(next,storage);
}
export function removeProductionPreset(name,storage=localStorage){
  return writeProductionPresets(readProductionPresets(storage).filter(item=>String(item?.name||'')!==String(name||'')),storage);
}
