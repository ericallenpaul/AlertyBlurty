import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthContext } from "../auth/AuthContext";
import { UserRole } from "../types/api";
import { OnCallCalendarPage } from "./OnCallCalendarPage";

const teamsApi = vi.hoisted(() => ({
  getTeamMembers: vi.fn(),
  getTeamsByOrganization: vi.fn(),
}));

const schedulesApi = vi.hoisted(() => ({
  createSchedule: vi.fn(),
  generateScheduleShifts: vi.fn(),
  getScheduleShifts: vi.fn(),
  getTeamSchedules: vi.fn(),
  getTeamSwapRequests: vi.fn(),
}));

vi.mock("../api/teams", () => teamsApi);
vi.mock("../api/schedules", () => schedulesApi);

describe("OnCallCalendarPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    teamsApi.getTeamsByOrganization.mockResolvedValue([
      {
        id: "team-id",
        createdAtUtc: "2026-06-11T00:00:00Z",
        organizationId: "org-id",
        name: "Platform",
        description: "Platform team",
        requireAdminApprovalForSwaps: false,
      },
    ]);
    teamsApi.getTeamMembers.mockResolvedValue([
      {
        id: "member-one",
        createdAtUtc: "2026-06-11T00:00:00Z",
        teamId: "team-id",
        userId: "user-one",
        rotationOrder: 1,
        isActive: true,
        userFullName: "Member One",
      },
    ]);
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
    schedulesApi.getScheduleShifts.mockResolvedValue([]);
    schedulesApi.getTeamSwapRequests.mockResolvedValue([]);
  });

  it("shows the on-call calendar tab with team schedules", async () => {
    renderPage();

    expect(
      await screen.findByRole("heading", { name: "On-Call Calendar" }),
    ).toBeVisible();
    expect(screen.getByLabelText("Team")).toHaveValue("team-id");
    expect(screen.getByText("No shifts generated yet.")).toBeVisible();
  });

  it("opens the create schedule wizard from the calendar page", async () => {
    schedulesApi.createSchedule.mockResolvedValue({
      id: "new-schedule-id",
      createdAtUtc: "2026-06-11T00:00:00Z",
      teamId: "team-id",
      name: "Secondary",
      frequency: 1,
      startTimeUtc: "2026-06-11T00:00:00Z",
      durationMinutes: 1440,
      isActive: true,
    });
    schedulesApi.generateScheduleShifts.mockResolvedValue([]);

    renderPage();

    await userEvent.click(
      await screen.findByRole("button", { name: "Create Schedule" }),
    );
    await userEvent.type(screen.getByLabelText("Schedule name"), "Secondary");
    await userEvent.clear(screen.getByLabelText("End time"));
    await userEvent.type(screen.getByLabelText("End time"), "2026-06-18T00:00");
    await userEvent.click(
      screen.getByRole("button", { name: "Create On-Call Schedule" }),
    );

    await waitFor(() =>
      expect(schedulesApi.createSchedule).toHaveBeenCalledWith({
        teamId: "team-id",
        name: "Secondary",
        frequency: 1,
        startTimeUtc: expect.any(String),
        durationMinutes: 1440,
      }),
    );
    expect(schedulesApi.generateScheduleShifts).toHaveBeenCalledWith(
      "new-schedule-id",
      { endTimeUtc: "2026-06-18T04:00:00.000Z" },
    );
  });
});

function renderPage() {
  render(
    <AuthContext.Provider
      value={{
        claims: {
          email: "admin@example.com",
          expiresAt: 9999999999,
          organizationId: "org-id",
          role: UserRole.Admin,
          userId: "admin-id",
        },
        isAuthenticated: true,
        login: vi.fn(),
        logout: vi.fn(),
        refreshFromToken: vi.fn(),
        register: vi.fn(),
        token: "token",
      }}
    >
      <MemoryRouter>
        <OnCallCalendarPage />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
}
