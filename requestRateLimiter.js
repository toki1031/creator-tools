export function createRequestRateLimiter({
  maxRequests = 10,
  windowMs = 60_000,
  now = () => Date.now(),
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
} = {}) {
  const limit = Math.max(1, Number(maxRequests) || 10);
  const window = Math.max(1, Number(windowMs) || 60_000);
  const timestamps = [];

  return async function waitForSlot() {
    while (true) {
      const current = Number(now());
      while (timestamps.length && current - timestamps[0] >= window) timestamps.shift();
      if (timestamps.length < limit) {
        timestamps.push(current);
        return { waitedMs: 0, activeRequests: timestamps.length };
      }
      const waitMs = Math.max(1, window - (current - timestamps[0]));
      await sleep(waitMs);
    }
  };
}

export function withRateLimit(searchCandidates, waitForSlot) {
  if (typeof searchCandidates !== 'function') throw new TypeError('searchCandidates is required');
  if (typeof waitForSlot !== 'function') return searchCandidates;
  return async (...args) => {
    await waitForSlot();
    return searchCandidates(...args);
  };
}
