import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from '../../../shared/components/ui/Input';
import { Button } from '../../../shared/components/ui/Button';
import { Checkbox } from '../../../shared/components/ui/Checkbox';
import { useTheme } from '../../../shared/contexts/ThemeContext';
import { useAuth } from '../../../shared/contexts/AuthContext';
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

export const SignUpForm: React.FC<SignUpFormProps> = ({ onSubmit, onSignInClick, isLoading = false }) => {
  const { theme } = useTheme();
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
                    backgroundColor: strength.score >= level ? strength.color : theme === 'dark' ? '#334155' : '#E5E7EB',
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

      <div className="text-center text-sm text-gray-500 dark:text-gray-400 select-none">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSignInClick}
          className="text-primary hover:text-primary-dark font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
          disabled={isLoading}
        >
          Sign In
        </button>
      </div>
    </form>
  );
};
