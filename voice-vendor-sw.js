/* Creator OS Voice Lab vendor bridge v3
 * Safari対策: ONNX Runtime / Piper Plus / G2P を同一オリジン仮想URLとして配信。
 * 外部CDNはService Workerだけが取得し、ブラウザのES Moduleローダーには同一オリジンとして見せる。
 */
const CACHE = 'creator-os-voice-vendor-v4-piper-0.7.0-ort-1.23.2';
const SOURCES = [
  {
    prefix: '/vendor/onnxruntime/',
    base: 'https://cdnjs.cloudflare.com/ajax/libs/onnxruntime-web/1.23.2/',
    label: 'onnxruntime-web@1.23.2'
  },
  {
    prefix: '/vendor/piper-plus/',
    base: 'https://cdn.jsdelivr.net/npm/piper-plus@0.7.0/src/',
    label: 'piper-plus@0.7.0'
  }];

self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  const source = SOURCES.find(s => url.pathname.includes(s.prefix));
  if (!source) return;
  event.respondWith(handleVendorRequest(event.request, url, source));
});

async function handleVendorRequest(request, url, source) {
  const marker = url.pathname.indexOf(source.prefix);
  const file = url.pathname.slice(marker + source.prefix.length);
  if (!file || file.includes('..')) return new Response('Invalid vendor path', {status:400});

  const cache = await caches.open(CACHE);
  const localUrl = new URL(`${source.prefix}${file}`, self.location.origin).href;
  const cacheKey = new Request(localUrl, {method:'GET'});
  const cached = await cache.match(cacheKey, {ignoreSearch:true});
  if (cached) return cached;

  const upstream = `${source.base}${file}`;
  let response;
  try {
    response = await fetch(upstream, {mode:'cors', cache:'no-store'});
  } catch (error) {
    return new Response(`Vendor fetch failed: ${source.label}: ${error?.message || error}`, {status:502});
  }
  if (!response.ok) return new Response(`Vendor upstream ${response.status}: ${upstream}`, {status:502});

  const body = await response.arrayBuffer();
  const headers = new Headers();
  const lower = file.toLowerCase();
  let contentType = 'application/javascript; charset=utf-8';
  if (lower.endsWith('.wasm')) contentType = 'application/wasm';
  else if (lower.endsWith('.json')) contentType = 'application/json; charset=utf-8';
  else if (lower.endsWith('.bin') || lower.endsWith('.onnx')) contentType = 'application/octet-stream';
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('X-Creator-OS-Vendor', source.label);
  headers.set('X-Creator-OS-Upstream', upstream);
  const localResponse = new Response(body, {status:200, headers});
  try { await cache.put(cacheKey, localResponse.clone()); } catch (_) {}
  return localResponse;
}
