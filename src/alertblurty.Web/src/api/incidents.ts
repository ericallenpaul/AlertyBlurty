import { http } from "./http";
import type { IncidentDto } from "../types/api";
import { IncidentStatus } from "../types/api";

export async function getIncident(id: string): Promise<IncidentDto> {
  const response = await http.get<IncidentDto>(`/api/incidents/${id}`);
  return response.data;
}

export async function getOpenIncidents(): Promise<IncidentDto[]> {
  const response = await http.get<IncidentDto[]>("/api/incidents/open");
  return response.data;
}

export async function getIncidentsByTeam(
  teamId: string,
  status?: IncidentStatus,
): Promise<IncidentDto[]> {
  const response = await http.get<IncidentDto[]>(
    `/api/incidents/team/${teamId}`,
    {
      params: status === undefined ? undefined : { status },
    },
  );
  return response.data;
}

export async function acknowledgeIncident(id: string): Promise<IncidentDto> {
  const response = await http.post<IncidentDto>(
    `/api/incidents/${id}/acknowledge`,
  );
  return response.data;
}
