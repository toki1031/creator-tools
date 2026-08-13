/* Creator OS Voice Lab vendor bridge
 * Purpose: make ONNX Runtime Web assets appear same-origin to Safari.
 * The first request is fetched from the official npm CDN and cached locally;
 * subsequent requests are served from Cache Storage.
 */
const CACHE = 'creator-os-voice-vendor-v1';
const ORT_VERSION = '1.24.0';
const ORT_PREFIX = '/vendor/onnxruntime/';
const CDN_BASE = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;

self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (!url.pathname.includes(ORT_PREFIX)) return;
  event.respondWith(handleVendorRequest(event.request, url));
});

async function handleVendorRequest(request, url) {
  const marker = url.pathname.indexOf(ORT_PREFIX);
  const file = url.pathname.slice(marker + ORT_PREFIX.length);
  if (!file || file.includes('..')) {
    return new Response('Invalid vendor path', {status: 400});
  }

  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, {ignoreSearch: true});
  if (cached) return cached;

  const upstream = `${CDN_BASE}${file}`;
  let response;
  try {
    response = await fetch(upstream, {mode: 'cors', cache: 'no-store'});
  } catch (error) {
    return new Response(`Vendor fetch failed: ${error?.message || error}`, {status: 502});
  }
  if (!response.ok) {
    return new Response(`Vendor upstream ${response.status}: ${upstream}`, {status: 502});
  }

  // Preserve upstream MIME types (application/javascript / application/wasm).
  const cloned = response.clone();
  try { await cache.put(request, cloned); } catch (_) {}
  return response;
}
