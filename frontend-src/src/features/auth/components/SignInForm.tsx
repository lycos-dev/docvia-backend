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
