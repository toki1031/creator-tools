import { extractImageVisualFeatures } from './imageVisualFeatures.js';
import { isImageDataUrl } from './mediaLibrary.js';

function positiveInteger(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

export async function buildImageVisualFeatureMap(mediaLibrary = [], decodeImageData, options = {}) {
  const source = Array.isArray(mediaLibrary) ? mediaLibrary : [];
  const maxAssets = Math.min(200, positiveInteger(options.maxAssets, 50));
  const maxSamples = positiveInteger(options.maxSamples, 4096);
  const featuresByAssetId = {};
  const seenIds = new Set();
  let eligibleAssets = 0;
  let processedAssets = 0;
  let skippedAssets = 0;
  let failedAssets = 0;

  if (typeof decodeImageData !== 'function') {
    return {
      featureMapVersion: '0.65',
      summary: { inputAssets: source.length, eligibleAssets: 0, processedAssets: 0, skippedAssets: source.length, failedAssets: 0, maxAssets },
      featuresByAssetId
    };
  }

  for (const asset of source) {
    const assetId = typeof asset?.id === 'string' ? asset.id.trim() : '';
    if (!assetId || seenIds.has(assetId) || asset?.type !== 'image' || !isImageDataUrl(asset?.data)) {
      skippedAssets += 1;
      continue;
    }
    seenIds.add(assetId);
    eligibleAssets += 1;
    if (processedAssets >= maxAssets) {
      skippedAssets += 1;
      continue;
    }

    try {
      const imageData = await decodeImageData(asset.data, assetId);
      const features = extractImageVisualFeatures(imageData, { maxSamples });
      if (!features) {
        failedAssets += 1;
        continue;
      }
      featuresByAssetId[assetId] = features;
      processedAssets += 1;
    } catch {
      failedAssets += 1;
    }
  }

  return {
    featureMapVersion: '0.65',
    summary: {
      inputAssets: source.length,
      eligibleAssets,
      processedAssets,
      skippedAssets,
      failedAssets,
      maxAssets
    },
    featuresByAssetId
  };
}
