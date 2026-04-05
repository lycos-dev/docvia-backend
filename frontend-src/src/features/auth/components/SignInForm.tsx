import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../../shared/components/ui/Input';
import { Button } from '../../../shared/components/ui/Button';
import type { SignInFormData } from '../types';
import { useAuth } from '../../../shared/contexts/AuthContext';

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
  });
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

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
      {/* Google OAuth button */}
      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isLoading || googleLoading}
        className="w-full h-12 flex items-center justify-center gap-3 rounded-xl border border-[#dadce0] dark:border-white/12 bg-white dark:bg-[#1e293b] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
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
            disabled={isLoading}
          >
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        }
      />

      <div className="flex items-center justify-end pt-1">
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
