export const PRODUCTION_STAGE_LABELS = Object.freeze({
  project: '台本・基本設定',
  scenes: 'Scene・素材',
  'subtitles-bgm': '字幕・BGM',
  output: '動画出力',
  publish: '公開情報'
});

export function productionStageLabel(stage) {
  return PRODUCTION_STAGE_LABELS[String(stage || '')] || String(stage || '不明');
}
