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

      <Button type="submit" variant="primary" className="w-full cursor-pointer" isLoading={isLoading}>
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
