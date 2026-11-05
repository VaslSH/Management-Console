const ACCESS_KEY = 'vasl.access';
const EMAIL_KEY = 'vasl.email';

export type AccessMap = Record<string, string>;

export type Session = {
  email: string;
  access: AccessMap;
};

export function isSystemScope(scope: string | null | undefined) {
  return scope == null || scope === '' || scope === 'null' || scope === 'system';
}

export function parseAccessMessage(message: string): AccessMap {
  if (!message) return {};
  if (message.trim().startsWith('{')) {
    const parsed = JSON.parse(message) as AccessMap;
    return parsed && typeof parsed === 'object' ? parsed : {};
  }
  if (message.includes('/')) {
    const [rawScope, userType] = message.split('/');
    const scope = isSystemScope(rawScope) ? 'system' : rawScope;
    return userType ? { [scope]: userType } : { [scope]: '' };
  }
  return isSystemScope(message) ? { system: '' } : { [message]: '' };
}

export function readSession(): Session | null {
  if (typeof window === 'undefined') return null;
  if (localStorage.getItem('authenticated') !== 'true') return null;
  let access: AccessMap = {};
  try {
    access = JSON.parse(localStorage.getItem(ACCESS_KEY) || '{}') as AccessMap;
  } catch {
    access = {};
  }
  return {
    email: localStorage.getItem(EMAIL_KEY) || '',
    access
  };
}

export function writeSession(email: string, access: AccessMap) {
  localStorage.setItem('authenticated', 'true');
  localStorage.setItem(EMAIL_KEY, email);
  localStorage.setItem(ACCESS_KEY, JSON.stringify(access));
}

export function clearSession() {
  localStorage.removeItem('authenticated');
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(ACCESS_KEY);
}

export function isHostedPreview() {
  return process.env.NEXT_PUBLIC_HOSTED_PREVIEW === 'true';
}

export function hasSystemAccess(access: AccessMap) {
  return Object.prototype.hasOwnProperty.call(access, 'system');
}

export function firstApp(access: AccessMap) {
  return Object.keys(access).find((key) => key !== 'system') || '';
}
