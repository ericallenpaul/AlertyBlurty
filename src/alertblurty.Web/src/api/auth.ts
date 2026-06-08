import { http } from "./http";
import type {
  ApiResponse,
  AuthResponse,
  LoginRequest,
  RegisterRequest,
} from "../types/api";

export async function register(
  request: RegisterRequest,
): Promise<AuthResponse | null> {
  const response = await http.post<ApiResponse<AuthResponse>>(
    "/api/auth/register",
    request,
  );
  return response.data.data ?? null;
}

export async function login(
  request: LoginRequest,
): Promise<AuthResponse | null> {
  const response = await http.post<ApiResponse<AuthResponse>>(
    "/api/auth/login",
    request,
  );
  return response.data.data ?? null;
}
