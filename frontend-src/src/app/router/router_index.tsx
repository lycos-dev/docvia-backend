import React from "react";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";

import { SignInPage } from "../../features/auth/pages/SignInPage";
import { SignUpPage } from "../../features/auth/pages/SignUpPage";
import { ForgotPasswordPage } from "../../features/auth/pages/ForgotPasswordPage";
import { CreateNewPasswordPage } from "../../features/auth/pages/CreateNewPasswordPage";
import DashboardPage from "../../features/dashboard/pages/DashboardPage";
import ProgressPage from "../../features/dashboard/pages/ProgressPage";
import SettingsPage from "../../features/dashboard/pages/SettingsPage";
import RoadmapPage from "../../features/roadmap/pages/RoadmapPage";
import DashboardLayout from "../../features/dashboard/components/DashboardLayout";
import { ProtectedRoute } from "./ProtectedRoute";

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/signin" replace /> },
  { path: "/signin", element: <SignInPage /> },
  { path: "/signup", element: <SignUpPage /> },
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
    path: "/roadmap",
    element: (
      <ProtectedRoute>
        <RoadmapPage />
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
  {
    path: "/settings",
    element: (
      <ProtectedRoute>
        <DashboardLayout><SettingsPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  { path: "*", element: <Navigate to="/signin" replace /> },
]);

export const AppRouter: React.FC = () => <RouterProvider router={router} />;
