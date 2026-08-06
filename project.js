/** @typedef {'great-person'|'education'|'fortune'|'bgm'|'other'} Genre */
/** @typedef {'youtube-shorts'|'instagram-reels'|'tiktok'} Platform */
/**
 * @typedef {Object} CreatorProject
 * @property {string} id
 * @property {string} title
 * @property {Genre} genre
 * @property {Platform} platform
 * @property {'9:16'} aspectRatio
 * @property {number} targetDurationSec
 * @property {string} displayScript
 * @property {string} speechScript
 * @property {Array} scenes
 * @property {{voiceURI:string,rate:number,pitch:number,volume:number}} narration
 * @property {{enabled:boolean,fontSize:number,position:'top'|'center'|'bottom',maxCharsPerLine:number,maxLines:number,textColor:string,outlineColor:string,outlineWidth:number,backgroundEnabled:boolean,backgroundColor:string,backgroundOpacity:number}} subtitleStyle
 * @property {string} createdAt
 * @property {string} updatedAt
 * @property {number} schemaVersion
 */
export {};
