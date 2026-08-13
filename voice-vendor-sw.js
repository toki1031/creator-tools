/* Creator OS Voice Lab vendor bridge v2
 * Safari対策: ONNX Runtime Webをcdnjsから初回取得し、同一オリジンURLとしてCache Storageへ固定する。
 * 以後はキャッシュ済みアセットを優先する。
 */
const CACHE = 'creator-os-voice-vendor-v2-ort-1.23.2';
const ORT_VERSION = '1.23.2';
const ORT_PREFIX = '/vendor/onnxruntime/';
const CDN_BASE = `https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/${ORT_VERSION}/`;

self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.includes(ORT_PREFIX)) return;
  event.respondWith(handleVendorRequest(event.request, url));
});

async function handleVendorRequest(request, url) {
  const marker = url.pathname.indexOf(ORT_PREFIX);
  const file = url.pathname.slice(marker + ORT_PREFIX.length);
  if (!file || file.includes('..')) return new Response('Invalid vendor path', {status:400});

  const cache = await caches.open(CACHE);
  const cacheKey = new Request(new URL(`${ORT_PREFIX}${file}`, self.location.origin).href, {method:'GET'});
  const cached = await cache.match(cacheKey, {ignoreSearch:true});
  if (cached) return cached;

  const upstream = `${CDN_BASE}${file}`;
  let response;
  try {
    response = await fetch(upstream, {mode:'cors', cache:'no-store'});
  } catch (error) {
    return new Response(`Vendor fetch failed: ${error?.message || error}`, {status:502});
  }
  if (!response.ok) return new Response(`Vendor upstream ${response.status}: ${upstream}`, {status:502});

  // 同一オリジン配信用レスポンスとして再構成。MIMEも明示。
  const body = await response.arrayBuffer();
  const headers = new Headers();
  const isWasm = file.endsWith('.wasm');
  headers.set('Content-Type', isWasm ? 'application/wasm' : 'application/javascript; charset=utf-8');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Creator-OS-Vendor', `onnxruntime-web@${ORT_VERSION}`);
  const localResponse = new Response(body, {status:200, headers});
  try { await cache.put(cacheKey, localResponse.clone()); } catch (_) {}
  return localResponse;
}
