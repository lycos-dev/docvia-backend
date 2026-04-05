import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../shared/contexts/AuthContext';

/**
 * OAuth Callback Page
 * 
 * This page handles the redirect from Supabase OAuth (Google login).
 * It extracts the session from the URL fragment and verifies it with the backend.
 * After processing, it redirects to the dashboard.
 */
export const OAuthCallbackPage: React.FC = () => {
  const navigate = useNavigate();
  const { verifyOAuthSession, user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const processCallback = async () => {
      try {
        // Check if we're already authenticated
        if (user) {
          navigate('/dashboard', { replace: true });
          return;
        }

        // The Supabase session is automatically captured in the URL fragment (#access_token=...)
        // Verify the session with our backend and get a JWT token
        const result = await verifyOAuthSession();
        
        if (result.success) {
          // Successfully authenticated - redirect to dashboard
          navigate('/dashboard', { replace: true });
        } else {
          setError(result.error || 'Failed to complete OAuth login. Please try again.');
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('OAuth callback error:', err);
        setError('An unexpected error occurred during OAuth login. Please try again.');
        setIsProcessing(false);
      }
    };

    processCallback();
  }, [navigate, verifyOAuthSession, user]);

  if (isProcessing && !error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-300">Signing you in...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-slate-900">
        <div className="text-center max-w-md">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/signin', { replace: true })}
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors cursor-pointer"
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  return null;
};
