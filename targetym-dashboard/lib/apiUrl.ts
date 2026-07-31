const DEFAULT_API_URL = 'https://api.targetym.ai';
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Resolve the dashboard API origin once, while keeping local development
 * reachable over plain HTTP and enforcing TLS everywhere else.
 */
export function resolveApiUrl(rawUrl?: string): string {
  const candidate = (rawUrl || DEFAULT_API_URL).trim().replace(/\/+$/, '');

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return DEFAULT_API_URL;
  }

  if (LOCAL_HOSTNAMES.has(parsed.hostname)) {
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return DEFAULT_API_URL;
    }
    return parsed.toString().replace(/\/$/, '');
  }

  parsed.protocol = 'https:';
  return parsed.toString().replace(/\/$/, '');
}

export const API_URL = resolveApiUrl(process.env.NEXT_PUBLIC_API_URL);
