# Batch A — Auth Dark Mode, Input Validation, Google OAuth, Search Bar

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix dark mode on all auth pages, add input validation + password strength meter across all forms, wire Google OAuth button, and make the dashboard search bar functional.

**Architecture:** All changes are self-contained to individual components. No new contexts or routes needed. Google OAuth adds `loginWithGoogle` to the existing `AuthContext` and `getGoogleAuthUrl` to `authService`. Search state is lifted from `TopBar` → `DashboardPage` → `ReadingSection` via props.

**Tech Stack:** React 19, TypeScript 5.9 strict, Tailwind v4 class-based dark mode, Framer Motion (already installed)

---

### Task 1: Fix `Input.tsx` dark mode

**Files:**
- Modify: `frontend-src/src/shared/components/ui/Input.tsx`

- [ ] **Step 1: Replace `Input.tsx` with dark-mode variants**

Replace the entire file `frontend-src/src/shared/components/ui/Input.tsx`:
```tsx
import React, { forwardRef, InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  rightIcon?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, rightIcon, type, ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            type={type}
            className={cn(
              'flex h-12 w-full rounded-lg border border-gray-200 dark:border-white/10',
              'bg-white dark:bg-[#0f172a]',
              'px-4 py-3 text-sm text-gray-900 dark:text-gray-100',
              'placeholder:text-gray-400 dark:placeholder:text-gray-500',
              'transition-colors duration-200',
              'focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-red-500 focus:ring-red-500/20 focus:border-red-500',
              rightIcon && 'pr-11',
              className
            )}
            ref={ref}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500">
              {rightIcon}
            </div>
          )}
        </div>
        {error && (
          <p className="mt-1.5 text-xs text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export { Input };
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/shared/components/ui/Input.tsx
git commit -m "fix: add dark mode variants to Input component"
```

---

### Task 2: Fix auth page backgrounds and card dark mode

**Files:**
- Modify: `frontend-src/src/features/auth/pages/SignInPage.tsx`
- Modify: `frontend-src/src/features/auth/pages/SignUpPage.tsx`
- Modify: `frontend-src/src/features/auth/pages/ForgotPasswordPage.tsx`
- Modify: `frontend-src/src/features/auth/pages/CreateNewPasswordPage.tsx`

- [ ] **Step 1: Replace `SignInPage.tsx`**

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
      className="min-h-screen w-full bg-[#F5F5F5] dark:bg-[#0f172a] flex items-center justify-center p-4 transition-colors"
    >
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-white/10 rounded-3xl shadow-lg px-12 py-12 select-none transition-colors">
          <Logo />
          <div className="text-center mb-8">
            <h1 className="text-[35px] text-gray-800 dark:text-gray-100 font-medium mb-2 tracking-normal leading-tight select-none">
              Welcome to Docvia
            </h1>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 font-normal select-none">
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

- [ ] **Step 2: Replace `SignUpPage.tsx`**

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
    <div className="min-h-screen w-full bg-[#F5F5F5] dark:bg-[#0f172a] flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-white/10 rounded-2xl shadow-md px-12 py-12 transition-colors">
          <div className="mb-8">
            <h1 className="text-[34px] text-gray-800 dark:text-gray-100 font-medium mb-2 tracking-normal leading-tight select-none">
              Create your account
            </h1>
            <p className="text-[15px] text-gray-500 dark:text-gray-400 font-normal select-none">
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

- [ ] **Step 3: Replace `ForgotPasswordPage.tsx`**

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
      <div className="min-h-screen w-full bg-[#F5F5F5] dark:bg-[#0f172a] flex items-center justify-center p-4 transition-colors">
        <div className="w-full max-w-lg">
          <div className="bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-white/10 rounded-2xl shadow-md px-12 py-12 text-center transition-colors">
            <h1 className="text-3xl text-gray-800 dark:text-gray-100 font-medium mb-4 select-none">
              Check your inbox
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-6 select-none">
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
    <div className="min-h-screen w-full bg-[#F5F5F5] dark:bg-[#0f172a] flex items-center justify-center p-4 transition-colors">
      <div className="w-full max-w-lg">
        <div className="bg-white dark:bg-[#1e293b] border border-gray-100 dark:border-white/10 rounded-2xl shadow-md px-12 py-12 transition-colors">
          <div className="mb-6">
            <h1 className="text-4xl text-gray-800 dark:text-gray-100 font-medium mb-2 tracking-normal leading-tight select-none">
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

- [ ] **Step 4: Replace `CreateNewPasswordPage.tsx`**

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

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.replace('#', ''));
    setAccessToken(params.get('access_token'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
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
    <div className="min-h-screen flex items-center justify-center bg-[#F5F5F5] dark:bg-[#0f172a] px-4 transition-colors">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-[#1e293b] shadow-lg border border-gray-100 dark:border-white/10 p-10 transition-colors">
        <h1 className="text-4xl font-medium text-gray-800 dark:text-gray-100 select-none">Create new password</h1>
        <p className="mt-2 text-base text-gray-500 dark:text-gray-400 select-none">Enter your new password below</p>

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
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus:outline-none cursor-pointer"
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
                className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus:outline-none cursor-pointer"
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

- [ ] **Step 5: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add frontend-src/src/features/auth/pages/
git commit -m "fix: auth pages dark mode — card bg, border, text contrast"
```

---

### Task 3: Add validation to `SignInForm` + fix contrast

**Files:**
- Modify: `frontend-src/src/features/auth/components/SignInForm.tsx`

- [ ] **Step 1: Replace `SignInForm.tsx`**

```tsx
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../../shared/components/ui/Input';
import { Button } from '../../../shared/components/ui/Button';
import { Checkbox } from '../../../shared/components/ui/Checkbox';
import type { SignInFormData } from '../types';

interface SignInFormProps {
  onSubmit: (data: SignInFormData) => void;
  onSignUpClick: () => void;
  onForgotPasswordClick: () => void;
  isLoading?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SignInForm: React.FC<SignInFormProps> = ({
  onSubmit,
  onSignUpClick,
  onForgotPasswordClick,
  isLoading = false,
}) => {
  const [formData, setFormData] = useState<SignInFormData>({
    email: '',
    password: '',
    rememberMe: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleChange =
    (field: keyof SignInFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      }));
      if (errors[field as 'email' | 'password']) {
        setErrors((prev) => ({ ...prev, [field]: undefined }));
      }
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string } = {};
    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!EMAIL_RE.test(formData.email)) {
      newErrors.email = 'Enter a valid email address.';
    }
    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      <Input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange('email')}
        error={errors.email}
        autoComplete="email"
        disabled={isLoading}
      />

      <Input
        type={showPassword ? 'text' : 'password'}
        placeholder="Password"
        value={formData.password}
        onChange={handleChange('password')}
        error={errors.password}
        autoComplete="current-password"
        disabled={isLoading}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus:outline-none cursor-pointer disabled:cursor-not-allowed"
            tabIndex={-1}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <div className="flex items-center justify-between pt-1">
        <Checkbox
          label="Remember me"
          checked={formData.rememberMe}
          onChange={handleChange('rememberMe')}
          disabled={isLoading}
        />
        <button
          type="button"
          onClick={onForgotPasswordClick}
          className="text-sm underline text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors font-medium cursor-pointer disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          Forgot password?
        </button>
      </div>

      <Button
        type="submit"
        variant="primary"
        className="w-full mt-4 font-semibold"
        isLoading={isLoading}
      >
        Sign In
      </Button>

      <div className="text-center text-sm text-gray-500 dark:text-gray-400 pt-1 mb-10 select-none">
        Don't have an account?{' '}
        <button
          type="button"
          onClick={onSignUpClick}
          className="text-primary hover:text-primary-dark font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          Sign Up
        </button>
      </div>
    </form>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/components/SignInForm.tsx
git commit -m "fix: SignInForm validation (email format, password min 8) + dark text contrast"
```

---

### Task 4: Enhance `SignUpForm` validation + password strength meter

**Files:**
- Modify: `frontend-src/src/features/auth/components/SignUpForm.tsx`

- [ ] **Step 1: Replace `SignUpForm.tsx`**

```tsx
import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../../shared/components/ui/Input';
import { Button } from '../../../shared/components/ui/Button';
import { Checkbox } from '../../../shared/components/ui/Checkbox';
import type { SignUpFormData } from '../types';

interface SignUpFormProps {
  onSubmit: (data: SignUpFormData) => void;
  onSignInClick: () => void;
  isLoading?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,30}$/;

function getStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: '', color: '' };
  const checks = [
    pw.length >= 8,
    /[A-Z]/.test(pw),
    /[0-9]/.test(pw),
    /[^a-zA-Z0-9]/.test(pw),
  ];
  const score = checks.filter(Boolean).length;
  if (score <= 2) return { score: 1, label: 'Weak', color: '#EF4444' };
  if (score === 3) return { score: 2, label: 'Medium', color: '#F97316' };
  return { score: 3, label: 'Strong', color: '#22C55E' };
}

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSubmit, isLoading = false }) => {
  const [formData, setFormData] = useState<SignUpFormData>({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const strength = getStrength(formData.password);

  const handleChange =
    (field: keyof SignUpFormData) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setFormData((prev) => ({
        ...prev,
        [field]: e.target.type === 'checkbox' ? e.target.checked : e.target.value,
      }));
      if (errors[field]) {
        setErrors((prev) => { const n = { ...prev }; delete n[field]; return n; });
      }
    };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required.';
    } else if (!EMAIL_RE.test(formData.email)) {
      newErrors.email = 'Enter a valid email address.';
    }

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required.';
    } else if (!USERNAME_RE.test(formData.username)) {
      newErrors.username = 'Username must be 3–30 characters: letters, numbers, underscores only.';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required.';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters.';
    } else if (!/[A-Z]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one uppercase letter.';
    } else if (!/[0-9]/.test(formData.password)) {
      newErrors.password = 'Password must contain at least one number.';
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match.';
    }

    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the Terms of Service.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <Input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={handleChange('email')}
        error={errors.email}
        autoComplete="email"
        disabled={isLoading}
      />

      <Input
        type="text"
        placeholder="Username"
        value={formData.username}
        onChange={handleChange('username')}
        error={errors.username}
        disabled={isLoading}
      />

      <div>
        <Input
          type={showPassword ? 'text' : 'password'}
          placeholder="Password"
          value={formData.password}
          onChange={handleChange('password')}
          error={errors.password}
          autoComplete="new-password"
          disabled={isLoading}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus:outline-none cursor-pointer"
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={isLoading}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
        />
        {/* Password strength meter */}
        {formData.password && (
          <div className="mt-2">
            <div className="flex gap-1">
              {[1, 2, 3].map((level) => (
                <div
                  key={level}
                  className="h-1 flex-1 rounded-full transition-colors duration-300"
                  style={{
                    backgroundColor: strength.score >= level ? strength.color : '#E5E7EB',
                  }}
                />
              ))}
            </div>
            <p className="text-xs mt-0.5 font-medium" style={{ color: strength.color }}>
              {strength.label}
            </p>
          </div>
        )}
      </div>

      <Input
        type={showConfirmPassword ? 'text' : 'password'}
        placeholder="Confirm Password"
        value={formData.confirmPassword}
        onChange={handleChange('confirmPassword')}
        error={errors.confirmPassword}
        autoComplete="new-password"
        disabled={isLoading}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            className="hover:text-gray-700 dark:hover:text-gray-300 transition-colors focus:outline-none cursor-pointer"
            tabIndex={-1}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
            disabled={isLoading}
          >
            {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <div className="space-y-1 pt-2">
        <div className="flex items-start gap-2">
          <Checkbox
            checked={formData.agreeToTerms}
            onChange={handleChange('agreeToTerms')}
            disabled={isLoading}
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">
            I agree to the{' '}
            <a href="#" className="text-primary hover:text-primary-dark underline font-normal">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-primary hover:text-primary-dark underline font-normal">
              Data Privacy Policy
            </a>
          </span>
        </div>
        {errors.agreeToTerms && (
          <p className="text-xs text-red-500 mt-1">{errors.agreeToTerms}</p>
        )}
      </div>

      <Button type="submit" variant="primary" className="w-full mt-6" isLoading={isLoading}>
        Create Account
      </Button>
    </form>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/components/SignUpForm.tsx
git commit -m "feat: SignUpForm — strict validation (email/username regex, password rules) + strength meter"
```

---

### Task 5: Add validation to `ForgotPasswordForm`

**Files:**
- Modify: `frontend-src/src/features/auth/components/ForgotPasswordForm.tsx`

- [ ] **Step 1: Read and replace `ForgotPasswordForm.tsx`**

Read the file first:
```bash
cat frontend-src/src/features/auth/components/ForgotPasswordForm.tsx
```

Then replace the entire file with the following (preserving any props that already exist):
```tsx
import React, { useState } from 'react';
import { Input } from '../../../shared/components/ui/Input';
import { Button } from '../../../shared/components/ui/Button';
import type { ForgotPasswordFormData } from '../types';

interface ForgotPasswordFormProps {
  onSubmit: (data: ForgotPasswordFormData) => void;
  onSignInClick: () => void;
  isLoading?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  onSubmit,
  onSignInClick,
  isLoading = false,
}) => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Email is required.');
      return;
    }
    if (!EMAIL_RE.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(undefined);
    onSubmit({ email });
  };

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-5">
      <Input
        type="email"
        placeholder="Your email address"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (error) setError(undefined);
        }}
        error={error}
        autoComplete="email"
        disabled={isLoading}
      />

      <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
        Send Reset Link
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={onSignInClick}
          className="text-sm text-gray-600 dark:text-gray-400 hover:text-primary dark:hover:text-primary transition-colors cursor-pointer"
          disabled={isLoading}
        >
          Back to Sign In
        </button>
      </div>
    </form>
  );
};
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/components/ForgotPasswordForm.tsx
git commit -m "feat: ForgotPasswordForm — email format validation, dark mode text"
```

---

### Task 6: Enhance `UploadModal` file validation

**Files:**
- Modify: `frontend-src/src/features/dashboard/components/Sidebar/UploadModal.tsx`

- [ ] **Step 1: Update the `uploadFile` function in `UploadModal.tsx`**

Find the `uploadFile` function (around line 15–30 of the current file). Replace the validation block at the top of `uploadFile`:

Old block:
```tsx
const uploadFile = async (file: File) => {
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    setError('Only PDF files are supported.');
    return;
  }
  if (!token) {
    setError('You must be logged in to upload files.');
    return;
  }
```

New block:
```tsx
const MAX_SIZE = 52_428_800; // 50 MB

const uploadFile = async (file: File) => {
  if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    setError('Only PDF files are supported.');
    return;
  }
  if (file.size > MAX_SIZE) {
    setError(`File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum is 50 MB.`);
    return;
  }
  if (!file.name.trim()) {
    setError('File name cannot be empty.');
    return;
  }
  if (!token) {
    setError('You must be logged in to upload files.');
    return;
  }
```

Also move `const MAX_SIZE = 52_428_800;` to the top of the component (before `uploadFile`), not inside it.

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/dashboard/components/Sidebar/UploadModal.tsx
git commit -m "feat: UploadModal — strict PDF validation (MIME type + 50 MB size limit)"
```

---

### Task 7: Add Google OAuth to `authService.ts` and `AuthContext.tsx`

**Files:**
- Modify: `frontend-src/src/shared/services/authService.ts`
- Modify: `frontend-src/src/shared/contexts/AuthContext.tsx`

- [ ] **Step 1: Add `getGoogleAuthUrl` to `authService.ts`**

Open `frontend-src/src/shared/services/authService.ts`. At the end of the file (after the `logout` function), append:
```ts
export async function getGoogleAuthUrl(): Promise<{ success: boolean; url?: string; error?: string }> {
  const res = await fetch(`${BASE}/google`);
  if (res.redirected) {
    return { success: true, url: res.url };
  }
  return res.json();
}
```

- [ ] **Step 2: Add `loginWithGoogle` to `AuthContext.tsx`**

In `frontend-src/src/shared/contexts/AuthContext.tsx`:

1. In the `AuthContextValue` interface, add:
```ts
loginWithGoogle: () => Promise<void>;
```

2. Inside `AuthProvider`, after the `logout` callback, add:
```ts
const loginWithGoogle = useCallback(async () => {
  const result = await authService.getGoogleAuthUrl();
  if (result.success && result.url) {
    window.location.href = result.url;
  }
}, []);
```

3. In the `AuthContext.Provider` value prop, add `loginWithGoogle`:
```ts
value={{ user, token, isAuthenticated: !!token && !!user, isLoading, login, logout, loginWithGoogle }}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/shared/services/authService.ts frontend-src/src/shared/contexts/AuthContext.tsx
git commit -m "feat: add loginWithGoogle to AuthContext, getGoogleAuthUrl to authService"
```

---

### Task 8: Add Google OAuth button to `SignInForm`

**Files:**
- Modify: `frontend-src/src/features/auth/components/SignInForm.tsx`

- [ ] **Step 1: Add Google button and OR divider to `SignInForm.tsx`**

Import `useAuth` at the top of the file (add after the existing imports):
```tsx
import { useAuth } from '../../../shared/contexts/AuthContext';
```

Inside the `SignInForm` component, add state for Google loading after existing state:
```tsx
const { loginWithGoogle } = useAuth();
const [googleLoading, setGoogleLoading] = useState(false);
const [googleError, setGoogleError] = useState<string | undefined>(undefined);

const handleGoogleSignIn = async () => {
  setGoogleLoading(true);
  setGoogleError(undefined);
  try {
    await loginWithGoogle();
  } catch {
    setGoogleError('Google sign-in failed. Please try again.');
    setGoogleLoading(false);
  }
};
```

In the JSX, insert BEFORE the email `<Input>` (as the first child inside `<form>`):
```tsx
{/* Google OAuth button */}
<button
  type="button"
  onClick={handleGoogleSignIn}
  disabled={isLoading || googleLoading}
  className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-[#dadce0] dark:border-white/12 bg-white dark:bg-[#1e293b] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  {googleLoading ? (
    <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )}
  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
  </span>
</button>

{googleError && (
  <p className="text-xs text-red-500 -mt-3">{googleError}</p>
)}

{/* OR divider */}
<div className="relative flex items-center">
  <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
  <span className="px-3 text-xs text-gray-400 dark:text-gray-500">OR</span>
  <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
</div>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/components/SignInForm.tsx
git commit -m "feat: add Google OAuth button to SignInForm with loading spinner and error state"
```

---

### Task 9: Add Google OAuth button to `SignUpForm`

**Files:**
- Modify: `frontend-src/src/features/auth/components/SignUpForm.tsx`

- [ ] **Step 1: Add Google button and OR divider to `SignUpForm.tsx`**

Import `useAuth`:
```tsx
import { useAuth } from '../../../shared/contexts/AuthContext';
```

Inside `SignUpForm`, add after existing state:
```tsx
const { loginWithGoogle } = useAuth();
const [googleLoading, setGoogleLoading] = useState(false);
const [googleError, setGoogleError] = useState<string | undefined>(undefined);

const handleGoogleSignIn = async () => {
  setGoogleLoading(true);
  setGoogleError(undefined);
  try {
    await loginWithGoogle();
  } catch {
    setGoogleError('Google sign-up failed. Please try again.');
    setGoogleLoading(false);
  }
};
```

In the JSX, insert BEFORE the email `<Input>` (first child inside `<form>`):
```tsx
{/* Google OAuth button */}
<button
  type="button"
  onClick={handleGoogleSignIn}
  disabled={isLoading || googleLoading}
  className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-[#dadce0] dark:border-white/12 bg-white dark:bg-[#1e293b] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
>
  {googleLoading ? (
    <div className="w-5 h-5 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
  ) : (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
    </svg>
  )}
  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
    {googleLoading ? 'Redirecting…' : 'Continue with Google'}
  </span>
</button>

{googleError && (
  <p className="text-xs text-red-500 -mt-3">{googleError}</p>
)}

{/* OR divider */}
<div className="relative flex items-center">
  <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
  <span className="px-3 text-xs text-gray-400 dark:text-gray-500">OR</span>
  <div className="flex-1 h-px bg-gray-200 dark:bg-white/10" />
</div>
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/auth/components/SignUpForm.tsx
git commit -m "feat: add Google OAuth button to SignUpForm"
```

---

### Task 10: Lift search state to `DashboardPage`, wire `TopBar`

**Files:**
- Modify: `frontend-src/src/features/dashboard/pages/DashboardPage.tsx`
- Modify: `frontend-src/src/features/dashboard/components/TopBar.tsx`

- [ ] **Step 1: Replace `DashboardPage.tsx`**

```tsx
import { useState } from 'react';
import TopBar from '../components/TopBar';
import WelcomeBanner from '../components/WelcomeBanner';
import ReadingSection from '../components/ReadingSection';
import StreakCard from '../components/StreakCard';

export default function DashboardPage() {
  const [searchTerm, setSearchTerm] = useState('');

  return (
    <div>
      <TopBar searchTerm={searchTerm} onSearchChange={setSearchTerm} />
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <WelcomeBanner />
          <ReadingSection searchTerm={searchTerm} onSearchClear={() => setSearchTerm('')} />
        </div>
        <div className="w-full xl:w-[320px] flex xl:block justify-end">
          <StreakCard />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace `TopBar.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import { Search, Moon, Sun, X } from 'lucide-react';
import { useTheme } from '../../../shared/contexts/ThemeContext';

interface TopBarProps {
  searchTerm: string;
  onSearchChange: (term: string) => void;
}

export default function TopBar({ searchTerm, onSearchChange }: TopBarProps) {
  const { theme, toggleTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape key clears search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && searchTerm) {
        onSearchChange('');
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchTerm, onSearchChange]);

  return (
    <div className="flex items-center justify-between mb-8">
      {/* Search Bar */}
      <div className="flex-1 max-w-xl">
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value.trimStart())}
            placeholder="Search documents…"
            className="w-full h-10 pl-10 pr-10 rounded-3xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-colors"
          />
          {searchTerm && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              aria-label="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="ml-4">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        >
          {theme === 'light' ? (
            <>
              <Moon size={18} className="text-gray-700" />
              <span className="text-sm font-medium text-gray-700">Light Mode</span>
            </>
          ) : (
            <>
              <Sun size={18} className="text-yellow-400" />
              <span className="text-sm font-medium text-gray-300">Dark Mode</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add frontend-src/src/features/dashboard/pages/DashboardPage.tsx frontend-src/src/features/dashboard/components/TopBar.tsx
git commit -m "feat: lift searchTerm state to DashboardPage, wire TopBar with clear button and Escape key"
```

---

### Task 11: Wire `ReadingSection` to `searchTerm` with debounce

**Files:**
- Modify: `frontend-src/src/features/dashboard/components/ReadingSection.tsx`

- [ ] **Step 1: Add `searchTerm` and `onSearchClear` props; add debounce + filter + count display**

Replace the entire `ReadingSection.tsx`:
```tsx
import { useState, useMemo, useEffect } from 'react';
import { ChevronDown, Grid2X2, List } from 'lucide-react';
import ReadingCard from './ReadingCard';
import type { DocumentItem, SortMode, TypeFilter } from '../types';

// Mock data — preserved until DocumentsContext wires in (Batch B)
const mockDocuments: DocumentItem[] = [
  { id: 1, title: 'Testing Techniques', subtitle: 'Testing techniques in test case development', type: 'book', lastOpened: '2026-02-10', coverImage: '/assets/images/testing.png' },
  { id: 2, title: 'Research Draft', subtitle: 'Reading preview text', type: 'report', lastOpened: '2026-02-18', coverImage: '/assets/images/research.jpg' },
  { id: 3, title: 'Meeting Summary', subtitle: 'Sprint call highlights', type: 'report', lastOpened: '2026-01-27', coverImage: '/assets/images/meeting.jpg' },
  { id: 4, title: 'Design System', subtitle: 'Component library documentation', type: 'book', lastOpened: '2026-02-15', coverImage: '/assets/images/design.png' },
];

interface ReadingSectionProps {
  searchTerm: string;
  onSearchClear: () => void;
}

export default function ReadingSection({ searchTerm, onSearchClear }: ReadingSectionProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortMode, setSortMode] = useState<SortMode>('recent');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState(searchTerm);

  // 300 ms debounce
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const filteredAndSortedDocuments = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    return mockDocuments
      .filter((doc) => {
        if (typeFilter !== 'all' && doc.type !== typeFilter) return false;
        if (q.length < 1) return true;
        return (
          doc.title.toLowerCase().includes(q) ||
          doc.subtitle.toLowerCase().includes(q) ||
          doc.type.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        switch (sortMode) {
          case 'recent': return new Date(b.lastOpened).getTime() - new Date(a.lastOpened).getTime();
          case 'oldest': return new Date(a.lastOpened).getTime() - new Date(b.lastOpened).getTime();
          case 'a-z': return a.title.localeCompare(b.title);
          case 'z-a': return b.title.localeCompare(a.title);
          default: return 0;
        }
      });
  }, [sortMode, typeFilter, debouncedSearch]);

  const getSortLabel = () => ({ recent: 'Most Recent', oldest: 'Oldest', 'a-z': 'A-Z', 'z-a': 'Z-A' }[sortMode] ?? 'Most Recent');
  const getTypeLabel = () => ({ all: 'Type', book: 'Book', report: 'Report' }[typeFilter] ?? 'Type');

  const isFiltered = debouncedSearch.length >= 1;
  const total = mockDocuments.filter((d) => typeFilter === 'all' || d.type === typeFilter).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300">
            Your Reading Documents 📁
          </h3>
          {isFiltered && (
            <span className="text-xs text-gray-500 dark:text-gray-400">
              Showing {filteredAndSortedDocuments.length} of {total}
            </span>
          )}
        </div>

        <div className="flex gap-2 text-sm items-center">
          {/* Sort Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setSortDropdownOpen(!sortDropdownOpen); setTypeDropdownOpen(false); }}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              {getSortLabel()}
              <ChevronDown size={14} className={`transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {sortDropdownOpen && (
              <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                {(['recent', 'oldest', 'a-z', 'z-a'] as SortMode[]).map((mode) => (
                  <button key={mode} onClick={() => { setSortMode(mode); setSortDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                    {{ recent: 'Most Recent', oldest: 'Oldest', 'a-z': 'A-Z', 'z-a': 'Z-A' }[mode]}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Type Filter Dropdown */}
          <div className="relative">
            <button
              onClick={() => { setTypeDropdownOpen(!typeDropdownOpen); setSortDropdownOpen(false); }}
              className="px-3 py-1 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors flex items-center gap-1"
            >
              {getTypeLabel()}
              <ChevronDown size={14} className={`transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {typeDropdownOpen && (
              <div className="absolute right-0 mt-2 w-32 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-10">
                {(['all', 'book', 'report'] as TypeFilter[]).map((f) => (
                  <button key={f} onClick={() => { setTypeFilter(f); setTypeDropdownOpen(false); }}
                    className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors capitalize">
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* View Mode */}
          <div className="flex items-center gap-1 ml-2">
            <button onClick={() => setViewMode('grid')}
              className={`p-2 rounded-full transition-colors ${viewMode === 'grid' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              aria-label="Grid view">
              <Grid2X2 size={18} />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`p-2 rounded-full transition-colors ${viewMode === 'list' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'}`}
              aria-label="List view">
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      <div className={viewMode === 'grid' ? 'grid sm:grid-cols-2 gap-6' : 'space-y-4'}>
        {filteredAndSortedDocuments.map((doc) => (
          <ReadingCard key={doc.id} document={doc} viewMode={viewMode} />
        ))}
      </div>

      {filteredAndSortedDocuments.length === 0 && (
        <div className="mt-8 text-center">
          {isFiltered ? (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                No results for "{debouncedSearch}"
              </p>
              <button
                onClick={onSearchClear}
                className="text-sm text-primary hover:text-primary-dark transition-colors font-medium"
              >
                Clear search
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No documents matched your current filters.
            </p>
          )}
        </div>
      )}

      {(sortDropdownOpen || typeDropdownOpen) && (
        <div className="fixed inset-0 z-0" onClick={() => { setSortDropdownOpen(false); setTypeDropdownOpen(false); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend-src && npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add frontend-src/src/features/dashboard/components/ReadingSection.tsx
git commit -m "feat: ReadingSection — live search with 300ms debounce, result count, 'No results' empty state"
```
