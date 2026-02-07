# ⚡ QUICK START GUIDE

Follow these steps to get your authentication system running in 5 minutes!

## Step 1: Set Up Supabase (2 minutes)

1. Go to https://supabase.com and sign up
2. Click "New Project"
3. Fill in:
   - Project name: `academic-pdf-reader`
   - Database password: Create a strong password (save it!)
   - Region: Choose closest to you
4. Click "Create new project" and wait 2-3 minutes

## Step 2: Get Your API Keys (1 minute)

1. In your Supabase dashboard, go to **Settings** → **API**
2. Copy these two values:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon public key** (long string starting with `eyJ...`)

## Step 3: Install Dependencies (1 minute)

Open terminal in the project folder:

```bash
cd auth-backend-project
npm install
```

## Step 4: Configure Environment (1 minute)

1. Create a file named `.env` in the project root
2. Copy and paste this, then replace with your values:

```env
PORT=3000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
JWT_SECRET=make_this_a_very_long_random_string_12345
```

Replace:
- `SUPABASE_URL` with your Project URL from Step 2
- `SUPABASE_ANON_KEY` with your anon public key from Step 2
- `JWT_SECRET` with any random long string (or generate one at https://randomkeygen.com/)

## Step 5: Start the Server (30 seconds)

```bash
npm start
```

You should see:
```
✅ Supabase connection successful!
🚀 Server is running on port 3000
```

## Step 6: Test It! (30 seconds)

1. Open `frontend/index.html` in your browser
2. Click "Register" tab
3. Enter email and password
4. Click "Create Account"
5. You should see your profile!

## 🎉 That's It!

Your authentication system is now running!

## Next Steps:

- Read the full README.md for detailed documentation
- Test the API endpoints using Postman
- Share the API documentation with your frontend team

## ⚠️ Troubleshooting:

**"Missing Supabase credentials" error?**
→ Check that your `.env` file has the correct SUPABASE_URL and SUPABASE_ANON_KEY

**Frontend can't connect?**
→ Make sure the backend is running (`npm start`)

**"Email already registered"?**
→ That email is already in use. Try a different email or login.

---

Need more help? Check README.md for full documentation!
