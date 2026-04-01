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
  return res.json();
}

export async function register(
  email: string,
  password: string,
  username?: string
): Promise<AuthResult> {
  const res = await apiPost('/register', { email, password, username });
  return res.json();
}

export async function forgotPassword(email: string): Promise<SimpleResult> {
  const res = await apiPost('/forgot-password', { email });
  return res.json();
}

export async function resetPassword(
  token: string,
  newPassword: string
): Promise<SimpleResult> {
  const res = await apiPost('/reset-password', { token, newPassword });
  return res.json();
}

export async function getProfile(token: string): Promise<AuthResult> {
  const res = await apiGet('/profile', token);
  return res.json();
}

export async function logout(token: string): Promise<SimpleResult> {
  const res = await apiPost('/logout', {}, token);
  return res.json();
}
