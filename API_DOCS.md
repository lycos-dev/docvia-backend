# API Documentation

Complete API reference for the Authentication Backend.

## Base URL
```
http://localhost:3000/api/auth
```

In production, replace with your deployed backend URL.

---

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_token_here>
```

---

## Endpoints

### 1. Register New User

Create a new user account.

**Endpoint:** `POST /api/auth/register`

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Validation:**
- Email must be valid format
- Password must be at least 6 characters
- Email must not already exist

**Success Response (201):**
```json
{
  "success": true,
  "message": "User registered successfully!",
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "created_at": "2024-02-07T10:30:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**

*400 - Validation Error:*
```json
{
  "success": false,
  "error": "Email and password are required."
}
```

*400 - Email Already Exists:*
```json
{
  "success": false,
  "error": "This email is already registered. Please login instead."
}
```

---

### 2. Login User

Authenticate existing user and receive token.

**Endpoint:** `POST /api/auth/login`

**Access:** Public

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123"
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Login successful!",
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "created_at": "2024-02-07T10:30:00Z",
      "last_sign_in": "2024-02-07T14:45:00Z"
    },
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
  }
}
```

**Error Responses:**

*401 - Invalid Credentials:*
```json
{
  "success": false,
  "error": "Invalid email or password."
}
```

---

### 3. Get User Profile

Retrieve current user's profile information.

**Endpoint:** `GET /api/auth/profile`

**Access:** Protected (requires authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid-string",
      "email": "user@example.com",
      "created_at": "2024-02-07T10:30:00Z",
      "last_sign_in": "2024-02-07T14:45:00Z",
      "email_confirmed": true
    }
  }
}
```

**Error Responses:**

*401 - No Token:*
```json
{
  "success": false,
  "error": "Access denied. No token provided."
}
```

*401 - Invalid Token:*
```json
{
  "success": false,
  "error": "Invalid token."
}
```

*401 - Expired Token:*
```json
{
  "success": false,
  "error": "Token expired. Please login again."
}
```

---

### 4. Logout User

Logout current user and invalidate session.

**Endpoint:** `POST /api/auth/logout`

**Access:** Protected (requires authentication)

**Headers:**
```
Authorization: Bearer <token>
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Logout successful!"
}
```

**Error Response (401):**
```json
{
  "success": false,
  "error": "Access denied. No token provided."
}
```

---

## Frontend Integration Guide

### 1. Store Token After Login/Register

After successful login or registration:

```javascript
// Save token to localStorage
localStorage.setItem('token', response.data.token);

// Save user info (optional)
localStorage.setItem('user', JSON.stringify(response.data.user));
```

### 2. Send Token with Protected Requests

For any protected endpoint:

```javascript
const token = localStorage.getItem('token');

fetch('http://localhost:3000/api/auth/profile', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### 3. Handle Token Expiration

If you receive a 401 error with "Token expired":

```javascript
if (response.status === 401) {
  // Clear stored token
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Redirect to login page
  window.location.href = '/login';
}
```

### 4. Check if User is Logged In

```javascript
function isLoggedIn() {
  const token = localStorage.getItem('token');
  return token !== null;
}

// Use it
if (isLoggedIn()) {
  // Show authenticated content
} else {
  // Redirect to login
}
```

### 5. Complete Login Example

```javascript
async function login(email, password) {
  try {
    const response = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      // Store token
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      // Show error message
      alert(data.error);
    }
  } catch (error) {
    console.error('Login error:', error);
    alert('Connection error. Please try again.');
  }
}
```

### 6. Complete Register Example

```javascript
async function register(email, password) {
  try {
    const response = await fetch('http://localhost:3000/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();

    if (data.success) {
      // Store token
      localStorage.setItem('token', data.data.token);
      localStorage.setItem('user', JSON.stringify(data.data.user));
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      // Show error message
      alert(data.error);
    }
  } catch (error) {
    console.error('Registration error:', error);
    alert('Connection error. Please try again.');
  }
}
```

### 7. Logout Example

```javascript
async function logout() {
  const token = localStorage.getItem('token');
  
  try {
    await fetch('http://localhost:3000/api/auth/logout', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
  } catch (error) {
    console.error('Logout error:', error);
  }
  
  // Clear local storage
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  
  // Redirect to login
  window.location.href = '/login';
}
```

---

## Error Handling

All endpoints follow this error response format:

```json
{
  "success": false,
  "error": "Error message here"
}
```

Common HTTP status codes:
- `200` - Success
- `201` - Created (registration)
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required/failed)
- `404` - Not Found
- `500` - Internal Server Error

---

## Token Information

- **Format:** JWT (JSON Web Token)
- **Expiration:** 24 hours from creation
- **Storage:** Store in localStorage or sessionStorage
- **Usage:** Include in Authorization header as `Bearer <token>`

---

## CORS Configuration

The backend has CORS enabled for all origins during development. In production, configure allowed origins in `backend/server.js`.

---

## Testing Tips

1. Use the included `frontend/index.html` for quick testing
2. Use Postman or Insomnia for API testing
3. Check browser console for detailed error messages
4. Verify token is being sent correctly in request headers

---

## Next Features to Implement

After authentication is working, you can add:

1. **Password Reset:** Add forgot password functionality
2. **Email Verification:** Verify user emails before allowing login
3. **User Profiles:** Add custom user data (name, avatar, etc.)
4. **Session Management:** Track active sessions
5. **OAuth:** Add Google/GitHub login

---

Need help? Check the README.md or contact your backend developer!
