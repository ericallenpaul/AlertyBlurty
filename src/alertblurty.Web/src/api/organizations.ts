import { http } from "./http";
import type { OrganizationDto } from "../types/api";

export async function getOrganizations(): Promise<OrganizationDto[]> {
  const response = await http.get<OrganizationDto[]>("/api/organizations");
  return response.data;
}

export async function hasOrganizations(): Promise<boolean> {
  const organizations = await getOrganizations();
  return organizations.length > 0;
}
