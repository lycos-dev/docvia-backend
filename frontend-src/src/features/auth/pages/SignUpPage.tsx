import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SignUpForm } from '../components/SignUpForm';
import type { SignUpFormData } from '../types';

export const SignUpPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSignUp = async (data: SignUpFormData) => {
    setIsLoading(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1500));
    
    console.log('Sign up data:', data);
    
    // TODO: Implement actual registration logic
    setIsLoading(false);
    // navigate('/dashboard');
    
    alert('Account created successfully! (Mock)');
  };

  const handleSignInClick = () => {
    navigate('/signin');
  };

  return (
    <div className="min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card border rounded-2xl border-gray-100 shadow-md px-12 py-12">
          {/* Heading */}
          <div className="mb-8">
            <h1 className="text-[34px] text-gray-800 font-medium mb-2 tracking-normal leading-tight select-none">
              Create your account
            </h1>
            <p className="text-[15px] text-text-secondary font-normal select-none">
              Already have an account?{" "}
              <button
                onClick={handleSignInClick}
                className="text-primary hover:text-primary-dark font-medium transition-colors cursor-pointer"
              >
                Sign in
              </button>
            </p>
          </div>

          {/* Form */}
          <SignUpForm
            onSubmit={handleSignUp}
            onSignInClick={handleSignInClick}
            isLoading={isLoading}
          />
        </div>
      </div>
    </div>
  );
};
