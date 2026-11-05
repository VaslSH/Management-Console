export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type Json = Record<string, unknown> | unknown[] | string | number | boolean | null;

async function parseBody(response: Response): Promise<Json> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as Json;
  } catch {
    return text;
  }
}

export async function api<T = Json>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(`/rest/v2${path}`, {
    ...init,
    headers,
    credentials: 'include'
  });
  const body = await parseBody(response);
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && !Array.isArray(body) && 'message' in body
        ? String((body as { message?: unknown }).message)
        : response.statusText;
    throw new ApiError(response.status, message || 'Request failed');
  }
  return body as T;
}

export function rowsOf(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    for (const key of ['dataRows', 'list', 'applications', 'nodes', 'userList', 'users']) {
      if (Array.isArray(record[key])) {
        return (record[key] as unknown[]).filter((item) => item && typeof item === 'object') as Record<string, unknown>[];
      }
    }
  }
  return [];
}

export function namesOf(data: unknown): string[] {
  if (Array.isArray(data)) {
    return data.map((item) => (typeof item === 'string' ? item : String((item as { name?: string }).name || ''))).filter(Boolean);
  }
  if (data && typeof data === 'object' && Array.isArray((data as { applications?: unknown }).applications)) {
    return ((data as { applications: unknown[] }).applications || []).map(String);
  }
  return rowsOf(data)
    .map((row) => String(row.name || row.appName || ''))
    .filter(Boolean);
}

export function mediaOrigin() {
  if (typeof window === 'undefined') return '';
  if (window.location.port === '5080' || window.location.port === '5443' || window.location.port === '') {
    return window.location.origin;
  }
  const secure = window.location.protocol === 'https:';
  return `${secure ? 'https' : 'http'}://${window.location.hostname}:${secure ? '5443' : '5080'}`;
}

export function appRequest(appName: string, endpoint: string) {
  return `/request?_path=${appName}/rest/v2/${endpoint}`;
}
