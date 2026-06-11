import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { TeamMemberDto } from "../../types/api";
import { TeamSchedulePanel } from "./TeamSchedulePanel";

const schedulesApi = vi.hoisted(() => ({
  approveSwapRequest: vi.fn(),
  createSchedule: vi.fn(),
  createSwapRequest: vi.fn(),
  generateScheduleShifts: vi.fn(),
  getScheduleShifts: vi.fn(),
  getTeamSchedules: vi.fn(),
  getTeamSwapRequests: vi.fn(),
}));

vi.mock("../../api/schedules", () => schedulesApi);

const members: TeamMemberDto[] = [
  {
    id: "member-one",
    createdAtUtc: "2026-06-11T00:00:00Z",
    teamId: "team-id",
    userId: "user-one",
    rotationOrder: 1,
    isActive: true,
    userFullName: "Member One",
    userEmail: "one@example.com",
  },
  {
    id: "member-two",
    createdAtUtc: "2026-06-11T00:00:00Z",
    teamId: "team-id",
    userId: "user-two",
    rotationOrder: 2,
    isActive: true,
    userFullName: "Member Two",
    userEmail: "two@example.com",
  },
];

describe("TeamSchedulePanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schedulesApi.getTeamSchedules.mockResolvedValue([
      {
        id: "schedule-id",
        createdAtUtc: "2026-06-11T00:00:00Z",
        teamId: "team-id",
        name: "Primary",
        frequency: 1,
        startTimeUtc: "2026-06-11T00:00:00Z",
        durationMinutes: 1440,
        isActive: true,
      },
    ]);
    schedulesApi.getScheduleShifts.mockResolvedValue([
      {
        id: "shift-id",
        createdAtUtc: "2026-06-11T00:00:00Z",
        scheduleId: "schedule-id",
        userId: "user-one",
        startTimeUtc: "2026-06-11T00:00:00Z",
        endTimeUtc: "2026-06-12T00:00:00Z",
        isSwapped: false,
        hasPendingSwapRequest: false,
        userFullName: "Member One",
      },
    ]);
    schedulesApi.getTeamSwapRequests.mockResolvedValue([]);
  });

  it("lets the assigned member request a swap", async () => {
    schedulesApi.createSwapRequest.mockResolvedValue({
      id: "swap-id",
      status: 3,
      shiftId: "shift-id",
    });

    render(
      <TeamSchedulePanel
        canManage={false}
        currentUserId="user-one"
        members={members}
        teamId="team-id"
      />,
    );

    await screen.findByRole("button", { name: "Request Swap" });
    await userEvent.selectOptions(screen.getByLabelText("Swap target"), [
      "user-two",
    ]);
    await userEvent.click(screen.getByRole("button", { name: "Request Swap" }));

    await waitFor(() =>
      expect(schedulesApi.createSwapRequest).toHaveBeenCalledWith("shift-id", {
        targetUserId: "user-two",
        requesterNote: "",
      }),
    );
  });

  it("lets admins create a schedule for a selected time period", async () => {
    schedulesApi.getTeamSchedules.mockResolvedValueOnce([]);
    schedulesApi.createSchedule.mockResolvedValue({
      id: "schedule-id",
      createdAtUtc: "2026-06-11T00:00:00Z",
      teamId: "team-id",
      name: "Primary",
      frequency: 1,
      startTimeUtc: "2026-06-11T00:00:00Z",
      durationMinutes: 1440,
      isActive: true,
    });
    schedulesApi.generateScheduleShifts.mockResolvedValue([]);

    render(
      <TeamSchedulePanel
        canManage
        currentUserId="admin-id"
        members={members}
        teamId="team-id"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Create Schedule" }),
    );
    await userEvent.type(screen.getByLabelText("Schedule name"), "Primary");
    await userEvent.clear(screen.getByLabelText("Start time"));
    await userEvent.type(
      screen.getByLabelText("Start time"),
      "2026-06-11T00:00",
    );
    await userEvent.clear(screen.getByLabelText("End time"));
    await userEvent.type(screen.getByLabelText("End time"), "2026-06-18T00:00");
    await userEvent.click(
      screen.getByRole("button", { name: "Create On-Call Schedule" }),
    );

    await waitFor(() =>
      expect(schedulesApi.createSchedule).toHaveBeenCalledWith({
        teamId: "team-id",
        name: "Primary",
        frequency: 1,
        startTimeUtc: expect.any(String),
        durationMinutes: 1440,
      }),
    );
    expect(schedulesApi.generateScheduleShifts).toHaveBeenCalledWith(
      "schedule-id",
      { endTimeUtc: "2026-06-18T04:00:00.000Z" },
    );
  });

  it("lets admins refresh future shifts after roster changes", async () => {
    render(
      <TeamSchedulePanel
        canManage
        currentUserId="admin-id"
        members={members}
        teamId="team-id"
      />,
    );

    await userEvent.click(
      await screen.findByRole("button", { name: "Update Future Schedule" }),
    );

    await waitFor(() =>
      expect(schedulesApi.generateScheduleShifts).toHaveBeenCalledWith(
        "schedule-id",
        { count: 8 },
      ),
    );
  });

  it("lets admins approve pending swap requests", async () => {
    schedulesApi.getTeamSwapRequests.mockResolvedValue([
      {
        id: "swap-id",
        createdAtUtc: "2026-06-11T00:00:00Z",
        shiftId: "shift-id",
        scheduleId: "schedule-id",
        teamId: "team-id",
        requestedByUserId: "user-one",
        targetUserId: "user-two",
        status: 0,
        requiresApprovalSnapshot: true,
        requestedAtUtc: "2026-06-11T00:00:00Z",
        requesterNote: "",
        decisionNote: "",
        requestedByUserFullName: "Member One",
        targetUserFullName: "Member Two",
        shiftStartTimeUtc: "2026-06-11T00:00:00Z",
        shiftEndTimeUtc: "2026-06-12T00:00:00Z",
      },
    ]);
    schedulesApi.approveSwapRequest.mockResolvedValue({ id: "swap-id" });

    render(
      <TeamSchedulePanel
        canManage
        currentUserId="admin-id"
        members={members}
        teamId="team-id"
      />,
    );

    await screen.findByText(/Member One to Member Two/);
    await userEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(schedulesApi.approveSwapRequest).toHaveBeenCalledWith("swap-id", {
        decisionNote: "",
      }),
    );
  });
});
