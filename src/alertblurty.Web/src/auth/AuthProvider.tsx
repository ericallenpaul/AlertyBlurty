import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  login as loginRequest,
  register as registerRequest,
} from "../api/auth";
import { clearToken, getToken, setToken } from "./tokenStore";
import { decodeAuthToken, type AuthClaims } from "./jwt";
import type { AuthResponse, LoginRequest, RegisterRequest } from "../types/api";

type AuthProviderProps = {
  children: ReactNode;
};

type AuthContextValue = {
  token: string | null;
  claims: AuthClaims | null;
  isAuthenticated: boolean;
  login: (request: LoginRequest) => Promise<AuthResponse | null>;
  register: (request: RegisterRequest) => Promise<AuthResponse | null>;
  logout: () => void;
  refreshFromToken: (token: string | null) => AuthClaims | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: AuthProviderProps) {
  const [authState, setAuthState] = useState(() => {
    const storedToken = getToken();
    const claims = decodeAuthToken(storedToken);

    if (storedToken && !claims) {
      clearToken();
    }

    return {
      token: claims ? storedToken : null,
      claims,
    };
  });

  const refreshFromToken = useCallback((token: string | null) => {
    const claims = decodeAuthToken(token);

    if (token && claims) {
      setToken(token);
      setAuthState({ token, claims });
      return claims;
    }

    clearToken();
    setAuthState({ token: null, claims: null });
    return null;
  }, []);

  const login = useCallback(
    async (request: LoginRequest) => {
      const response = await loginRequest(request);
      return response && refreshFromToken(response.token) ? response : null;
    },
    [refreshFromToken],
  );

  const register = useCallback(
    async (request: RegisterRequest) => {
      const response = await registerRequest(request);
      return response && refreshFromToken(response.token) ? response : null;
    },
    [refreshFromToken],
  );

  const logout = useCallback(() => {
    clearToken();
    setAuthState({ token: null, claims: null });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token: authState.token,
      claims: authState.claims,
      isAuthenticated: authState.claims !== null,
      login,
      register,
      logout,
      refreshFromToken,
    }),
    [
      authState.claims,
      authState.token,
      login,
      logout,
      refreshFromToken,
      register,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }

  return context;
}
