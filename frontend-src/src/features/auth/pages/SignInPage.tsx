import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { SignInForm } from '../components/SignInForm';
import type { SignInFormData } from '../types';
import { motion } from 'framer-motion';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    console.log('Sign in data:', data);
    setIsLoading(false);
    navigate("/dashboard");
  };

  const handleSignUpClick = () => {
    navigate('/signup');
  };

  const handleForgotPasswordClick = () => {
    navigate('/forgot-password');
  };

  return (
    <motion.div
  initial={{ opacity: 0, y: 0 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.5, ease: 'easeIn' }}
  className = "min-h-screen w-full bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="bg-card border border-gray-100 rounded-3xl shadow-lg px-12 py-12 select-none">
          {/* Logo */}
          <Logo />

          {/* Heading */}
          <div className="text-center mb-8">
            <h1 className="text-[35px] text-gray-800 font-medium text-shadow-md mb-2 tracking-normal leading-tight select-none">
              Welcome to Docvia
            </h1>
            <p className="text-[15px] text-text-secondary font-normal select-none">
              Turn reading into progress.
            </p>
          </div>

          {/* Form */}
          <SignInForm
            onSubmit={handleSignIn}
            onSignUpClick={handleSignUpClick}
            onForgotPasswordClick={handleForgotPasswordClick}
            isLoading={isLoading}
          />
        </div>
      </div>
    </motion.div>
  );
};