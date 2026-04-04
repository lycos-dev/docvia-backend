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
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
            </div>
            <h1 className="text-3xl text-gray-800 dark:text-gray-100 font-medium mb-2 select-none">
              Check your inbox
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mb-4 select-none">
              If an account exists for that email, a password reset link has been sent.
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg p-4 mb-6">
              <p className="text-sm text-blue-700 dark:text-blue-300 select-none">
                <strong>Next steps:</strong> Click the link in the email to create a new password. The link expires in 24 hours.
              </p>
            </div>
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
