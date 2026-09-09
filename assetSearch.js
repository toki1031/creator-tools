const normalize = value => String(value ?? '').toLowerCase().normalize('NFKC').replace(/[\s_\-./\\]+/g, ' ').trim();
const words = value => [...new Set(normalize(value).split(' ').flatMap(part => part.split(/(?=[A-Za-z0-9])|(?<=[A-Za-z0-9])/)).map(v => v.trim()).filter(v => v.length >= 2))];

function stripExtension(value) {
  return normalize(value).replace(/\.[a-z0-9]{1,8}$/i, '').trim();
}

function assetTerms(asset) {
  const values = [
    stripExtension(asset?.fileName),
    asset?.name,
    asset?.title,
    ...(Array.isArray(asset?.tags) ? asset.tags : [asset?.tags]),
    asset?.note,
    asset?.description,
    asset?.source
  ];
  return [...new Set(values.map(normalize).filter(value => value.length >= 2))];
}

function assetText(asset) {
  return assetTerms(asset).join(' ');
}

export function rankAssetsForText(query, assets = [], { limit = 5 } = {}) {
  const q = normalize(query);
  const tokens = words(query);
  if (!q || !Array.isArray(assets)) return [];

  return assets
    .filter(asset => asset?.type === 'image' && asset?.id)
    .map((asset, index) => {
      const haystack = assetText(asset);
      const terms = assetTerms(asset);
      let score = 0;
      if (haystack === q) score += 100;
      if (haystack.includes(q)) score += 40;

      // Japanese text often has no spaces. Match each explicit metadata term
      // against the Scene query so tags such as 「葛飾北斎」「浮世絵」 still work.
      for (const term of terms) {
        if (q.includes(term)) score += term === stripExtension(asset?.fileName) ? 14 : 18;
      }
      for (const token of tokens) {
        if (haystack.includes(token)) score += 8;
        if (stripExtension(asset?.fileName).includes(token)) score += 4;
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
