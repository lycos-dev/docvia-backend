# Password Reset Flow - Setup & Troubleshooting

## Overview

The password reset flow uses Supabase's built-in email templates and authentication. When a user requests a password reset:

1. Backend calls `supabase.auth.resetPasswordForEmail()`
2. Supabase sends an email with a reset link
3. User clicks link → redirected to frontend `/create-new-password` page
4. Supabase token in URL hash is extracted
5. Frontend sends token to backend which updates password via Supabase

---

## Required Supabase Configuration

### 1. Add Redirect URLs to Supabase

**Critical Step**: Your redirect URLs must be whitelisted in Supabase settings.

**Steps:**
1. Go to Supabase Dashboard → Your Project
2. Navigate to **Authentication → URL Configuration**
3. Under **Redirect URLs**, add both development and production URLs:
   - Development: `http://localhost:5173/create-new-password`
   - Production: `https://yourdomain.com/create-new-password`
4. Save changes

**Example Valid URLs:**
```
http://localhost:5173/create-new-password
http://localhost:5173
https://app.docvia.com/create-new-password
https://app.docvia.com
```

### 2. Verify Email Template Configuration

**Steps:**
1. Go to Supabase Dashboard → Authentication → Email Templates
2. Click on "Reset Password" email template
3. Verify the template uses: `{{ .ConfirmationURL }}`
4. This variable is populated by Supabase with the redirect URL you configured

**Expected email link format:**
```
https://[project].supabase.co/auth/v1/recover?token=[TOKEN]&type=recovery&redirect_to=http://localhost:5173/create-new-password
```

When user clicks, Supabase redirects to:
```
http://localhost:5173/create-new-password#access_token=[TOKEN]&type=recovery
```

---

## Environment Variables

### Backend (.env)

```bash
# CRITICAL: Must match your frontend URL
FRONTEND_URL=http://localhost:5173

# Supabase
SUPABASE_URL=https://unqrpabmiokotjrznagf.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Frontend (.env.local)

```bash
VITE_SUPABASE_URL=https://unqrpabmiokotjrznagf.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Testing the Flow

### Step 1: Request Password Reset

```bash
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

**Expected Response:**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

**Backend Logs Should Show:**
```
🗳️ Sending password reset email...
   Redirect URL: http://localhost:5173/create-new-password
```

### Step 2: Check Email (Development)

For development, use **Supabase's Email Preview** or check the email inbox configured for testing.

**Expected Email Content:**
- Subject: "Reset your password"
- Link format: `https://[project].supabase.co/auth/v1/recover?token=...&redirect_to=http://localhost:5173/create-new-password`

### Step 3: Click Reset Link

- User receives email
- Clicks password reset link
- Browser redirects to: `http://localhost:5173/create-new-password#access_token=...&type=recovery`

**Frontend Logs Should Show:**
```
🔑 Reset page hash: access_token=...&type=recovery
📋 Extracted token: found
📋 Recovery type: recovery
```

### Step 4: Submit New Password

- User enters new password
- Clicks "Create Password" button

**Frontend Logs Should Show:**
```
🔄 Submitting password reset with token...
✅ Password reset successful
```

- User is redirected to `/signin`

---

## Troubleshooting

### ❌ Issue: Redirected to Backend Instead of Frontend

**Symptoms:**
- User clicks password reset link
- Gets 404 on backend server
- Never reaches `/create-new-password` page

**Fixes (in order):**

1. **Verify Backend .env Variable:**
   ```bash
   # Backend/.env
   FRONTEND_URL=http://localhost:5173
   ```
   
2. **Check Supabase Redirect URL Configuration:**
   - Frontend Redirect URLs missing from Supabase settings
   - Add: `http://localhost:5173/create-new-password`
   - Add: `http://localhost:5173`

3. **Restart Backend (to read .env):**
   ```bash
   cd backend
   npm start
   ```

4. **Check Email Link Format:**
   - Look at actual email in inbox
   - Confirm it includes `redirect_to=http://localhost:5173/create-new-password`
   - If not, Supabase email template is using wrong redirectTo value

### ❌ Issue: No Token in URL Hash

**Symptoms:**
- User lands on `/create-new-password`
- Frontend logs show "not found"
- "Reset link is invalid or expired" error

**Fixes:**

1. **Check URL Format:**
   - Correct: `http://localhost:5173/create-new-password#access_token=...&type=recovery`
   - Incorrect: `http://localhost:5173/create-new-password?access_token=...`

2. **Verify Email Link:**
   - URL must use `#` not `?`
   - Check Supabase email template or recovery URL format

3. **Browser History:**
   - Clear browser history/cache
   - Try in incognito window

4. **Supabase Configuration:**
   - Ensure Redirect URLs are correctly added
   - Test with exact URL format from email

### ❌ Issue: Password Update Fails on Backend

**Symptoms:**
- Token is extracted
- Frontend sends request
- Backend returns error
- Logs show: `❌ Invalid or expired reset link`

**Fixes:**

1. **Check Token Expiry:**
   - Password reset tokens expire after 24 hours
   - User must request new link if too old

2. **Verify Backend Endpoint:**
   ```bash
   curl -X POST http://localhost:3000/api/auth/reset-password \
     -H "Content-Type: application/json" \
     -d '{
       "token": "YOUR_ACCESS_TOKEN",
       "newPassword": "NewPassword123!"
     }'
   ```

3. **Check Backend Logs:**
   - Should show: `🔄 Processing password reset...`
   - Look for any Supabase API errors

4. **Verify Supabase Credentials:**
   - Ensure `SUPABASE_URL` and `SUPABASE_ANON_KEY` are correct
   - Check they match your Supabase project

### ❌ Issue: Nothing Happens After Clicking Password Reset Link

**Symptoms:**
- Blank page or redirect loop
- No frontend logs

**Fixes:**

1. **Check Frontend Dev Server:**
   ```bash
   cd frontend-src
   npm run dev
   ```
   - Must be running on `http://localhost:5173`

2. **Check Browser Console:**
   - Open DevTools → Console tab
   - Look for any JavaScript errors

3. **Check Network Tab:**
   - Open DevTools → Network tab
   - Verify API calls to backend `/api/auth/reset-password` succeed

4. **Clear Cache:**
   ```bash
   # Clear completely
   rm -rf frontend-src/node_modules/.vite
   npm run dev
   ```

---

## Email Template Preview

### Example Reset Email (HTML)

When Supabase sends the password reset email, it looks like:

```html
Subject: Reset your password

Hello,

You requested a password reset. Click the link below to create a new password:

[Reset Password](https://unqrpabmiokotjrznagf.supabase.co/auth/v1/recover?token=...&type=recovery&redirect_to=http://localhost:5173/create-new-password)

If you didn't request this, ignore this email.

Thanks,
Docvia Team
```

---

## Production Deployment Checklist

- [ ] Backend `FRONTEND_URL` set to production domain
- [ ] Supabase Redirect URLs include production domain + `/create-new-password`
- [ ] HTTPS enforced for production URLs
- [ ] Email domain verified in Supabase (if using custom domain)
- [ ] Backend and frontend both deployed
- [ ] Test full password reset flow in production
- [ ] Monitor backend logs for reset endpoints
- [ ] Set up email notifications for password reset failures

---

## Security Notes

- ✅ Tokens expire (usually 24 hours)
- ✅ Backend validates token via Supabase Supabase before updating
- ✅ Password reset links are single-use
- ⚠️ Never log tokens in production
- ⚠️ Always use HTTPS in production
- ⚠️ Rate limit password reset requests (prevents abuse)

---

## Debug Commands

### Check if User Exists in Supabase

```bash
# Via Supabase CLI
supabase auth list --linked
```

### Force Reset Email Manually

```bash
# For testing in Supabase dashboard:
# 1. Go to Authentication → Users
# 2. Find user
# 3. Click "..." menu
# 4. Select "Send password reset"
```

### View Email Logs

```bash
# In Supabase dashboard:
# 1. Go to Logs → Auth
# 2. Filter by "resetPasswordForEmail"
# 3. Check response for errors
```

---

## Still Having Issues?

1. **Check that FRONTEND_URL is correct** - backend must know frontend address
2. **Supabase Redirect URLs configured** - go to URL Configuration and verify
3. **Nothing in email?** - Check Supabase Email Logs for errors
4. **Wrong URL in email?** - Check Supabase Email Template format
5. **Can't extract token?** - Verify browser console shows the hash correctly

If issues persist, check the browser DevTools Console and backend logs for specific error messages.
