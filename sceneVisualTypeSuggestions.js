const normalize = value => String(value ?? '').toLowerCase().normalize('NFKC');

const TYPES = [
  { id:'person', label:'人物・表情', keywords:['人物','人','顔','表情','本人','彼','彼女','肖像','生まれ','人生','語った','笑','泣'] },
  { id:'hands', label:'手元・作業', keywords:['手元','作業','作る','制作','描く','書く','組み立て','料理','加工','操作','工程','職人','練習'] },
  { id:'work', label:'作品・製品', keywords:['作品','製品','商品','完成','絵','絵画','写真','本','道具','機械','車','建物','成果'] },
  { id:'place', label:'場所・風景', keywords:['場所','風景','景色','街','町','村','山','海','川','神社','寺','工場','店','会場','故郷','生まれた地'] },
  { id:'map', label:'地図・位置関係', keywords:['地図','位置','場所は','どこ','移動','進軍','ルート','距離','県','市','国','地域','東','西','南','北'] },
  { id:'document', label:'資料・史料・テキスト', keywords:['資料','史料','記録','文書','新聞','手紙','日記','数字','データ','年表','引用','言葉','名言','年','月','日'] },
  { id:'abstract', label:'抽象イメージ', keywords:['夢','希望','不安','成長','挑戦','努力','未来','変化','心','思い','価値','自由','時間','人生'] }
];

function feedbackStats(projects, typeId) {
  let accepted = 0, rejected = 0;
  for (const project of Array.isArray(projects) ? projects : []) {
    const decisions = Array.isArray(project?.learning?.decisions) ? project.learning.decisions : [];
    for (const record of decisions) {
      if (record?.decisionType !== 'scene-visual-type-suggestion') continue;
      if (String(record?.proposal?.visualTypeId || '') !== typeId) continue;
      if (record?.finalDecision?.accepted === true) accepted++;
      if (record?.finalDecision?.accepted === false) rejected++;
    }
  }
  return { accepted, rejected, adjustment: Math.min(15, accepted * 3) - Math.min(12, rejected * 3) };
}

export function suggestSceneVisualTypes(scene, projects = [], { limit = 3 } = {}) {
  const text = normalize([scene?.text, scene?.speechText, scene?.subtitleText].filter(Boolean).join(' '));
  if (!text.trim()) return [];
  return TYPES.map(type => {
    const hits = type.keywords.filter(keyword => text.includes(normalize(keyword)));
    const feedback = feedbackStats(projects, type.id);
    const baseScore = hits.length ? 30 + Math.min(50, hits.length * 14) : 0;
    const score = Math.max(0, Math.min(100, baseScore + feedback.adjustment));
    return {
      typeId: type.id,
      label: type.label,
      score,
      matchedKeywords: hits,
      accepted: feedback.accepted,
      rejected: feedback.rejected,
      reason: hits.length
        ? `Scene本文の「${hits.slice(0,3).join('・')}」から、${type.label}の映像が内容を伝えやすい候補です。`
        : `過去の判断傾向から${type.label}を候補にしています。`
    };
  }).filter(item => item.score >= 18)
    .sort((a,b) => b.score - a.score || b.matchedKeywords.length - a.matchedKeywords.length)
    .slice(0, Math.max(1, Number(limit) || 3));
}
