import { http } from "./http";
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserDto,
} from "../types/api";

export async function getMe(): Promise<UserDto> {
  const response = await http.get<UserDto>("/api/users/me");
  return response.data;
}

export async function getUser(id: string): Promise<UserDto> {
  const response = await http.get<UserDto>(`/api/users/${id}`);
  return response.data;
}

export async function getUsersByOrganization(
  organizationId: string,
): Promise<UserDto[]> {
  const response = await http.get<UserDto[]>(
    `/api/users/organization/${organizationId}`,
  );
  return response.data;
}

export async function createUser(request: CreateUserRequest): Promise<UserDto> {
  const response = await http.post<UserDto>("/api/users", request);
  return response.data;
}

export async function updateUser(
  id: string,
  request: UpdateUserRequest,
): Promise<UserDto> {
  const response = await http.put<UserDto>(`/api/users/${id}`, request);
  return response.data;
}

export async function deleteUser(id: string): Promise<void> {
  await http.delete(`/api/users/${id}`);
}
