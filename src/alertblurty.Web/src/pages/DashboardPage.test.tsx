import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentStatus, type IncidentDto } from "../types/api";
import { DashboardPage } from "./DashboardPage";

const incidentsApi = vi.hoisted(() => ({
  getOpenIncidents: vi.fn(),
}));

vi.mock("../api/incidents", () => incidentsApi);

const schedulesApi = vi.hoisted(() => ({
  getActiveSchedules: vi.fn(),
  getScheduleShifts: vi.fn(),
}));

vi.mock("../api/schedules", () => schedulesApi);

function incident(id: string, status: IncidentStatus): IncidentDto {
  return {
    id,
    createdAtUtc: "2026-06-08T12:00:00Z",
    teamId: "team-id",
    zabbixEventId: `event-${id}`,
    zabbixTriggerId: `trigger-${id}`,
    hostName: "web-01",
    triggerName: `Incident ${id}`,
    triggerDescription: "Description",
    severity: 4,
    firstOccurrenceUtc: "2026-06-08T12:00:00Z",
    lastOccurrenceUtc: "2026-06-08T12:05:00Z",
    eventCount: 2,
    status,
    teamName: "Platform",
  };
}

describe("DashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    schedulesApi.getActiveSchedules.mockResolvedValue([]);
    schedulesApi.getScheduleShifts.mockResolvedValue([]);
  });

  it("summarizes the open incidents returned by the open endpoint", async () => {
    incidentsApi.getOpenIncidents.mockResolvedValue([
      incident("1", IncidentStatus.Open),
      incident("2", IncidentStatus.Open),
    ]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect((await screen.findAllByText("Incident 1"))[0]).toBeVisible();
    expect(screen.getByTestId("active-incidents-count")).toHaveTextContent("2");
    expect(screen.getByTestId("acknowledged-count")).toHaveTextContent("0");
    expect(screen.getByTestId("my-teams-count")).toHaveTextContent("0");
    expect(screen.getByTestId("resolved-today-count")).toHaveTextContent("0");
  });

  it("surfaces current and on-deck members for active schedules", async () => {
    incidentsApi.getOpenIncidents.mockResolvedValue([]);
    schedulesApi.getActiveSchedules.mockResolvedValue([
      {
        id: "schedule-id",
        createdAtUtc: "2026-06-11T00:00:00Z",
        teamId: "team-id",
        name: "Primary",
        frequency: 1,
        startTimeUtc: "2026-06-11T00:00:00Z",
        durationMinutes: 1440,
        isActive: true,
        teamName: "Platform",
      },
    ]);
    schedulesApi.getScheduleShifts.mockResolvedValue([
      {
        id: "current-shift",
        createdAtUtc: "2026-06-11T00:00:00Z",
        scheduleId: "schedule-id",
        userId: "user-one",
        startTimeUtc: "2026-06-11T00:00:00Z",
        endTimeUtc: "2099-06-12T00:00:00Z",
        isSwapped: false,
        hasPendingSwapRequest: false,
        userFullName: "Member One",
      },
      {
        id: "next-shift",
        createdAtUtc: "2026-06-11T00:00:00Z",
        scheduleId: "schedule-id",
        userId: "user-two",
        startTimeUtc: "2099-06-12T00:00:00Z",
        endTimeUtc: "2099-06-13T00:00:00Z",
        isSwapped: false,
        hasPendingSwapRequest: false,
        userFullName: "Member Two",
      },
    ]);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("On-Call Coverage")).toBeVisible();
    expect(screen.getByText("Platform / Primary")).toBeVisible();
    expect(screen.getByText("Member One")).toBeVisible();
    expect(screen.getByText("Member Two")).toBeVisible();
  });
});
