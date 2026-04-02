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
