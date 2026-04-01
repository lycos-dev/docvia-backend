import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../shared/contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // Wait for the stored token to be validated before deciding
  if (isLoading) return null;

  if (!isAuthenticated) {
    return <Navigate to="/signin" replace />;
  }

  return <>{children}</>;
}
