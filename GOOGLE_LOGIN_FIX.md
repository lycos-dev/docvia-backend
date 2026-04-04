# Google Login Fix - Integration with Supabase OAuth

## Summary of Changes

This fix establishes a complete OAuth 2.0 flow for Google login using Supabase authentication. The implementation handles the entire flow from Google button click through session verification.

---

## Files Modified

### Frontend Changes

#### 1. **src/shared/utils/supabaseClient.ts** (NEW)
- Created Supabase client initialization
- Configured with environment variables: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Enabled `detectSessionInUrl: true` to automatically detect OAuth callbacks

#### 2. **src/shared/services/authService.ts** (UPDATED)
- Added `loginWithGoogle()` function that initiates Supabase OAuth
  - Redirects to Google login via Supabase
  - Sets redirect to `/auth/callback` after successful Google auth
- Added `getSession()` to retrieve current Supabase session
- Added `verifyGoogleSession()` to exchange Supabase token for JWT
  - Calls backend `/api/auth/google/verify` endpoint
  - Stores JWT in localStorage for authenticated requests

#### 3. **src/shared/contexts/AuthContext.tsx** (UPDATED)
- Updated `loginWithGoogle()` to use new `authService.loginWithGoogle()`
- Added `verifyOAuthSession()` method
  - Called after OAuth callback to verify and store JWT token
  - Updates user state when verification succeeds

#### 4. **src/features/auth/pages/OAuthCallbackPage.tsx** (NEW)
- New page component that handles OAuth redirect
- Shows loading spinner while verifying session
- Automatically redirects to dashboard on success
- Shows error message if verification fails with option to retry

#### 5. **src/app/router/router_index.tsx** (UPDATED)
- Added import for `OAuthCallbackPage`
- Added route: `{ path: "/auth/callback", element: <OAuthCallbackPage /> }`
- Callback page is public (not protected) so OAuth redirect works

#### 6. **.env.local** (NEW)
```
VITE_SUPABASE_URL=https://unqrpabmiokotjrznagf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=http://localhost:3000/api
```
- Added Supabase configuration for frontend client
- Used by `supabaseClient.ts` to initialize Supabase

#### 7. **package.json** (UPDATED)
- Added dependency: `@supabase/supabase-js: ^3.1.0`
- Run `npm install` after this change

### Backend Changes

#### 1. **controllers/auth.controller.js** (UPDATED)
- Updated `googleSignIn()` function
  - Changed `redirectTo` from `http://localhost:3001` to `${process.env.FRONTEND_URL}/auth/callback`
  - Now correctly redirects to `/auth/callback` page after Google OAuth
  - Returns OAuth URL for frontend to redirect to

---

## OAuth Flow Diagram

```
1. User clicks "Continue with Google"
   ↓
2. SignInForm calls useAuth().loginWithGoogle()
   ↓
3. authService.loginWithGoogle() initiates Supabase OAuth
   ↓
4. Supabase redirects user to Google login (external)
   ↓
5. User logs in with Google
   ↓
6. Google redirects back to: https://localhost:5173/auth/callback#access_token=...&session=...
   ↓
7. Frontend detects OAuth callback in URL
   ↓
8. OAuthCallbackPage renders and calls verifyOAuthSession()
   ↓
9. authService.verifyGoogleSession() extracts access token
   ↓
10. Sends access token to backend: POST /api/auth/google/verify
    ↓
11. Backend exchanges Supabase token for JWT
    ↓
12. Frontend receives JWT, stores in localStorage
    ↓
13. AuthContext updates user state
    ↓
14. OAuthCallbackPage redirects to /dashboard
```

---

## Key Points

### Session Handling
- **Supabase manages OAuth**: `supabase.auth.signInWithOAuth()` initiates the flow
- **Frontend stores JWT**: Our backend generates a JWT that's stored in localStorage
- **Backend verification**: `/api/auth/google/verify` validates the Supabase session and issues a JWT

### Redirect Flow
1. OAuth callback goes to `/auth/callback` (not protected)
2. OAuthCallbackPage verifies session synchronously
3. On success, redirects to `/dashboard` (protected route)
4. ProtectedRoute checks for token in localStorage

### Error Handling
- Network errors show "unexpected error" message
- Invalid sessions show "Failed to complete OAuth login"
- User can retry by clicking "Back to Sign In"

---

## Required Supabase Configuration

### In Supabase Dashboard

1. **Enable Google Provider**:
   - Go to Authentication → Providers
   - Enable "Google"
   - Add OAuth credentials from Google Cloud Console

2. **Redirect URLs**:
   - Add: `http://localhost:5173/auth/callback`
   - Add: `http://localhost:5173` (main app URL)
   - Add production URLs when deploying

3. **Environment Checks**:
   - Verify `SUPABASE_URL` is correct
   - Verify `SUPABASE_ANON_KEY` is the public anon key (not secret)

---

## Installation & Setup

### 1. Install Dependencies
```bash
cd frontend-src
npm install
```

### 2. Verify Environment Variables
Check `.env.local` has:
```
VITE_SUPABASE_URL=https://unqrpabmiokotjrznagf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. Ensure Backend is Running
```bash
cd backend
npm start
# Should be running on http://localhost:3000
```

### 4. Start Frontend
```bash
cd frontend-src
npm run dev
# Should be running on http://localhost:5173
```

---

## Testing

### Test Flow
1. Go to `http://localhost:5173/signin`
2. Click "Continue with Google"
3. Log in with Google account
4. Should redirect to dashboard after successful login

### Troubleshooting

**Issue**: "Invalid callback - no session token found"
- Check that `/auth/callback` route exists in router
- Verify `detectSessionInUrl: true` in supabaseClient.ts

**Issue**: "Failed to verify Google session"
- Check backend logs for `/google/verify` endpoint
- Verify Supabase credentials in `.env.local`
- Ensure backend is running on correct port

**Issue**: Redirect loop
- Clear localStorage (`docvia-token`)
- Clear browser cookies for localhost:5173
- Try incognito window

**Issue**: 404 on /api/auth/google/verify
- Check backend routes are loaded
- Verify `googleVerify` function is exported
- Check backend server is running

---

## Security Notes

- JWT tokens stored in localStorage (accessible to XSS)
- Consider using httpOnly cookies for production
- Ensure HTTPS in production
- Keep Supabase keys secure (rotate periodically)
- Backend should validate tokens before processing requests

---

## Next Steps

1. Confirm Google OAuth is enabled in Supabase
2. Test the complete flow in development
3. Add error logging/monitoring
4. Consider adding rate limiting on `/google/verify`
5. Plan for refresh token handling
