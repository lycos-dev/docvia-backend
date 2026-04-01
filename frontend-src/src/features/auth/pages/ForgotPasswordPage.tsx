import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ForgotPasswordForm } from '../components/ForgotPasswordForm';
import type { ForgotPasswordFormData } from '../types';

export const ForgotPasswordPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleForgotPassword = async (data: ForgotPasswordFormData) => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    console.log('Forgot password data:', data);
    
    // TODO: Implement actual password reset logic
    setIsLoading(false);
    
    // alert('Password reset link sent to your email! (Mock)');
    navigate('/create-new-password');
  };

  const handleSignInClick = () => {
    navigate('/signin');
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card border rounded-2xl border-gray-100 shadow-md px-12 py-12">
          {/* Heading */}
          <div className="mb-6">
            <h1 className="text-4xl text-gray-800 font-medium mb-2 tracking-normal leading-tight select-none">
              Reset your password
            </h1>
          </div>

          {/* Form */}
          <ForgotPasswordForm
            onSubmit={handleForgotPassword}
            onSignInClick={handleSignInClick}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
