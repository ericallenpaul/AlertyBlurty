import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentStatus, type IncidentDto } from "../types/api";
import { DashboardPage } from "./DashboardPage";

const incidentsApi = vi.hoisted(() => ({
  getOpenIncidents: vi.fn(),
}));

vi.mock("../api/incidents", () => incidentsApi);

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
});
