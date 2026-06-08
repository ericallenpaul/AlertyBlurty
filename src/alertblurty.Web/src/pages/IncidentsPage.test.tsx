import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { IncidentStatus, type IncidentDto } from "../types/api";
import { IncidentsPage } from "./IncidentsPage";

const incidentsApi = vi.hoisted(() => ({
  acknowledgeIncident: vi.fn(),
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
    triggerDescription: "",
    severity: 5,
    firstOccurrenceUtc: "2026-06-08T12:00:00Z",
    lastOccurrenceUtc: "2026-06-08T12:05:00Z",
    eventCount: 1,
    status,
    teamName: "Platform",
  };
}

describe("IncidentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("acknowledges an open incident and refreshes the list", async () => {
    incidentsApi.getOpenIncidents
      .mockResolvedValueOnce([incident("1", IncidentStatus.Open)])
      .mockResolvedValueOnce([]);
    incidentsApi.acknowledgeIncident.mockResolvedValue(
      incident("1", IncidentStatus.Acknowledged),
    );

    render(
      <MemoryRouter>
        <IncidentsPage />
      </MemoryRouter>,
    );

    await userEvent.click(await screen.findByRole("button", { name: "Ack" }));

    await waitFor(() =>
      expect(incidentsApi.acknowledgeIncident).toHaveBeenCalledWith("1"),
    );
    expect(incidentsApi.getOpenIncidents).toHaveBeenCalledTimes(2);
    expect(await screen.findByText("No incidents found")).toBeVisible();
  });

  it("does not show status filters that the open endpoint cannot support", async () => {
    incidentsApi.getOpenIncidents.mockResolvedValue([
      incident("1", IncidentStatus.Open),
    ]);

    render(
      <MemoryRouter>
        <IncidentsPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Open Incidents")).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /acknowledged/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /resolved/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /^all/i }),
    ).not.toBeInTheDocument();
  });
});
