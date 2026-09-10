import { rankAssetsForText } from './assetSearch.js';
import { suggestBrollFromDataset } from './datasetBrollSuggestions.js';

const TERMS = {
  person:['人物','顔','表情','肖像','ポートレート'],
  hands:['手元','作業','制作','工程','職人'],
  work:['作品','製品','商品','完成品'],
  place:['場所','風景','景色','街','建物'],
  map:['地図','位置','ルート','地域'],
  document:['資料','史料','文書','新聞','手紙','記録'],
  abstract:['抽象','イメージ','象徴','雰囲気']
};

const text = value => String(value ?? '').trim();

export function visualTypeSearchTerms(suggestion) {
  const base = TERMS[String(suggestion?.typeId || '')] || [];
  return [...new Set([text(suggestion?.label), ...(Array.isArray(suggestion?.matchedKeywords) ? suggestion.matchedKeywords.map(text) : []), ...base].filter(Boolean))];
}

export function findAssetsForVisualType(project, scene, suggestion, { limit = 4 } = {}) {
  const sceneText = [scene?.text, scene?.speechText, scene?.subtitleText].filter(Boolean).join(' ');
  const terms = visualTypeSearchTerms(suggestion);
  const query = [sceneText, ...terms].filter(Boolean).join(' ');
  const assets = Array.isArray(project?.mediaLibrary) ? project.mediaLibrary : [];
  const byId = new Map(assets.map(asset => [String(asset?.id || ''), asset]));
  return rankAssetsForText(query, assets, { limit }).map(item => {
    const asset = byId.get(String(item.assetId)) || {};
    return {
      source:'current-project',
      assetId:item.assetId,
      score:item.score,
      label:text(asset.title || asset.name || asset.fileName || '画像素材'),
      tags:Array.isArray(asset.tags) ? asset.tags.map(text).filter(Boolean) : [],
      reason:`${text(suggestion?.label) || '映像タイプ'}とScene本文に合う素材情報が見つかりました。`
    };
  });
}

export function findDatasetExamplesForVisualType(project, scene, suggestion, projects, { limit = 4 } = {}) {
  const terms = visualTypeSearchTerms(suggestion).map(v => v.toLowerCase());
  return suggestBrollFromDataset(project, scene, projects, { limit: Math.max(limit * 3, 8) })
    .map(item => {
      const label = `${item.assetLabel || ''} ${item.evidenceSceneText || ''}`.toLowerCase();
      const typeHits = terms.filter(term => label.includes(term.toLowerCase()));
      const bonus = Math.min(18, typeHits.length * 6);
      return { ...item, typeHits, bridgeScore:item.score + bonus };
    })
    .filter(item => item.typeHits.length > 0 || item.score >= 35)
    .sort((a,b) => b.bridgeScore - a.bridgeScore || b.score - a.score)
    .slice(0, Math.max(1, Number(limit) || 4))
    .map(item => ({
      source:'dataset',
      assetId:item.assetId,
      score:item.bridgeScore,
      label:item.assetLabel || '過去のB-roll',
      evidenceProjectTitle:item.evidenceProjectTitle,
      evidenceSceneText:item.evidenceSceneText,
      reusableInCurrentProject:Boolean(item.reusableInCurrentProject),
      reason:item.typeHits.length
        ? `過去の採用例が「${text(suggestion?.label)}」の方向と一致しています。`
        : `似たSceneで過去に採用された実例です。`
    }));
}

export function buildVisualAssetBridge(project, scene, suggestion, projects = [], options = {}) {
  return {
    visualType:{ typeId:text(suggestion?.typeId), label:text(suggestion?.label) },
    currentAssets:findAssetsForVisualType(project, scene, suggestion, options),
    datasetExamples:findDatasetExamplesForVisualType(project, scene, suggestion, projects, options)
  };
}
