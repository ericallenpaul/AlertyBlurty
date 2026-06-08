import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { acknowledgeIncident, getOpenIncidents } from "../api/incidents";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { IncidentStatus, type IncidentDto } from "../types/api";
import { errorMessage, formatDate } from "./pageUtils";

type StatusFilter = IncidentStatus | "all";

export function IncidentsPage() {
  const [incidents, setIncidents] = useState<IncidentDto[]>([]);
  const [filter, setFilter] = useState<StatusFilter>(IncidentStatus.Open);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);

  async function loadIncidents() {
    try {
      setError(null);
      setIncidents(await getOpenIncidents());
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load incidents"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadIncidents);
  }, []);

  const counts = useMemo(
    () => ({
      open: incidents.filter(
        (incident) => incident.status === IncidentStatus.Open,
      ).length,
      acknowledged: incidents.filter(
        (incident) => incident.status === IncidentStatus.Acknowledged,
      ).length,
      resolved: incidents.filter(
        (incident) => incident.status === IncidentStatus.Resolved,
      ).length,
    }),
    [incidents],
  );
  const filtered =
    filter === "all"
      ? incidents
      : incidents.filter((incident) => incident.status === filter);

  async function handleAcknowledge(id: string) {
    setAcknowledgingId(id);
    setError(null);

    try {
      await acknowledgeIncident(id);
      await loadIncidents();
    } catch (ackError) {
      setError(errorMessage(ackError, "Error acknowledging incident"));
    } finally {
      setAcknowledgingId(null);
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading incidents..." />;
  }

  return (
    <section>
      <div className="row mb-4">
        <div className="col">
          <h1 className="h2">Incidents</h1>
          <p className="text-muted">View and manage active incidents</p>
        </div>
      </div>
      {error ? <ErrorAlert>{error}</ErrorAlert> : null}
      <div className="card shadow mb-4">
        <div className="card-body">
          <ul className="nav nav-tabs">
            <FilterButton
              active={filter === IncidentStatus.Open}
              label={`Open (${counts.open})`}
              onClick={() => setFilter(IncidentStatus.Open)}
            />
            <FilterButton
              active={filter === IncidentStatus.Acknowledged}
              label={`Acknowledged (${counts.acknowledged})`}
              onClick={() => setFilter(IncidentStatus.Acknowledged)}
            />
            <FilterButton
              active={filter === IncidentStatus.Resolved}
              label={`Resolved (${counts.resolved})`}
              onClick={() => setFilter(IncidentStatus.Resolved)}
            />
            <FilterButton
              active={filter === "all"}
              label={`All (${incidents.length})`}
              onClick={() => setFilter("all")}
            />
          </ul>
        </div>
      </div>
      <div className="card shadow">
        <div className="card-header bg-primary text-white">
          <h2 className="h5 mb-0">
            {filter === "all"
              ? "All Incidents"
              : `${IncidentStatus[filter]} Incidents`}
          </h2>
        </div>
        <div className="card-body">
          {filtered.length === 0 ? (
            <div className="text-center py-4 text-muted">
              No incidents found
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Trigger</th>
                    <th>Host</th>
                    <th>Status</th>
                    <th>Team</th>
                    <th>First Occurrence</th>
                    <th>Last Occurrence</th>
                    <th>Count</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((incident) => (
                    <tr key={incident.id}>
                      <td>
                        <SeverityBadge severity={incident.severity} />
                      </td>
                      <td>
                        <strong>{incident.triggerName}</strong>
                      </td>
                      <td>{incident.hostName}</td>
                      <td>
                        <StatusBadge status={incident.status} />
                      </td>
                      <td>{incident.teamName ?? "Unassigned"}</td>
                      <td>{formatDate(incident.firstOccurrenceUtc)}</td>
                      <td>{formatDate(incident.lastOccurrenceUtc)}</td>
                      <td>
                        <span className="badge bg-secondary">
                          {incident.eventCount}
                        </span>
                      </td>
                      <td>
                        {incident.status === IncidentStatus.Open ? (
                          <button
                            className="btn btn-sm btn-warning"
                            disabled={acknowledgingId === incident.id}
                            onClick={() => void handleAcknowledge(incident.id)}
                            type="button"
                          >
                            {acknowledgingId === incident.id ? "Ack..." : "Ack"}
                          </button>
                        ) : (
                          <Link
                            className="btn btn-sm btn-outline-primary"
                            to={`/incidents/${incident.id}`}
                          >
                            View
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <li className="nav-item">
      <button
        className={`nav-link${active ? " active" : ""}`}
        onClick={onClick}
        type="button"
      >
        {label}
      </button>
    </li>
  );
}
