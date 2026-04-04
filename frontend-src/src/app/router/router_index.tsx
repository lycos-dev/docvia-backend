import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

import { SignInPage } from "../../features/auth/pages/SignInPage";
import { SignUpPage } from "../../features/auth/pages/SignUpPage";
import { ForgotPasswordPage } from "../../features/auth/pages/ForgotPasswordPage";
import { CreateNewPasswordPage } from "../../features/auth/pages/CreateNewPasswordPage";
import { OAuthCallbackPage } from "../../features/auth/pages/OAuthCallbackPage";
import DashboardPage from "../../features/dashboard/pages/DashboardPage";
import ProgressPage from "../../features/dashboard/pages/ProgressPage";
import RoadmapPage from "../../features/roadmap/pages/RoadmapPage";
import ReaderPage from "../../features/reader/pages/ReaderPage";
import DashboardLayout from "../../features/dashboard/components/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/signin" replace /> },
  { path: "/signin", element: <SignInPage /> },
  { path: "/signup", element: <SignUpPage /> },
  { path: "/auth/callback", element: <OAuthCallbackPage /> },
  { path: "/forgot-password", element: <ForgotPasswordPage /> },
  { path: "/create-new-password", element: <CreateNewPasswordPage /> },
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout><DashboardPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/roadmap/:documentId",
    element: (
      <ProtectedRoute>
        <RoadmapPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/reader/:documentId/:lessonId",
    element: (
      <ProtectedRoute>
        <ReaderPage />
      </ProtectedRoute>
    ),
  },
  {
    path: "/progress",
    element: (
      <ProtectedRoute>
        <DashboardLayout><ProgressPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  { path: "*", element: <Navigate to="/signin" replace /> },
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
