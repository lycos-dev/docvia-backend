# 🔑 CRITICAL: Supabase Configuration for Password Reset

## THE MOST IMPORTANT STEP

**If password reset doesn't work, this is usually the reason:**

Your redirect URL is **NOT whitelisted in Supabase**.

---

## Quick Fix (5 minutes)

### 1. Go to Supabase Dashboard

[https://app.supabase.com](https://app.supabase.com)

### 2. Select Your Project

Select the Docvia project: `unqrpabmiokotjrznagf`

### 3. Navigate to URL Configuration

**Left menu:** Authentication → URL Configuration

### 4. Add Your Redirect URLs

Under **Redirect URLs**, click **"Add a redirect URL"** and add:

```
http://localhost:5173/create-new-password
```

Also add the main app URL:

```
http://localhost:5173
```

### 5. Save

Click **"Save Configuration"**

---

## Expected Result

✅ Users can now request password reset
✅ Email will contain correct link
✅ Clicking link redirects to `http://localhost:5173/create-new-password`
✅ User can enter new password
✅ Password reset works!

---

## Visual Guide

```
Supabase Dashboard
  ↓
Authentication (left sidebar)
  ↓
URL Configuration
  ↓
[Redirect URLs section]
  ↓
Add these URLs:
  • http://localhost:5173/create-new-password
  • http://localhost:5173
  ↓
Click Save
  ↓
✅ Done!
```

---

## For Production

Add your production URLs too:

```
https://yourdomain.com/create-new-password
https://yourdomain.com
```

Example:
```
https://app.docvia.com/create-new-password
https://app.docvia.com
```

---

## Common Mistakes

❌ **Wrong URL Format:**
- ❌ NOT adding https:// (for production)
- ❌ NOT adding /create-new-password
- ❌ Adding extra slashes: `http://localhost:5173//create-new-password`

✅ **Correct Format:**
- ✅ `http://localhost:5173/create-new-password`
- ✅ `https://yourdomain.com/create-new-password`

---

## Verify It Works

1. Go to: `http://localhost:5173/signin`
2. Click "Forgot Password"
3. Enter any test email address
4. Supabase sends email
5. Check your email inbox
6. **Click link in email**
7. Should land on: `http://localhost:5173/create-new-password`
8. **If you see a 404 or blank page**, URLs not added to Supabase

---

## If Still Not Working

1. Check you're in the right Supabase project
2. Verify URLs are exactly as shown (case-sensitive)
3. No extra spaces before/after URLs
4. Both http://localhost:5173 AND http://localhost:5173/create-new-password added
5. Click "Save Configuration" after adding URLs
6. Wait 30 seconds for changes to take effect
7. Request a new password reset

---

## Screenshot Location

In Supabase Dashboard:

```
LEFT MENU:
  Project Settings
    ↓ (expand arrow)
  Authentication
    ↓
  URL Configuration ← YOU ARE HERE
    
MAIN AREA:
  Site URL
  Redirect URLs ← ADD YOUR URLS HERE
    [Add a redirect URL]
    http://localhost:5173
    http://localhost:5173/create-new-password
    (click Save)
```

---

## Still Having Issues?

Check [PASSWORD_RESET_SETUP.md](./PASSWORD_RESET_SETUP.md) for detailed troubleshooting.

Key things to verify:
- [ ] Backend .env has `FRONTEND_URL=http://localhost:5173`
- [ ] Supabase redirect URLs configured
- [ ] Backend running on port 3001
- [ ] Frontend running on port 5173
- [ ] Email received with link
- [ ] Link format: `http://localhost:5173/create-new-password#access_token=...`

---

## Reference

**Backend .env:**
```bash
FRONTEND_URL=http://localhost:5173
PORT=3001
SUPABASE_URL=https://unqrpabmiokotjrznagf.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```

**Supabase Redirect URLs:**
```
http://localhost:5173/create-new-password
http://localhost:5173
(add production URLs when deploying)
```

That's it! 🎉
