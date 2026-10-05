const PROFILES = {
  'great-person': {
    id:'great-person', label:'偉人Studio',
    researchPolicy:'史実・一次/公的資料を優先し、逸話と確認済み事実を区別する',
    scriptTone:'人物紹介だけでなく、背景・行動・結果・現代への学びを筋道立てる',
    visualDirection:'historical documentary, period-authentic, restrained, credible',
    narrationDirection:'落ち着いたドキュメンタリー調',
    reviewFocus:['史実','出典','時代考証','誇張表現']
  },
  education: {
    id:'education', label:'知育Studio',
    researchPolicy:'年齢・発達段階・安全性を優先し、健康や安全に関わる断定を避ける',
    scriptTone:'保護者や学習者が理解しやすい順序で、具体例と実践方法を簡潔に伝える',
    visualDirection:'warm educational editorial, soft natural daylight, clean home or learning environment, approachable, age-appropriate',
    narrationDirection:'やさしく明瞭で、急かさない説明調',
    reviewFocus:['年齢適合','安全性','誤解を招く表現','過度な断定']
  },
  fortune: {
    id:'fortune', label:'開運Studio',
    researchPolicy:'暦・天体・日付で確認できる情報を優先し、占術的解釈と事実を区別する',
    scriptTone:'押しつけず、日常に取り入れられる提案として伝える',
    visualDirection:'gentle nature, Japanese modern editorial, seasonal atmosphere, refined symbolic imagery',
    narrationDirection:'静かで親しみやすい案内調',
    reviewFocus:['日付','暦・天体情報','断定回避','文化表現']
  },
  sns: {
    id:'sns', label:'SNS Studio',
    researchPolicy:'依頼内容に必要な事実確認を行い、根拠のない主張を避ける',
    scriptTone:'媒体と視聴者に合わせ、冒頭で要点を明確にする',
    visualDirection:'clean contemporary editorial, subject-appropriate',
    narrationDirection:'自然で明瞭',
    reviewFocus:['目的との一致','誤情報','可読性']
  }
};
export function studioProfileIdForProject(project){
  const explicit=String(project?.studioProfileId||'').trim();
  if(PROFILES[explicit]) return explicit;
  const genre=String(project?.genre||'').trim();
  return PROFILES[genre]?genre:'sns';
}
export function getStudioProfile(projectOrId){
  const id=typeof projectOrId==='string'?(PROFILES[projectOrId]?projectOrId:'sns'):studioProfileIdForProject(projectOrId);
  return structuredClone(PROFILES[id]);
}
export function applyStudioProfile(project,id){
  if(!project||!PROFILES[id]) return project;
  return {...project,studioProfileId:id};
}
