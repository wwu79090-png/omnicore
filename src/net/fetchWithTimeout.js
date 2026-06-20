import { createOmniError } from '../core/OmniError.js';

export async function fetchWithTimeout(url, ms = 8000, options = {}) {
  const fetcher = options.fetcher || globalThis.fetch;
  if (typeof fetcher !== 'function') {
    throw createOmniError('Net', 'fetchWithTimeout requires global fetch or options.fetcher.', {
      code: 'OMNICORE_NET_FETCH_UNAVAILABLE'
    });
  }
  const timeoutMs = Math.max(0, Number(ms) || 0);
  const controller = typeof AbortController === 'function' ? new AbortController() : null;
  const externalSignal = options.signal;
  const requestOptions = { ...options };
  delete requestOptions.fetcher;
  if (controller) {
    requestOptions.signal = controller.signal;
    if (externalSignal) {
      if (externalSignal.aborted) controller.abort();
      else externalSignal.addEventListener?.('abort', () => controller.abort(), { once: true });
    }
  }

  let timeoutId = null;
  const timeout = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(createOmniError('Net', `fetchWithTimeout timed out after ${timeoutMs}ms`, {
        code: 'OMNICORE_NET_TIMEOUT',
        details: { url, timeoutMs }
      }));
      controller?.abort();
    }, timeoutMs);
  });

  try {
    return await Promise.race([
      fetcher(url, requestOptions),
      timeout
    ]);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default fetchWithTimeout;
