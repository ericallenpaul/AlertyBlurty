import { http } from "./http";
import type {
  AddTeamMemberRequest,
  CreateTeamRequest,
  TeamDto,
  TeamMemberDto,
  UpdateTeamRequest,
} from "../types/api";

export async function getTeam(id: string): Promise<TeamDto> {
  const response = await http.get<TeamDto>(`/api/teams/${id}`);
  return response.data;
}

export async function getTeamsByOrganization(
  organizationId: string,
): Promise<TeamDto[]> {
  const response = await http.get<TeamDto[]>(
    `/api/teams/organization/${organizationId}`,
  );
  return response.data;
}

export async function createTeam(request: CreateTeamRequest): Promise<TeamDto> {
  const response = await http.post<TeamDto>("/api/teams", request);
  return response.data;
}

export async function updateTeam(
  id: string,
  request: UpdateTeamRequest,
): Promise<TeamDto> {
  const response = await http.put<TeamDto>(`/api/teams/${id}`, request);
  return response.data;
}

export async function deleteTeam(id: string): Promise<void> {
  await http.delete(`/api/teams/${id}`);
}

export async function getTeamMembers(teamId: string): Promise<TeamMemberDto[]> {
  const response = await http.get<TeamMemberDto[]>(
    `/api/teams/${teamId}/members`,
  );
  return response.data;
}

export async function addTeamMember(
  teamId: string,
  request: AddTeamMemberRequest,
): Promise<TeamMemberDto> {
  const response = await http.post<TeamMemberDto>(
    `/api/teams/${teamId}/members`,
    request,
  );
  return response.data;
}

export async function removeTeamMember(
  teamId: string,
  userId: string,
): Promise<void> {
  await http.delete(`/api/teams/${teamId}/members/${userId}`);
}
