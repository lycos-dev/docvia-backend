import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { SignInForm } from '../components/SignInForm';
import type { SignInFormData } from '../types';
import { motion } from 'framer-motion';
import { useAuth } from '../../../shared/contexts/AuthContext';

export const SignInPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | undefined>(undefined);

  const handleSignIn = async (data: SignInFormData) => {
    setIsLoading(true);
    setError(undefined);
    const result = await login(data.email, data.password);
    setIsLoading(false);
    if (result.success) {
      navigate('/dashboard');
    } else {
      setError(result.error ?? 'Sign in failed. Please try again.');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 0 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeIn' }}
      className="min-h-screen w-full bg-background flex items-center justify-center p-4"
    >
      <div className="w-full max-w-lg">
        <div className="bg-card border border-gray-100 rounded-3xl shadow-lg px-12 py-12 select-none">
          <Logo />
          <div className="text-center mb-8">
            <h1 className="text-[35px] text-gray-800 font-medium text-shadow-md mb-2 tracking-normal leading-tight select-none">
              Welcome to Docvia
            </h1>
            <p className="text-[15px] text-text-secondary font-normal select-none">
              Turn reading into progress.
            </p>
          </div>
          {error && (
            <p className="text-sm text-red-500 text-center mb-4">{error}</p>
          )}
          <SignInForm
            onSubmit={handleSignIn}
            onSignUpClick={() => navigate('/signup')}
            onForgotPasswordClick={() => navigate('/forgot-password')}
            isLoading={isLoading}
          />
        </div>
      </div>
    </motion.div>
  );
};
