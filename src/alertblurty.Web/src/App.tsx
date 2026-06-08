import type { ReactElement } from "react";
import { Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./auth/ProtectedRoute";
import { MainLayout } from "./layout/MainLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { HomeRedirect } from "./pages/HomeRedirect";
import { LoginPage } from "./pages/LoginPage";
import { LogoutPage } from "./pages/LogoutPage";
import { UserRole } from "./types/api";

function PlaceholderPage({ title }: { title: string }) {
  return (
    <section>
      <h1 className="h2">{title}</h1>
      <p className="text-muted">This page will be implemented in Task 4.</p>
    </section>
  );
}

function protectedElement(element: ReactElement, requiredRoles?: UserRole[]) {
  return (
    <ProtectedRoute requiredRoles={requiredRoles}>{element}</ProtectedRoute>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/logout" element={<LogoutPage />} />
      <Route element={<MainLayout />}>
        <Route
          path="/dashboard"
          element={protectedElement(<DashboardPage />)}
        />
        <Route
          path="/incidents"
          element={protectedElement(<PlaceholderPage title="Incidents" />)}
        />
        <Route
          path="/teams"
          element={protectedElement(<PlaceholderPage title="Teams" />)}
        />
        <Route
          path="/user-info"
          element={protectedElement(<PlaceholderPage title="User Info" />)}
        />
        <Route
          path="/users"
          element={protectedElement(<PlaceholderPage title="Users" />, [
            UserRole.Admin,
            UserRole.SuperAdmin,
          ])}
        />
        <Route
          path="/setup"
          element={protectedElement(<PlaceholderPage title="Setup" />, [
            UserRole.Admin,
            UserRole.SuperAdmin,
          ])}
        />
      </Route>
    </Routes>
  );
}
