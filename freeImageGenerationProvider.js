const FREE_GENERATION_TYPES = new Set(['ai-reconstruction','modern-visual']);
export const FREE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const FREE_IMAGE_PROMPT_MAX_CHARS = 2048;

const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
const clip = (value, max) => Array.from(clean(value)).slice(0,max).join('');

function historicalEnvironmentGuidance() {
  return [
    'POSITIVE PERIOD ENVIRONMENT: depict a room and built environment made from materials, construction methods, fixtures, furnishings, and illumination that plausibly belong to the stated historical era and place.',
    'Prefer period-plausible daylight, window light, candlelight, oil-lamp or gas-lamp ambience only when appropriate to the stated era and place; use historically plausible ceilings, walls, floors, windows, doors, furniture, textiles, tools, and containers.',
    'When the scene is indoors, make the architecture itself visibly historical rather than placing historical clothing inside a contemporary room.'
  ];
}

function sceneAnchors(value = '') {
  const text = clean(value);
  const anchors = [];
  const add = label => { if (!anchors.includes(label)) anchors.push(label); };
  if (/ナイチンゲール|nightingale/i.test(text)) add('Florence Nightingale');
  if (/19世紀|nineteenth[- ]century/i.test(text)) add('19th-century');
  if (/クリミア|crimean/i.test(text)) add('Crimean War era');
  if (/軍病院|病院|hospital/i.test(text)) add('hospital ward');
  if (/記録|報告書|records?|reports?/i.test(text)) add('paper records and reports');
  if (/統計|死亡記録|グラフ|図表|chart|diagram|statistics?/i.test(text)) add('statistical papers and charts');
  if (/机|デスク|desk/i.test(text)) add('desk with papers');
  if (/会議|議論|説明|meeting|discussion|presentation/i.test(text)) add('meeting or discussion');
  return anchors;
}

export function buildFreeImagePrompt(requirement) {
  const requestedType = clean(requirement?.requestedType);
  const sceneIntent = clean(requirement?.queryHint || requirement?.query || requirement?.prompt);
  if (!sceneIntent) return '';
  const rules = Array.isArray(requirement?.prohibitedContent)
    ? requirement.prohibitedContent.map(clean).filter(Boolean)
    : [];
  const anchors = sceneAnchors(sceneIntent);
  const historical = requestedType === 'ai-reconstruction';
  const parts = historical ? [
    'STRICT PERIOD RECONSTRUCTION. Historical authenticity overrides generic contemporary visual defaults.',
    `SCENE TO DEPICT: ${clip(sceneIntent, 900)}`,
    anchors.length ? `KEY VISUAL ANCHORS: ${anchors.join(', ')}.` : '',
    ...historicalEnvironmentGuidance(),
    'Make the setting, clothing, architecture, furniture, lighting, tools, materials, documents, and technology coherent with the period and place described above.',
    'Every visible object must be plausible for that historical context. Do not silently modernize the room, building, people, equipment, or lighting.',
    'ANACHRONISMS TO AVOID: contemporary interiors; fluorescent or LED fixtures; suspended/drop ceilings; monitors or computers; modern hospital, office, or medical equipment; plastic furniture; modern signage; contemporary clothing or protective equipment, unless explicitly required by the scene.',
    'Style: photorealistic historical documentary reconstruction, natural available or period-plausible lighting, believable people and materials; not an archival photograph.',
    'No anime, cartoon, fantasy, monsters, magic, science fiction, fantasy weapons, surreal substitutions, readable text, captions, logos, watermarks, signs, labels, interface elements, or decorative typography.',
    rules.length ? `SCENE-SPECIFIC MUST NOT: ${clip(rules.join(' / '), 300)}` : '',
    'Vertical 9:16 composition for a YouTube Short.'
  ] : [
    `SCENE TO DEPICT: ${clip(sceneIntent, 1100)}`,
    anchors.length ? `KEY VISUAL ANCHORS: ${anchors.join(', ')}.` : '',
    'Style: photorealistic contemporary documentary or editorial photograph.',
    'Use present-day people, clothing, furniture, workplace, meeting, documents, and technology when the scene describes them.',
    'No anime, cartoon, fantasy, monsters, magical creatures, magic, science fiction, historical costumes, fantasy weapons, surreal substitutions, readable text, captions, logos, watermarks, signs, labels, interface elements, or decorative typography unless explicitly requested.',
    rules.length ? `SCENE-SPECIFIC MUST NOT: ${clip(rules.join(' / '), 300)}` : '',
    'Vertical 9:16 composition for a YouTube Short.'
  ];
  return clip(parts.filter(Boolean).join(' '), FREE_IMAGE_PROMPT_MAX_CHARS);
}

export function planFreeImageGeneration(requirement, { dailyQuotaAvailable = true } = {}) {
  const requestedType = String(requirement?.requestedType || 'other');
  if (requestedType === 'historical-source' || requestedType === 'document') return { status:'blocked', provider:'cloudflare-workers-ai', paidFallback:false, reason:'実物史料・文書は生成AIへフォールバックしません' };
  if (!FREE_GENERATION_TYPES.has(requestedType)) return { status:'needs-review', provider:null, paidFallback:false, reason:'無料画像生成へ送る素材種別を確定できません' };
  if (!dailyQuotaAvailable) return { status:'free-quota-exhausted', provider:'cloudflare-workers-ai', paidFallback:false, reason:'本日の無料生成枠を使い切ったため停止しました' };
  return { status:'ready', provider:'cloudflare-workers-ai', model:FREE_IMAGE_MODEL, paidFallback:false, serverSideOnly:true, requestedType };
}

export async function requestFreeGeneratedImage(requirement, { fetchImpl = fetch, endpoint = '/api/generate-image' } = {}) {
  const plan = planFreeImageGeneration(requirement);
  if (plan.status !== 'ready') return plan;
  const prompt = buildFreeImagePrompt(requirement);
  if (!prompt) return {...plan,status:'error',reason:'画像生成プロンプトがありません'};
  let response;
  try { response = await fetchImpl(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({requestedType:plan.requestedType,prompt})}); }
  catch { return {...plan,status:'error',reason:'無料画像生成サーバーへ接続できませんでした'}; }
  let payload={}; try { payload=await response.json(); } catch {}
  if (response.status===429) return {...plan,status:'free-quota-exhausted',reason:'本日の無料生成枠を使い切ったため停止しました'};
  if (!response.ok) return {...plan,status:'error',reason:String(payload?.reason||'無料画像生成に失敗しました')};
  if (!/^data:image\/(png|jpeg|webp);base64,/i.test(String(payload?.data||''))) return {...plan,status:'error',reason:'生成画像の応答形式が不正です'};
  return {...plan,status:'resolved',asset:{id:String(payload.id||''),data:payload.data,source:'generated-ai',provider:plan.provider,model:plan.model,generated:true,requestedType:plan.requestedType,provenance:{kind:'generated',label:plan.requestedType==='ai-reconstruction'?'AI歴史再現':'AI生成画像'}}};
}
