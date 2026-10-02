const FREE_GENERATION_TYPES = new Set(['ai-reconstruction','modern-visual']);
export const FREE_IMAGE_MODEL = '@cf/black-forest-labs/flux-1-schnell';
export const FREE_IMAGE_PROMPT_MAX_CHARS = 2048;

const clean = value => String(value ?? '').replace(/\s+/g,' ').trim();
const clip = (value, max) => Array.from(clean(value)).slice(0,max).join('');

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
  const common = [
    'Create one realistic vertical 9:16 documentary scene image for a YouTube Short.',
    'Follow the scene description literally and keep the main subject, place, era, objects, and action clearly visible.',
    'Do not add readable text, captions, letters, logos, watermarks, signs, labels, interface elements, or decorative typography.'
  ];
  const typeGuidance = requestedType === 'ai-reconstruction'
    ? [
        'Style: photorealistic historical documentary reconstruction, not an archival photograph.',
        'Use historically plausible clothing, architecture, furniture, documents, medical or work environment, lighting, and materials for the described era.',
        'Do not introduce fantasy, anime, cartoon styling, monsters, magical creatures, magic, science fiction, or fantasy weapons unless the scene explicitly requests them.'
      ]
    : [
        'Style: photorealistic contemporary documentary or editorial photograph.',
        'Use present-day people, clothing, furniture, workplace, meeting, documents, and technology when the scene describes them.',
        'Do not introduce anime, cartoon styling, fantasy, monsters, magical creatures, magic, science fiction, historical costumes, or fantasy weapons unless the scene explicitly requests them.'
      ];
  const parts = [
    ...common,
    ...typeGuidance,
    anchors.length ? `Important visual anchors: ${anchors.join(', ')}.` : '',
    `Scene description (Japanese, preserve its meaning exactly): ${clip(sceneIntent, 1100)}`,
    rules.length ? `Additional MUST NOT rules from the production request: ${clip(rules.join(' / '), 500)}` : '',
    'Natural composition, believable people and objects, no surreal substitutions.'
  ].filter(Boolean);
  return clip(parts.join(' '), FREE_IMAGE_PROMPT_MAX_CHARS);
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
