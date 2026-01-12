type RuntimeConfig = {
  API_BASE_URL?: string;
};

const DEFAULT_API_BASE_URL = 'https://api.burrito.deway.fr';
const LOCALHOST_API_BASE_URL = 'http://localhost:3000';

function normalizeBaseUrl(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}

export function getApiBaseUrl(): string {
  const env = (globalThis as { __env?: RuntimeConfig }).__env;
  if (env?.API_BASE_URL) {
    return normalizeBaseUrl(env.API_BASE_URL.trim());
  }

  if (typeof process !== 'undefined' && process?.env?.API_BASE_URL) {
    return normalizeBaseUrl(process.env.API_BASE_URL.trim());
  }

  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return LOCALHOST_API_BASE_URL;
    }
  }

  return DEFAULT_API_BASE_URL;
}
