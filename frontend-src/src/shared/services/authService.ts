const BASE = '/api/auth';

export interface AuthUser {
  id: string;
  email: string;
  created_at: string;
  last_sign_in?: string;
}

export interface AuthResult {
  success: boolean;
  data?: {
    user: AuthUser;
    token: string;
  };
  message?: string;
  error?: string;
}

export interface SimpleResult {
  success: boolean;
  message?: string;
  error?: string;
}

// Safely parse JSON — returns a fallback error object if the body is empty or non-JSON
async function safeJson<T>(res: Response, fallback: T): Promise<T> {
  try {
    const text = await res.text();
    if (!text) return fallback;
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

async function apiPost(
  path: string,
  body: Record<string, unknown>,
  token?: string
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

async function apiGet(path: string, token: string): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function login(email: string, password: string): Promise<AuthResult> {
  const res = await apiPost('/login', { email, password });
  return safeJson<AuthResult>(res, { success: false, error: 'Server did not return a response.' });
}

export async function register(
  email: string,
  password: string,
  username?: string
): Promise<AuthResult> {
  const res = await apiPost('/register', { email, password, username });
  return safeJson<AuthResult>(res, { success: false, error: 'Server did not return a response.' });
}

export async function forgotPassword(email: string): Promise<SimpleResult> {
  const res = await apiPost('/forgot-password', { email });
  return safeJson<SimpleResult>(res, { success: false, error: 'Server did not return a response.' });
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<SimpleResult> {
  const res = await apiPost('/reset-password', { token, newPassword });
  return safeJson<SimpleResult>(res, { success: false, error: 'Server did not return a response.' });
}

export async function getProfile(token: string): Promise<AuthResult> {
  const res = await apiGet('/profile', token);
  return safeJson<AuthResult>(res, { success: false, error: 'Server did not return a response.' });
}

export async function logout(token: string): Promise<SimpleResult> {
  const res = await apiPost('/logout', {}, token);
  return safeJson<SimpleResult>(res, { success: false });
}

export async function getGoogleAuthUrl(): Promise<{ success: boolean; url?: string; error?: string }> {
  const res = await fetch(`${BASE}/google`);
  if (res.redirected) {
    return { success: true, url: res.url };
  }
  return safeJson(res, { success: false, error: 'Server did not return a response.' });
}
