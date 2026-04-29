# Academic PDF Reader - Authentication Backend

A complete authentication system using Node.js, Express, and Supabase for user registration, login, and session management.

## 🚀 Features

- User registration with email and password
- Secure login with JWT tokens
- Session management
- User logout
- Protected routes for authenticated users
- Simple frontend for testing

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account (free tier works!)

## 🛠️ Supabase Setup (Step-by-Step)

### Step 1: Create a Supabase Account
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with GitHub, Google, or email
4. Verify your email if needed

### Step 2: Create a New Project
1. Once logged in, click "New Project"
2. Fill in the details:
   - **Name**: `academic-pdf-reader` (or any name you prefer)
   - **Database Password**: Create a strong password (SAVE THIS!)
   - **Region**: Choose the closest to your location
   - **Pricing Plan**: Free tier is fine
3. Click "Create new project"
4. Wait 2-3 minutes for the project to set up

### Step 3: Get Your API Keys
1. In your Supabase dashboard, click on your project
2. Go to **Settings** (gear icon on the left sidebar)
3. Click on **API** in the settings menu
4. You'll see:
   - **Project URL** (looks like: `https://xxxxx.supabase.co`)
   - **anon/public key** (starts with `eyJ...`)
   - **service_role key** (starts with `eyJ...`)
5. Copy both the **Project URL** and **anon public** key

### Step 4: Enable Email Authentication
1. Go to **Authentication** in the left sidebar
2. Click on **Providers**
3. Make sure **Email** is enabled (it should be by default)
4. Scroll down to **Email Templates** (optional for now)

### Step 5: Set Up the Users Table (Optional - Supabase creates this automatically)
Supabase automatically creates an `auth.users` table when you enable authentication. However, if you want to add custom user data:

1. Go to **Table Editor** in the left sidebar
2. Click **New Table**
3. Name it `user_profiles`
4. Add columns:
   - `id` (uuid, primary key, references auth.users)
   - `created_at` (timestamp with timezone)
   - `updated_at` (timestamp with timezone)
   - Any other custom fields you need later

## 📦 Installation

### 1. Clone or extract this project
```bash
cd auth-backend-project
```

### 2. Install dependencies
```bash
npm install
```

### 3. Configure environment variables
Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000

# Supabase Configuration
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here

# JWT Secret (generate a random string)
JWT_SECRET=your_super_secret_jwt_key_here_make_it_long_and_random
```

**Important:** Replace the placeholder values:
- `SUPABASE_URL`: Paste your Project URL from Step 3
- `SUPABASE_ANON_KEY`: Paste your anon/public key from Step 3
- `JWT_SECRET`: Use a random string (you can generate one at [https://randomkeygen.com/](https://randomkeygen.com/))

### 4. Start the server
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

The server will start at `http://localhost:3000`

## 🧪 Testing the API

### Option 1: Use the Simple Frontend
1. Make sure your backend server is running (`npm start`)
2. Open `frontend/index.html` in your browser
3. You can now:
   - Register a new user
   - Login with credentials
   - View profile (when logged in)
   - Logout

### Option 2: Use Postman or cURL

#### Register a new user
```bash
POST http://localhost:3000/api/auth/register
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "SecurePassword123!"
}
```

#### Login
```bash
POST http://localhost:3000/api/auth/login
Content-Type: application/json

{
  "email": "test@example.com",
  "password": "SecurePassword123!"
}
```

Response will include:
```json
{
  "success": true,
  "data": {
    "user": { ... },
    "token": "eyJhbGc..."
  }
}
```

#### Get User Profile (Protected Route)
```bash
GET http://localhost:3000/api/auth/profile
Authorization: Bearer your_token_here
```

#### Logout
```bash
POST http://localhost:3000/api/auth/logout
Authorization: Bearer your_token_here
```

## 📁 Project Structure

```
auth-backend-project/
├── backend/
│   ├── config/
│   │   └── supabase.js          # Supabase client configuration
│   ├── middleware/
│   │   └── auth.middleware.js   # JWT authentication middleware
│   ├── routes/
│   │   └── auth.routes.js       # Authentication routes
│   ├── controllers/
│   │   └── auth.controller.js   # Authentication logic
│   └── server.js                # Express server setup
├── frontend/
│   └── index.html               # Simple test interface
├── .env                         # Environment variables (create this)
├── .env.example                 # Example environment file
├── .gitignore                   # Git ignore file
├── package.json                 # Project dependencies
└── README.md                    # This file
```

## 🔐 API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login user | No |
| GET | `/api/auth/profile` | Get user profile | Yes |
| POST | `/api/auth/logout` | Logout user | Yes |

## 🔒 Security Features

- Passwords hashed with bcrypt
- JWT tokens for session management
- Protected routes with middleware
- Environment variables for sensitive data
- CORS enabled for frontend access
- Input validation

## 🐛 Troubleshooting

### "Connection refused" or "ECONNREFUSED"
- Make sure your backend server is running (`npm start`)
- Check if the PORT in `.env` matches

### "Invalid API key" or Supabase errors
- Double-check your `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`
- Make sure you're using the **anon/public** key, not the service_role key
- Verify your Supabase project is active

### "Email already registered"
- This email is already in the database
- Try a different email or login with existing credentials
- Check your Supabase Authentication > Users to see registered users

### Frontend can't connect to backend
- Verify CORS is enabled in `server.js`
- Check that the frontend is making requests to `http://localhost:3000`
- Make sure both frontend and backend are running

## 📝 Next Steps

After getting authentication working, you can:

1. Add email verification
2. Implement password reset functionality
3. Add user roles and permissions
4. Create additional user profile fields
5. Integrate with your PDF upload features

## 🤝 Working with Your Frontend Team

Share these details with your frontend teammates:

1. **Base URL**: `http://localhost:3000/api`
2. **Authentication Header**: All protected routes need:
   ```
   Authorization: Bearer <token>
   ```
3. **Token Storage**: After login, store the token in localStorage
4. **Token Expiry**: Tokens expire in 24 hours (configurable)

## 📚 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Express.js Guide](https://expressjs.com/)
- [JWT.io](https://jwt.io/) - Decode and verify JWT tokens

## ⚠️ Important Notes

- Never commit your `.env` file to git
- Keep your `JWT_SECRET` secure and random
- Use HTTPS in production
- The `service_role` key should NEVER be used in client-side code

---

**Need help?** Check the troubleshooting section or reach out to your instructor/team!
