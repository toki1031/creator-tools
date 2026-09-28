const ROUTES={
  'historical-source':{strategy:'archive-search',provider:'library-of-congress',requiresHumanReview:false},
  document:{strategy:'archive-search',provider:'library-of-congress',requiresHumanReview:false},
  'ai-reconstruction':{strategy:'generated-image',provider:'free-generation-provider',requiresHumanReview:false},
  'modern-visual':{strategy:'generated-image',provider:'free-generation-provider',requiresHumanReview:false},
  other:{strategy:'review',provider:null,requiresHumanReview:true}
};
export function routeAssetRequirement(requirement){
  const type=String(requirement?.requestedType||'other');
  const base=ROUTES[type]||ROUTES.other;
  if(requirement?.status==='needs-review')return{...ROUTES.other,requestedType:type,reason:requirement.stopReason||'素材要件の確認が必要です'};
  return{...base,requestedType:type,reason:base.strategy==='review'?'対応する素材経路を確定できません':''};
}
