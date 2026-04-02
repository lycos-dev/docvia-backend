# Frontend–Backend Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy the Docvia frontend into `frontend-src/`, wire all auth pages to the Express backend, replace sidebar mock data with live PDF list, enable real PDF uploads, and load roadmap modules from AI-generated lessons.

**Architecture:** `AuthProvider` wraps `AppRouter` from outside `RouterProvider` — it holds a JWT token in `localStorage` and exposes `login`/`logout`. A `ProtectedRoute` component (inside the router context) handles redirect-to-signin for unauthenticated users. `authService.ts` and `pdfService.ts` are thin `fetch` wrappers using relative `/api/*` URLs — no env config needed since frontend and backend are served from the same Express server on port 3000.

**Tech Stack:** React 19, TypeScript 5.9 (strict), Vite 7, React Router 7 (`createBrowserRouter`), Tailwind CSS v4, Express backend (Node.js)

---

### Task 1: Copy frontend source and configure the repo

**Files:**
- Create: `frontend-src/` (copied from original docvia-frontend)
- Modify: `frontend-src/vite.config.ts`
- Modify: `package.json` (root)
- Modify: `.gitignore`
- Modify: `.env.example`

- [ ] **Step 1: Copy the frontend source (excluding node_modules)**

Run from inside `docvia-backend/`:
```bash
cp -r "../../../Frontend/docvia-frontend" ./frontend-src
rm -rf frontend-src/node_modules
rm -rf frontend-src/.git
```

- [ ] **Step 2: Update `frontend-src/vite.config.ts` to output to `../frontend`**

Replace the entire file:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../frontend',
    emptyOutDir: true,
  },
})
```

- [ ] **Step 3: Add scripts to root `package.json`**

In root `package.json`, update the `"scripts"` section to:
```json
"scripts": {
  "start": "node backend/server.js",
  "dev": "nodemon backend/server.js",
  "install:all": "npm install && cd frontend-src && npm install",
  "build:frontend": "cd frontend-src && npm run build"
}
```

- [ ] **Step 4: Add `/frontend/` to `.gitignore`**

Append to `.gitignore`:
```
/frontend/
```

- [ ] **Step 5: Add `FRONTEND_URL` to `.env.example` and your local `.env`**

Append to `.env.example`:
```
FRONTEND_URL=http://localhost:3000
```

Add the same line to your local `.env` file (the one that is not committed). This ensures the Supabase password-reset email links back to the correct port.

- [ ] **Step 6: Install frontend dependencies**

```bash
cd frontend-src && npm install
```

Expected: Packages install with no errors.

- [ ] **Step 7: Verify the build works**

```bash
cd .. && npm run build:frontend
```

Expected: Build completes. A `frontend/` folder appears at the repo root containing `index.html` and `assets/`.

- [ ] **Step 8: Verify the server serves the frontend**

```bash
npm start
```

Open `http://localhost:3000`. Expected: The Docvia sign-in page appears in the browser.

- [ ] **Step 9: Commit**

```bash
git add frontend-src package.json .gitignore .env.example
git commit -m "feat: add frontend-src, configure Vite build output to frontend/"
```

---

### Task 2: Create `authService.ts`

**Files:**
- Create: `frontend-src/src/shared/services/authService.ts`

- [ ] **Step 1: Create the directory and file**

```bash
mkdir -p frontend-src/src/shared/services
```

Create `frontend-src/src/shared/services/authService.ts` with this content:
```ts
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors related to `authService.ts`.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/shared/services/authService.ts
git commit -m "feat: add authService — login, register, forgotPassword, resetPassword, profile, logout"
```

---

### Task 3: Create `AuthContext.tsx` and wire into `App.tsx`

**Files:**
- Create: `frontend-src/src/shared/contexts/AuthContext.tsx`
- Modify: `frontend-src/src/app/App.tsx`

> `AuthProvider` wraps `AppRouter` from OUTSIDE `RouterProvider`, so it cannot use `useNavigate`. The `logout()` function clears state only — the calling component handles navigation afterward. An `isLoading` flag prevents `ProtectedRoute` from flashing to `/signin` while the stored token is being validated on mount.

- [ ] **Step 1: Create `AuthContext.tsx`**

Create `frontend-src/src/shared/contexts/AuthContext.tsx`:
```tsx
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import * as authService from '../services/authService';

const TOKEN_KEY = 'docvia-token';

interface AuthUser {
  id: string;
  email: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const storedToken = localStorage.getItem(TOKEN_KEY);
  const [token, setToken] = useState<string | null>(storedToken);
  const [user, setUser] = useState<AuthUser | null>(null);
  // Start in loading state if there is a stored token to validate
  const [isLoading, setIsLoading] = useState(!!storedToken);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    authService.getProfile(token).then((result) => {
      if (result.success && result.data) {
        setUser({ id: result.data.user.id, email: result.data.user.email });
      } else {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
      }
      setIsLoading(false);
    });
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await authService.login(email, password);
    if (result.success && result.data) {
      localStorage.setItem(TOKEN_KEY, result.data.token);
      setToken(result.data.token);
      setUser({ id: result.data.user.id, email: result.data.user.email });
      return { success: true };
    }
    return { success: false, error: result.error ?? 'Login failed.' };
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      await authService.logout(token).catch(() => {});
    }
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, [token]);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: !!token && !!user, isLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Wrap `AppRouter` in `App.tsx`**

Replace the entire contents of `frontend-src/src/app/App.tsx`:
```tsx
import { AppRouter } from './router/router_index.tsx';
import { ThemeProvider } from '../shared/contexts/ThemeContext.tsx';
import { AuthProvider } from '../shared/contexts/AuthContext.tsx';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppRouter />
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/shared/contexts/AuthContext.tsx frontend-src/src/app/App.tsx
git commit -m "feat: add AuthContext with login/logout/isLoading, wrap AppRouter in AuthProvider"
```

---

### Task 4: Create `ProtectedRoute` and update the router

**Files:**
- Create: `frontend-src/src/app/router/ProtectedRoute.tsx`
- Modify: `frontend-src/src/app/router/router_index.tsx`

- [ ] **Step 1: Create `ProtectedRoute.tsx`**

Create `frontend-src/src/app/router/ProtectedRoute.tsx`:
```tsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Wait for the stored token to be validated before deciding
  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Replace `router_index.tsx` to guard protected routes**

Replace the entire contents of `frontend-src/src/app/router/router_index.tsx`:
```tsx
import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

import { SignInPage } from "../../features/auth/pages/SignInPage";
import { SignUpPage } from "../../features/auth/pages/SignUpPage";
import { ForgotPasswordPage } from "../../features/auth/pages/ForgotPasswordPage";
import { CreateNewPasswordPage } from "../../features/auth/pages/CreateNewPasswordPage";
import DashboardPage from "../../features/dashboard/pages/DashboardPage";
import ProgressPage from "../../features/dashboard/pages/ProgressPage";
import SettingsPage from "../../features/dashboard/pages/SettingsPage";
import RoadmapPage from "../../features/roadmap/pages/RoadmapPage";
import DashboardLayout from "../../features/dashboard/components/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/signin" replace /> },
  { path: "/signin", element: <SignInPage /> },
  { path: "/signup", element: <SignUpPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/create-new-password", element: <CreateNewPasswordPage /> },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout><DashboardPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/roadmap",
    element: (
      <ProtectedRoute>
        <RoadmapPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/progress",
    element: (
      <ProtectedRoute>
        <DashboardLayout><ProgressPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <DashboardLayout><SettingsPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  { path: "*", element: <Navigate to="/signin" replace /> },
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/app/router/ProtectedRoute.tsx frontend-src/src/app/router/router_index.tsx
git commit -m "feat: add ProtectedRoute, guard dashboard/roadmap/progress/settings"
```

---

### Task 5: Wire `SignInPage`

**Files:**
- Modify: `frontend-src/src/features/auth/pages/SignInPage.tsx`

- [ ] **Step 1: Replace `SignInPage.tsx`**

Replace the entire file:
```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { SignInForm } from '../components/SignInForm';
import type { SignInFormData } from '../types';
import { motion } from 'framer-motion';
import { useAuth } from '../../../shared/contexts/AuthContext';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(undefined);
    const result = await login(data.email, data.password);
    setIsLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error ?? 'Sign in failed. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeIn' }}
      className="min-h-screen w-full bg-background flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg">
        <div className="bg-card border border-gray-100 rounded-3xl shadow-lg px-12 py-12 select-none">
          <Logo />
          <div className="text-center mb-8">
            <h1 className="text-[35px] text-gray-800 font-medium text-shadow-md mb-2 tracking-normal leading-tight select-none">
              Welcome to Docvia
            </h1>
            <p className="text-[15px] text-text-secondary font-normal select-none">
              Turn reading into progress.
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-500 text-center mb-4">{error}</p>
          )}
          <SignInForm
            onSubmit={handleSignIn}
            onSignUpClick={() => navigate('/signup')}
            onForgotPasswordClick={() => navigate('/forgot-password')}
            isLoading={isLoading}
          />
        </div>
      </div>
    </motion.div>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/pages/SignInPage.tsx
git commit -m "feat: wire SignInPage to AuthContext.login, show inline error on failure"
```

---

### Task 6: Wire `SignUpPage`

**Files:**
- Modify: `frontend-src/src/features/auth/pages/SignUpPage.tsx`

- [ ] **Step 1: Replace `SignUpPage.tsx`**

Replace the entire file:
```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignUpForm } from '../components/SignUpForm';
import type { SignUpFormData } from '../types';
import * as authService from '../../../shared/services/authService';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const handleSignUp = async (data: SignUpFormData) => {
    setIsLoading(true);
    setError(undefined);
    const result = await authService.register(data.email, data.password, data.username);
    setIsLoading(false);
    if (result.success) {
      navigate('/signin');
    } else {
      setError(result.error ?? 'Registration failed. Please try again.');
    }
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card border rounded-2xl border-gray-100 shadow-md px-12 py-12">
          <div className="mb-8">
            <h1 className="text-[34px] text-gray-800 font-medium mb-2 tracking-normal leading-tight select-none">
              Create your account
            </h1>
            <p className="text-[15px] text-text-secondary font-normal select-none">
              Already have an account?{' '}
              <button
                onClick={() => navigate('/signin')}
                className="text-primary hover:text-primary-dark font-medium transition-colors cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-500 mb-4">{error}</p>
          )}
          <SignUpForm
            onSubmit={handleSignUp}
            onSignInClick={() => navigate('/signin')}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/pages/SignUpPage.tsx
git commit -m "feat: wire SignUpPage to authService.register, navigate to /signin on success"
```

---

### Task 7: Wire `ForgotPasswordPage`

**Files:**
- Modify: `frontend-src/src/features/auth/pages/ForgotPasswordPage.tsx`

- [ ] **Step 1: Replace `ForgotPasswordPage.tsx`**

Replace the entire file:
```tsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ForgotPasswordForm } from '../components/ForgotPasswordForm';
import type { ForgotPasswordFormData } from '../types';
import * as authService from '../../../shared/services/authService';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    await authService.forgotPassword(data.email);
    setIsLoading(false);
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-card border rounded-2xl border-gray-100 shadow-md px-12 py-12 text-center">
            <h1 className="text-3xl text-gray-800 font-medium mb-4 select-none">
              Check your inbox
            </h1>
            <p className="text-text-secondary mb-6 select-none">
              If an account exists for that email, a password reset link has been sent.
            </p>
            <button
              onClick={() => navigate('/signin')}
              className="text-primary hover:text-primary-dark font-medium transition-colors cursor-pointer"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card border rounded-2xl border-gray-100 shadow-md px-12 py-12">
          <div className="mb-6">
            <h1 className="text-4xl text-gray-800 font-medium mb-2 tracking-normal leading-tight select-none">
              Reset your password
            </h1>
          </div>
          <ForgotPasswordForm
            onSubmit={handleForgotPassword}
            onSignInClick={() => navigate('/signin')}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/pages/ForgotPasswordPage.tsx
git commit -m "feat: wire ForgotPasswordPage to authService.forgotPassword, show inbox confirmation"
```

---

### Task 8: Wire `CreateNewPasswordPage`

**Files:**
- Modify: `frontend-src/src/features/auth/pages/CreateNewPasswordPage.tsx`

- [ ] **Step 1: Replace `CreateNewPasswordPage.tsx`**

Replace the entire file:
```tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../../shared/components/ui/Input';
import { Button } from '../../../shared/components/ui/Button';
import * as authService from '../../../shared/services/authService';

export const CreateNewPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const navigate = useNavigate();

  // Supabase appends the reset token to the URL hash after the email link is clicked.
  // Format: /create-new-password#access_token=xxx&type=recovery&...
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace('#', ''));
    setAccessToken(params.get('access_token'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!accessToken) {
      setError('Reset link is invalid or expired. Please request a new one.');
      return;
    }

    setError(undefined);
    setIsLoading(true);
    const result = await authService.resetPassword(accessToken, password);
    setIsLoading(false);

    if (result.success) {
      navigate('/signin');
    } else {
      setError(result.error ?? 'Failed to reset password. Please request a new reset link.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-lg border border-gray-100 p-10">
        <h1 className="text-4xl font-medium text-gray-800 select-none">Create new password</h1>
        <p className="mt-2 text-base text-text-secondary select-none">Enter your new password below</p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4 select-none">
          <Input
            type={showPassword ? 'text' : 'password'}
            placeholder="New Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="hover:text-text-primary transition-colors focus:outline-hidden cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <Input
            type={showConfirm ? 'text' : 'password'}
            placeholder="Confirm Password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            error={error}
            disabled={isLoading}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="hover:text-text-primary transition-colors focus:outline-hidden cursor-pointer"
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
          />
          <Button type="submit" variant="primary" className="w-full mt-4" isLoading={isLoading}>
            Reset Password
          </Button>
          <div className="mt-2 text-center">
            <button
              type="button"
              onClick={() => navigate('/signin')}
              className="text-sm text-primary hover:text-primary-dark transition-colors cursor-pointer font-normal"
            >
              Back to Sign In
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/pages/CreateNewPasswordPage.tsx
git commit -m "feat: wire CreateNewPasswordPage — read token from URL hash, call authService.resetPassword"
```

---

### Task 9: Wire `UserCard` logout to `AuthContext`

**Files:**
- Modify: `frontend-src/src/features/dashboard/components/Sidebar/UserCard.tsx`

- [ ] **Step 1: Replace `UserCard.tsx`**

Replace the entire file:
```tsx
import { ChevronDown, User2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../../shared/contexts/AuthContext';

interface UserCardProps {
  isOpen: boolean;
  onToggle: () => void;
}

export default function UserCard({ isOpen, onToggle }: UserCardProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate('/signin');
  };

  return (
    <div className="relative">
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-gray-800 shadow-[0_10px_30px_rgba(0,0,0,0.12)] dark:shadow-[0_10px_30px_rgba(0,0,0,0.3)] px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-full bg-[#6f9d9c] dark:bg-teal-600 text-white grid place-items-center shrink-0">
              <User2 size={18} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">
                {user?.email ?? ''}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">
                {user?.id ? `ID: ${user.id.slice(0, 8)}…` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="rounded-lg p-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition shrink-0"
          >
            <ChevronDown
              size={16}
              className={`text-gray-600 dark:text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <>
          <div className="absolute bottom-full left-0 right-0 mb-2 bg-white dark:bg-gray-800 rounded-xl border border-black/10 dark:border-white/10 shadow-lg py-2 z-50">
            <button
              type="button"
              onClick={() => { navigate('/settings'); onToggle(); }}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
            >
              Account Settings
            </button>
            <div className="my-1 h-px bg-black/10 dark:bg-white/10" />
            <button
              type="button"
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition"
            >
              Logout
            </button>
          </div>
          <div className="fixed inset-0 z-40" onClick={onToggle} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/dashboard/components/Sidebar/UserCard.tsx
git commit -m "feat: wire UserCard logout to AuthContext.logout, display real user email"
```

---

### Task 10: Create `pdfService.ts`

**Files:**
- Create: `frontend-src/src/shared/services/pdfService.ts`

- [ ] **Step 1: Create `pdfService.ts`**

Create `frontend-src/src/shared/services/pdfService.ts`:
```ts
const BASE = '/api/pdf';

export interface PDFFile {
  filename: string;   // storage name — used as pdfId (e.g. "1234_abc_myfile.pdf")
  name: string;       // display name
  uploadedAt: string;
  sizeLabel: string;
}

export interface UploadResult {
  success: boolean;
  data?: {
    filename: string;
    originalFilename: string;
    publicUrl: string;
  };
  error?: string;
}

export interface BackendLesson {
  id: number;
  title: string;
  explanation: string;
  key_points: string[];
}

export interface LessonSet {
  id: string;
  pdfId: string;
  title: string;
  overview: string;
  lessons: BackendLesson[];
  totalLessons: number;
}

export interface LessonSetResult {
  success: boolean;
  data?: LessonSet;
  error?: string;
  message?: string;
}

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

// The backend stores files as "timestamp_randomhex_originalname.pdf".
// Strip the prefix to get a readable display name.
function toDisplayName(filename: string): string {
  return filename
    .replace(/^\d+_[a-z0-9]+_/i, '')
    .replace(/_/g, ' ')
    .replace(/\.pdf$/i, '');
}

export async function uploadPDF(file: File, token: string): Promise<UploadResult> {
  const form = new FormData();
  form.append('pdf', file);
  const res = await fetch(`${BASE}/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return res.json();
}

export async function listPDFs(): Promise<PDFFile[]> {
  const res = await fetch(`${BASE}/list`);
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) return [];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return json.data.map((raw: any): PDFFile => ({
    filename: raw.name,
    name: toDisplayName(raw.name),
    uploadedAt: raw.created_at ?? '',
    sizeLabel: raw.metadata?.size ? formatSize(raw.metadata.size) : '',
  }));
}

export async function deletePDF(
  filename: string,
  token: string
): Promise<{ success: boolean }> {
  const res = await fetch(`${BASE}/${encodeURIComponent(filename)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.json();
}

export async function generateLessons(
  pdfId: string,
  userId: string
): Promise<LessonSetResult> {
  const res = await fetch(`${BASE}/lessons/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pdfId, userId }),
  });
  return res.json();
}

export async function getLessons(pdfId: string): Promise<LessonSetResult> {
  const res = await fetch(`${BASE}/lessons/${encodeURIComponent(pdfId)}`);
  return res.json();
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/shared/services/pdfService.ts
git commit -m "feat: add pdfService — upload, list, delete, generateLessons, getLessons"
```

---

### Task 11: Wire `UploadModal` to real PDF upload

**Files:**
- Modify: `frontend-src/src/features/dashboard/components/Sidebar/UploadModal.tsx`

- [ ] **Step 1: Replace `UploadModal.tsx`**

Replace the entire file:
```tsx
import React, { useState } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { useAuth } from '../../../../shared/contexts/AuthContext';
import * as pdfService from '../../../../shared/services/pdfService';

interface UploadModalProps {
  onClose: (refreshNeeded?: boolean) => void;
}

export default function UploadModal({ onClose }: UploadModalProps) {
  const { token } = useAuth();
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };

  const uploadFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setError('Only PDF files are supported.');
      return;
    }
    if (!token) {
      setError('You must be logged in to upload files.');
      return;
    }
    setError(undefined);
    setIsUploading(true);
    const result = await pdfService.uploadPDF(file, token);
    setIsUploading(false);
    if (result.success) {
      onClose(true);
    } else {
      setError(result.error ?? 'Upload failed. Please try again.');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadFile(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="px-8 py-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-gray-100">Upload PDF</h2>
            <button
              onClick={() => onClose(false)}
              disabled={isUploading}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition disabled:opacity-50"
            >
              <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <div className="px-8 py-8">
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-12 text-center transition-colors ${
              dragActive
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
            }`}
          >
            {isUploading ? (
              <Loader2 size={48} className="mx-auto mb-4 text-blue-500 animate-spin" />
            ) : (
              <Upload size={48} className={`mx-auto mb-4 ${dragActive ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500'}`} />
            )}
            <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
              {isUploading ? 'Uploading…' : 'Drop your PDF here'}
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              PDF files only · up to 50 MB
            </p>
            {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
            <input
              type="file"
              onChange={handleFileInput}
              className="hidden"
              id="file-upload"
              accept=".pdf"
              disabled={isUploading}
            />
            <label
              htmlFor="file-upload"
              className={`inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition ${
                isUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : 'cursor-pointer'
              }`}
            >
              Browse PDF
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/dashboard/components/Sidebar/UploadModal.tsx
git commit -m "feat: wire UploadModal to pdfService.uploadPDF — PDF-only, loading state, inline error"
```

---

### Task 12: Wire Sidebar file browser to live PDF list

**Files:**
- Modify: `frontend-src/src/features/dashboard/types/sidebar.types.ts`
- Modify: `frontend-src/src/features/dashboard/components/Sidebar/index.tsx`

- [ ] **Step 1: Add `filename` field to `UploadedFile` type**

Replace the entire `frontend-src/src/features/dashboard/types/sidebar.types.ts`:
```ts
export type UploadedFile = {
  id: string;
  filename: string;
  name: string;
  uploadedAt: string;
  sizeLabel?: string;
  type?: 'pdf' | 'docx' | 'txt' | 'other';
};
```

- [ ] **Step 2: Replace `Sidebar/index.tsx`**

Replace the entire file:
```tsx
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ChevronRight, Home, FileText, Settings, Upload, Map } from 'lucide-react';
import NavItem from './NavItem';
import FileRow from './FileRow';
import UserCard from './UserCard';
import UploadModal from './UploadModal';
import * as pdfService from '../../../../shared/services/pdfService';
import type { UploadedFile } from '../../types/sidebar.types';

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isFileBrowserOpen, setIsFileBrowserOpen] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [files, setFiles] = useState<UploadedFile[]>([]);

  const navItems = [
    { icon: <Home size={16} />, label: 'Dashboard', path: '/dashboard' },
    { icon: <Map size={16} />, label: 'Roadmap', path: '/roadmap' },
    { icon: <FileText size={16} />, label: 'Progress', path: '/progress' },
    { icon: <Settings size={16} />, label: 'Settings', path: '/settings' },
  ];

  const fetchFiles = () => {
    pdfService.listPDFs().then((pdfs) => {
      setFiles(
        pdfs.map((p) => ({
          id: p.filename,
          filename: p.filename,
          name: p.name,
          uploadedAt: p.uploadedAt,
          sizeLabel: p.sizeLabel,
          type: 'pdf' as const,
        }))
      );
    });
  };

  useEffect(() => {
    fetchFiles();
  }, []);

  const handleUploadClose = (refreshNeeded?: boolean) => {
    setIsUploadModalOpen(false);
    if (refreshNeeded) fetchFiles();
  };

  const handleFileClick = (file: UploadedFile) => {
    navigate(`/roadmap?pdfId=${encodeURIComponent(file.filename)}`);
  };

  return (
    <>
      <aside className="w-64 shrink-0 bg-white dark:bg-gray-900 border-r border-black/10 dark:border-white/10 h-screen flex flex-col fixed left-0 top-0 transition-colors">
        <div className="shrink-0 px-5 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-xl overflow-hidden">
              <img src="/logo.png" alt="Docvia" className="w-full h-full object-contain" />
            </div>
            <span className="text-xl font-bold text-gray-600 dark:text-gray-300">Docvia</span>
          </div>

          <div className="mb-5">
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="w-full h-10 rounded-xl bg-[#2f7df6] dark:bg-blue-600 text-white flex items-center justify-center gap-2 text-sm font-medium shadow-sm hover:bg-[#2567cc] dark:hover:bg-blue-700 transition"
            >
              <Upload size={16} />
              Upload File
            </button>
          </div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavItem
                key={item.path}
                icon={item.icon}
                label={item.label}
                active={location.pathname === item.path}
                onClick={() => navigate(item.path)}
              />
            ))}
          </nav>

          <div className="my-6 h-px w-full bg-black/10 dark:bg-white/10" />

          <button
            type="button"
            onClick={() => setIsFileBrowserOpen((v) => !v)}
            className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ChevronRight
              size={16}
              className={`transition-transform ${isFileBrowserOpen ? 'rotate-90' : ''}`}
            />
            <span className="font-medium">File Browser</span>
          </button>
        </div>

        {isFileBrowserOpen && (
          <div className="flex-1 overflow-y-auto px-5 pb-4">
            <div className="space-y-1">
              {files.length === 0 ? (
                <p className="text-xs text-gray-400 dark:text-gray-500 px-3 py-2">
                  No PDFs uploaded yet
                </p>
              ) : (
                <ul className="space-y-1">
                  {files.map((file) => (
                    <FileRow key={file.id} file={file} onClick={() => handleFileClick(file)} />
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        {!isFileBrowserOpen && <div className="flex-1" />}

        <div className="shrink-0 px-5 py-4 border-t border-black/10 dark:border-white/10">
          <UserCard isOpen={userMenuOpen} onToggle={() => setUserMenuOpen(!userMenuOpen)} />
        </div>
      </aside>

      {isUploadModalOpen && <UploadModal onClose={handleUploadClose} />}
    </>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/features/dashboard/types/sidebar.types.ts frontend-src/src/features/dashboard/components/Sidebar/index.tsx
git commit -m "feat: wire Sidebar to live PDF list, navigate to /roadmap?pdfId= on file click"
```

---

### Task 13: Wire `RoadmapPage` to real lesson data

**Files:**
- Modify: `frontend-src/src/features/roadmap/pages/RoadmapPage.tsx`

> `RoadmapPage.tsx` is large (~430 lines). This task makes targeted, surgical edits: add imports, add a mapping helper, add state + fetch effect inside the component. All visual/layout code is untouched.

- [ ] **Step 1: Add new imports**

Open `frontend-src/src/features/roadmap/pages/RoadmapPage.tsx`. At the very top, after all existing import lines, add these three lines:
```tsx
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../shared/contexts/AuthContext';
import * as pdfService from '../../../shared/services/pdfService';
import type { BackendLesson } from '../../../shared/services/pdfService';
```

- [ ] **Step 2: Add the lesson-to-module mapping helper**

Locate the line that begins `const MODULES: Module[] = [` (around line 34). Directly ABOVE that line, insert this block:
```tsx
// ─── Lesson → Module mapping ─────────────────────────────────────────────────
const PIN_COLORS_LIST = ['#EF4444', '#F97316', '#22C55E', '#3B82F6', '#8B5CF6'];
const PIN_EMOJIS_LIST = ['🎯', '📦', '⚡', '🔍', '🏆'];

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) result.push(arr.slice(i, i + size));
  return result;
}

function mapLessonsToModules(lessons: BackendLesson[], docTitle: string): Module[] {
  return chunkArray(lessons, 5).map((group, idx) => ({
    id: `m${idx + 1}`,
    title: idx === 0 ? docTitle : `Part ${idx + 1}`,
    chapter: idx + 1,
    isCompleted: false,
    isCurrent: idx === 0,
    isLocked: idx > 1,
    percentage: 0,
    lessonsCompleted: 0,
    totalLessons: group.length,
    lessons: group.map((l) => ({
      id: String(l.id),
      title: l.title,
      isCompleted: false,
      isCurrent: false,
      durationMin: 10,
    })),
    pinColor: PIN_COLORS_LIST[idx % PIN_COLORS_LIST.length],
    pinEmoji: PIN_EMOJIS_LIST[idx % PIN_EMOJIS_LIST.length],
  }));
}
```

- [ ] **Step 3: Add state and fetch effect inside the component**

Inside the `RoadmapPage` component function body, locate the first line after `const { theme } = useTheme();`. Insert the following block immediately after it:
```tsx
const [searchParams] = useSearchParams();
const { user } = useAuth();
const pdfId = searchParams.get('pdfId');

const [modules, setModules] = useState<Module[]>(MODULES);
const [isLoadingLessons, setIsLoadingLessons] = useState(false);

useEffect(() => {
  if (!pdfId) return;

  const fetchLessons = async () => {
    setIsLoadingLessons(true);
    let result = await pdfService.getLessons(pdfId);

    // If no cached lessons exist, generate them (requires userId)
    if (!result.success && user?.id) {
      result = await pdfService.generateLessons(pdfId, user.id);
    }

    setIsLoadingLessons(false);

    if (result.success && result.data) {
      setModules(mapLessonsToModules(result.data.lessons, result.data.title));
    }
  };

  fetchLessons();
}, [pdfId, user?.id]);
```

- [ ] **Step 4: Replace `MODULES` references with `modules` in the JSX**

In the JSX/render section of `RoadmapPage`, do a find-and-replace within this file only:
- Replace every occurrence of `MODULES` (used in the JSX, not the const declaration) with `modules`

The const declaration `const MODULES: Module[] = [...]` should remain — it is now used only as the default value in `useState<Module[]>(MODULES)`.

- [ ] **Step 5: Add the loading overlay**

In the `return (` of `RoadmapPage`, locate the outermost wrapping `<div` element. Insert the following as the **first child** inside it:
```tsx
{isLoadingLessons && (
  <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/70">
    <p className="text-white text-xl font-semibold mb-2">Generating your learning roadmap…</p>
    <p className="text-white/60 text-sm">This may take a moment</p>
  </div>
)}
```

- [ ] **Step 6: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add frontend-src/src/features/roadmap/pages/RoadmapPage.tsx
git commit -m "feat: wire RoadmapPage to fetch/generate lessons from backend, map BackendLesson[] to Module[]"
```

---

### Task 14: Full build and smoke test

- [ ] **Step 1: Run full TypeScript check**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 2: Build the frontend**

```bash
cd .. && npm run build:frontend
```

Expected: Vite build completes. `frontend/index.html` and `frontend/assets/` exist at the repo root.

- [ ] **Step 3: Start the server**

```bash
npm start
```

Expected output:
```
🔄 Testing Supabase connection...
================================
🚀 Server is running on port 3000
📍 Local: http://localhost:3000
📍 Frontend: http://localhost:3000
================================
```

- [ ] **Step 4: Smoke test auth flow**

Open `http://localhost:3000` and verify:
1. Redirects to `/signin` — **pass**
2. Sign up with a new email → redirects to `/signin` — **pass**
3. Sign in with valid credentials → redirects to `/dashboard` — **pass**
4. Refresh `/dashboard` → stays on dashboard (token from localStorage persists session) — **pass**
5. Open a new tab and go to `/dashboard` without logging in → redirects to `/signin` — **pass**
6. Sign in, then click Logout in the sidebar → redirects to `/signin`, token cleared — **pass**

- [ ] **Step 5: Smoke test PDF upload and roadmap**

1. From Dashboard, click "Upload File" → modal opens showing drop zone — **pass**
2. Upload a `.pdf` file → modal closes, file appears in Sidebar file browser — **pass**
3. Try uploading a non-PDF (e.g. `.txt`) → inline error "Only PDF files are supported." appears — **pass**
4. Click a file in the Sidebar → navigates to `/roadmap?pdfId=<filename>` — **pass**
5. Roadmap shows "Generating your learning roadmap…" overlay while fetching — **pass**
6. After generation, roadmap renders real module cards from the document content — **pass**

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "chore: verified full integration build and smoke test"
```
