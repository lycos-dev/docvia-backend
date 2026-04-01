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

const router = createBrowserRouter([
  {
    path: "/",
    element: <Navigate to="/signin" replace />,
  },
  {
    path: "/signin",
    element: <SignInPage />,
  },
  {
    path: "/signup",
    element: <SignUpPage />,
  },
  {
    path: "/forgot-password",
    element: <ForgotPasswordPage />,
  },
  {
    path: "/create-new-password",
    element: <CreateNewPasswordPage />,
  },
  {
    path: "/dashboard",
    element: (
      <DashboardLayout>
        <DashboardPage />
      </DashboardLayout>
    ),
  },
  // ── Roadmap renders fullscreen (no sidebar/topbar) ──
  {
    path: "/roadmap",
    element: <RoadmapPage />,
  },
  {
    path: "/progress",
    element: (
      <DashboardLayout>
        <ProgressPage />
      </DashboardLayout>
    ),
  },
  {
    path: "/settings",
    element: (
      <DashboardLayout>
        <SettingsPage />
      </DashboardLayout>
    ),
  },
  {
    path: "*",
    element: <Navigate to="/signin" replace />,
  },
]);

export const AppRouter: React.FC = () => {
  return <RouterProvider router={router} />;
};