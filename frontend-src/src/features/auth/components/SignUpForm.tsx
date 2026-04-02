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
