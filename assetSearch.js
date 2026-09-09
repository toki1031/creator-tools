const normalize = value => String(value ?? '').toLowerCase().normalize('NFKC').replace(/[\s_\-./\\]+/g, ' ').trim();
const words = value => [...new Set(normalize(value).split(' ').flatMap(part => part.split(/(?=[A-Za-z0-9])|(?<=[A-Za-z0-9])/)).map(v => v.trim()).filter(v => v.length >= 2))];

function assetText(asset) {
  return normalize([
    asset?.fileName,
    asset?.name,
    asset?.title,
    Array.isArray(asset?.tags) ? asset.tags.join(' ') : asset?.tags,
    asset?.note,
    asset?.description,
    asset?.source
  ].filter(Boolean).join(' '));
}

export function rankAssetsForText(query, assets = [], { limit = 5 } = {}) {
  const q = normalize(query);
  const tokens = words(query);
  if (!q || !Array.isArray(assets)) return [];

  return assets
    .filter(asset => asset?.type === 'image' && asset?.id)
    .map((asset, index) => {
      const haystack = assetText(asset);
      let score = 0;
      if (haystack === q) score += 100;
      if (haystack.includes(q)) score += 40;
      for (const token of tokens) {
        if (haystack.includes(token)) score += 8;
        if (normalize(asset?.fileName).includes(token)) score += 4;
      }
      return { assetId: asset.id, score, index, reason: score > 0 ? 'Scene文と素材情報が一致' : '一致情報なし' };
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, Number(limit) || 5));
}

export function rankProjectAssetsForScene(project, scene, options) {
  const query = [scene?.text, scene?.speechText, scene?.subtitleText].filter(Boolean).join(' ');
  return rankAssetsForText(query, project?.mediaLibrary || [], options);
}
