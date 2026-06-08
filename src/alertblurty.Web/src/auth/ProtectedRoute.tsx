import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "./AuthProvider";
import type { UserRole } from "../types/api";

type ProtectedRouteProps = {
  children: ReactNode;
  requiredRoles?: UserRole[];
};

export function ProtectedRoute({
  children,
  requiredRoles = [],
}: ProtectedRouteProps) {
  const { claims, isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (requiredRoles.length > 0 && !requiredRoles.includes(claims!.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
