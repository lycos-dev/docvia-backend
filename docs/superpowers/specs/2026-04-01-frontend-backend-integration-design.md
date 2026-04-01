# Frontend–Backend Integration Design
**Date:** 2026-04-01
**Status:** Approved

---

## 1. Goal

Integrate the Docvia frontend (React + Vite) into the backend repo (`docvia-backend`) and replace all mocked auth calls with real API calls to the Express backend.

---

## 2. Repo Structure

The frontend source is copied into `frontend-src/` inside the backend repo. Vite builds its output into `frontend/`, which is already served by Express. The original `DocviaFiles/Frontend/docvia-frontend/` folder is no longer used after migration.

```
docvia-backend/
├── backend/              ← unchanged
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── config/
│   └── server.js
├── frontend-src/         ← frontend source (copied from docvia-frontend)
│   ├── src/
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts    ← build.outDir = "../frontend", emptyOutDir: true
│   └── package.json
├── frontend/             ← Vite build output (gitignored)
├── docs/
├── package.json          ← new scripts: install:all, build:frontend
├── .env.example
└── .gitignore
```

### Root `package.json` new scripts

| Script | Command |
|---|---|
| `install:all` | `npm install && cd frontend-src && npm install` |
| `build:frontend` | `cd frontend-src && npm run build` |
| `dev` | `nodemon backend/server.js` (unchanged) |
| `start` | `node backend/server.js` (unchanged) |

### `frontend-src/vite.config.ts` change

```ts
build: {
  outDir: '../frontend',
  emptyOutDir: true,
}
```

### `.gitignore` addition

```
/frontend/
```

---

## 3. API Service Layer

**New file:** `frontend-src/src/shared/services/authService.ts`

All calls use relative URLs (`/api/auth/...`) — no env variable needed since frontend and backend are served from the same Express server.

### Functions

```ts
login(email: string, password: string): Promise<AuthResult>
register(email: string, password: string, username?: string): Promise<AuthResult>
forgotPassword(email: string): Promise<{ success: boolean; message?: string; error?: string }>
resetPassword(token: string, newPassword: string): Promise<{ success: boolean; error?: string }>
getProfile(token: string): Promise<AuthResult>
logout(token: string): Promise<{ success: boolean }>
```

### `AuthResult` type (added to `frontend-src/src/features/auth/types/index.ts`)

```ts
interface AuthResult {
  success: boolean;
  data?: {
    user: { id: string; email: string; created_at: string; last_sign_in?: string };
    token: string;
  };
  error?: string;
}
```

### Username handling

`SignUpForm` collects `username`. It is included in the `register()` call body. The backend receives it and silently ignores it — no backend changes required.

---

## 4. AuthContext

**New file:** `frontend-src/src/shared/contexts/AuthContext.tsx`

Sits alongside `ThemeContext.tsx`. Provides:

```ts
interface AuthContextValue {
  user: { id: string; email: string } | null;
  token: string | null;
  isAuthenticated: boolean;
  login(email: string, password: string): Promise<void>;
  logout(): Promise<void>;
}
```

- Token persisted in `localStorage` under key `docvia-token`.
- On mount: reads token from `localStorage`, sets `isAuthenticated` accordingly.
- `logout()` clears `localStorage`, resets state, navigates to `/signin`.

### `App.tsx` wrapping order

```tsx
<ThemeProvider>       {/* outer — unchanged */}
  <AuthProvider>      {/* new inner wrapper */}
    <AppRouter />
  </AuthProvider>
</ThemeProvider>
```

---

## 5. Protected Route

**New file:** `frontend-src/src/app/router/ProtectedRoute.tsx`

```tsx
// If not authenticated → redirect to /signin
// If authenticated → render children
```

Applied to all routes under `DashboardLayout` and `/roadmap` in `router/router_index.tsx`.

---

## 6. Auth Pages — Handler Changes Only

Visual components are **not modified**. Only the `onSubmit` / handler logic in page components changes.

| Page | Current mock | Real behaviour |
|---|---|---|
| `SignInPage` | `setTimeout` → navigate `/dashboard` | Call `authService.login` → store token via `AuthContext.login` → navigate `/dashboard`; show inline error on failure |
| `SignUpPage` | `setTimeout` → mock alert | Call `authService.register` → navigate `/signin` on success; show inline error on failure |
| `ForgotPasswordPage` | `setTimeout` → navigate `/create-new-password` | Call `authService.forgotPassword` → show success message in page ("Check your inbox") — no navigation |
| `CreateNewPasswordPage` | demo `alert()` | Read `access_token` from `window.location.hash` → call `authService.resetPassword` → navigate `/signin` on success; show error on failure |

---

## 7. Password Reset Flow

The corrected end-to-end flow:

1. User submits email on `ForgotPasswordPage`
2. Backend calls Supabase `resetPasswordForEmail` with `redirectTo: http://localhost:3000/create-new-password`
3. Page shows "Check your inbox" message (stays on page)
4. User clicks email link → browser lands on `http://localhost:3000/create-new-password#access_token=<token>&...`
5. `CreateNewPasswordPage` reads `access_token` from `window.location.hash`
6. Calls `POST /api/auth/reset-password` with `{ token, newPassword }`
7. On success → navigate to `/signin`

### `.env` change required

```
FRONTEND_URL=http://localhost:3000
```

(Backend currently defaults to `http://localhost:3001` in `auth.controller.js` — this corrects the mismatch.)

---

## 8. Files Changed / Created

| File | Action |
|---|---|
| `frontend-src/` (entire folder) | Created — copy of `docvia-frontend` source |
| `frontend-src/vite.config.ts` | Modified — add `build.outDir` |
| `frontend-src/src/shared/services/authService.ts` | Created |
| `frontend-src/src/shared/contexts/AuthContext.tsx` | Created |
| `frontend-src/src/app/router/ProtectedRoute.tsx` | Created |
| `frontend-src/src/app/App.tsx` | Modified — wrap with `AuthProvider` |
| `frontend-src/src/app/router/router_index.tsx` | Modified — add `ProtectedRoute` |
| `frontend-src/src/features/auth/types/index.ts` | Modified — add `AuthResult` |
| `frontend-src/src/features/auth/pages/SignInPage.tsx` | Modified — handler only |
| `frontend-src/src/features/auth/pages/SignUpPage.tsx` | Modified — handler only |
| `frontend-src/src/features/auth/pages/ForgotPasswordPage.tsx` | Modified — handler only |
| `frontend-src/src/features/auth/pages/CreateNewPasswordPage.tsx` | Modified — handler only |
| `package.json` (root) | Modified — add `install:all`, `build:frontend` scripts |
| `.gitignore` | Modified — add `/frontend/` |
| `.env.example` | Modified — add `FRONTEND_URL=http://localhost:3000` |

---

## 9. Out of Scope

The following are explicitly **not** part of this integration and remain mocked:

- PDF upload (`UploadModal`) — UI only, no file processing
- Roadmap module data — still hardcoded in `RoadmapPage.tsx`
- Progress page — still a placeholder
- Settings page — still a placeholder
- Sidebar file browser — files don't link to documents
- Mobile sidebar collapse

---

## 10. Definition of Done

- [ ] `frontend-src/` exists in the repo with full source
- [ ] `npm run build:frontend` succeeds and populates `frontend/`
- [ ] `npm start` serves the built frontend at `http://localhost:3000`
- [ ] Sign in with a real Supabase account navigates to `/dashboard`
- [ ] Sign up creates a real Supabase account and redirects to `/signin`
- [ ] Forgot password sends a real email (verified in inbox)
- [ ] Reset password link updates the password in Supabase
- [ ] Unauthenticated users are redirected to `/signin` from protected routes
- [ ] Refreshing `/dashboard` while logged in keeps the user logged in (token from localStorage)
