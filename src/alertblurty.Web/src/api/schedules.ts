import { http } from "./http";
import type {
  CreateScheduleRequest,
  CreateSwapRequest,
  DecideSwapRequest,
  GenerateShiftsRequest,
  OnCallScheduleDto,
  OnCallShiftDto,
  ShiftSwapRequestDto,
} from "../types/api";

export async function getTeamSchedules(
  teamId: string,
): Promise<OnCallScheduleDto[]> {
  const response = await http.get<OnCallScheduleDto[]>(
    `/api/schedules/team/${teamId}`,
  );
  return response.data;
}

export async function createSchedule(
  request: CreateScheduleRequest,
): Promise<OnCallScheduleDto> {
  const response = await http.post<OnCallScheduleDto>(
    "/api/schedules",
    request,
  );
  return response.data;
}

export async function generateScheduleShifts(
  scheduleId: string,
  request: GenerateShiftsRequest,
): Promise<OnCallShiftDto[]> {
  const response = await http.post<OnCallShiftDto[]>(
    `/api/schedules/${scheduleId}/generate-shifts`,
    request,
  );
  return response.data;
}

export async function getScheduleShifts(
  scheduleId: string,
): Promise<OnCallShiftDto[]> {
  const response = await http.get<OnCallShiftDto[]>(
    `/api/schedules/${scheduleId}/shifts`,
  );
  return response.data;
}

export async function createSwapRequest(
  shiftId: string,
  request: CreateSwapRequest,
): Promise<ShiftSwapRequestDto> {
  const response = await http.post<ShiftSwapRequestDto>(
    `/api/shifts/${shiftId}/swap-requests`,
    request,
  );
  return response.data;
}

export async function getTeamSwapRequests(
  teamId: string,
): Promise<ShiftSwapRequestDto[]> {
  const response = await http.get<ShiftSwapRequestDto[]>(
    `/api/swap-requests/team/${teamId}`,
  );
  return response.data;
}

export async function approveSwapRequest(
  swapRequestId: string,
  request: DecideSwapRequest,
): Promise<ShiftSwapRequestDto> {
  const response = await http.post<ShiftSwapRequestDto>(
    `/api/swap-requests/${swapRequestId}/approve`,
    request,
  );
  return response.data;
}

export async function rejectSwapRequest(
  swapRequestId: string,
  request: DecideSwapRequest,
): Promise<ShiftSwapRequestDto> {
  const response = await http.post<ShiftSwapRequestDto>(
    `/api/swap-requests/${swapRequestId}/reject`,
    request,
  );
  return response.data;
}
