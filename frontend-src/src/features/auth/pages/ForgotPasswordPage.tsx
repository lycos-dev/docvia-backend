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
      <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="bg-card border rounded-2xl border-gray-100 shadow-md px-12 py-12 text-center">
            <h1 className="text-3xl text-gray-800 font-medium mb-4 select-none">
              Check your inbox
            </h1>
            <p className="text-text-secondary mb-6 select-none">
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
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card border rounded-2xl border-gray-100 shadow-md px-12 py-12">
          <div className="mb-6">
            <h1 className="text-4xl text-gray-800 font-medium mb-2 tracking-normal leading-tight select-none">
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
