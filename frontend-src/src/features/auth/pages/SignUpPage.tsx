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
