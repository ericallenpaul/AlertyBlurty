import { createContext } from "react";

import type { AuthResponse, LoginRequest, RegisterRequest } from "../types/api";
import type { AuthClaims } from "./jwt";

export type AuthContextValue = {
  token: string | null;
  claims: AuthClaims | null;
  isAuthenticated: boolean;
  login: (request: LoginRequest) => Promise<AuthResponse | null>;
  register: (request: RegisterRequest) => Promise<AuthResponse | null>;
  logout: () => void;
  refreshFromToken: (token: string | null) => AuthClaims | null;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
