import type { ReactElement } from "react";
import { Route, Routes } from "react-router-dom";

import { ProtectedRoute } from "./auth/ProtectedRoute";
import { MainLayout } from "./layout/MainLayout";
import { CreateUserPage } from "./pages/CreateUserPage";
import { DashboardPage } from "./pages/DashboardPage";
import { HomeRedirect } from "./pages/HomeRedirect";
import { IncidentDetailsPage } from "./pages/IncidentDetailsPage";
import { IncidentsPage } from "./pages/IncidentsPage";
import { LoginPage } from "./pages/LoginPage";
import { LogoutPage } from "./pages/LogoutPage";
import { SetupPage } from "./pages/SetupPage";
import { TeamDetailsPage } from "./pages/TeamDetailsPage";
import { TeamsPage } from "./pages/TeamsPage";
import { UserDetailsPage } from "./pages/UserDetailsPage";
import { UserInfoPage } from "./pages/UserInfoPage";
import { UsersPage } from "./pages/UsersPage";
import { UserRole } from "./types/api";

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
      <Route path="/setup" element={<SetupPage />} />
      <Route element={<MainLayout />}>
        <Route
          path="/dashboard"
          element={protectedElement(<DashboardPage />)}
        />
        <Route
          path="/incidents"
          element={protectedElement(<IncidentsPage />)}
        />
        <Route
          path="/incidents/:id"
          element={protectedElement(<IncidentDetailsPage />)}
        />
        <Route path="/teams" element={protectedElement(<TeamsPage />)} />
        <Route
          path="/teams/:id"
          element={protectedElement(<TeamDetailsPage />)}
        />
        <Route path="/user-info" element={protectedElement(<UserInfoPage />)} />
        <Route
          path="/users"
          element={protectedElement(<UsersPage />, [UserRole.Admin])}
        />
        <Route
          path="/users/create"
          element={protectedElement(<CreateUserPage />, [UserRole.Admin])}
        />
        <Route
          path="/users/:id"
          element={protectedElement(<UserDetailsPage />, [UserRole.Admin])}
        />
      </Route>
    </Routes>
  );
}
