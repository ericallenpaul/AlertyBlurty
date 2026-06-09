import { http } from "./http";
import type { BootstrapSetupRequest, SetupStatusResponse } from "../types/api";

export async function getSetupStatus(): Promise<SetupStatusResponse> {
  const response = await http.get<SetupStatusResponse>("/api/setup/status");
  return response.data;
}

export async function bootstrapSetup(
  request: BootstrapSetupRequest,
): Promise<void> {
  await http.post("/api/setup/bootstrap", request);
}
