import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getOpenIncidents } from "../api/incidents";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { IncidentStatus, type IncidentDto } from "../types/api";
import { errorMessage, formatDate } from "./pageUtils";

export function DashboardPage() {
  const [incidents, setIncidents] = useState<IncidentDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError(null);
        setIncidents(await getOpenIncidents());
      } catch (loadError) {
        setError(errorMessage(loadError, "Failed to load dashboard"));
      } finally {
        setIsLoading(false);
      }
    }

    void loadDashboard();
  }, []);

  const counts = useMemo(
    () => ({
      active: incidents.filter(
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

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  if (error) {
    return <ErrorAlert>{error}</ErrorAlert>;
  }

  return (
    <section>
      <div className="row mb-4">
        <div className="col">
          <h1 className="h2">Dashboard</h1>
          <p className="text-muted">Welcome back</p>
        </div>
      </div>

      <div className="row mb-4 g-3">
        <SummaryCard
          border="danger"
          label="Active Incidents"
          testId="active-incidents-count"
          value={counts.active}
        />
        <SummaryCard
          border="warning"
          label="Acknowledged"
          testId="acknowledged-count"
          value={counts.acknowledged}
        />
        <SummaryCard
          border="info"
          label="My Teams"
          testId="my-teams-count"
          value={0}
        />
        <SummaryCard
          border="success"
          label="Resolved Today"
          testId="resolved-today-count"
          value={counts.resolved}
        />
      </div>

      <div className="card shadow">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h2 className="h5 mb-0">Active Incidents</h2>
          <Link className="btn btn-light btn-sm" to="/incidents">
            View All
          </Link>
        </div>
        <div className="card-body">
          {incidents.length === 0 ? (
            <p className="text-muted mb-0">
              No active incidents. All systems operational!
            </p>
          ) : (
            <div className="table-responsive">
              <table className="table table-hover">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Team</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.slice(0, 10).map((incident) => (
                    <tr key={incident.id}>
                      <td>
                        <SeverityBadge severity={incident.severity} />
                      </td>
                      <td>{incident.triggerName}</td>
                      <td>
                        <StatusBadge status={incident.status} />
                      </td>
                      <td>{incident.teamName ?? "Unassigned"}</td>
                      <td>{formatDate(incident.firstOccurrenceUtc)}</td>
                      <td>
                        <Link
                          className="btn btn-sm btn-outline-primary"
                          to={`/incidents/${incident.id}`}
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card shadow mt-4">
        <div className="card-header bg-primary text-white">
          <h2 className="h5 mb-0">Recent Activity</h2>
        </div>
        <div className="card-body">
          {incidents.length === 0 ? (
            <p className="text-muted mb-0">No recent activity to display.</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {incidents.slice(0, 5).map((incident) => (
                <li
                  className="mb-3 pb-3 border-bottom"
                  key={`activity-${incident.id}`}
                >
                  <div className="d-flex justify-content-between align-items-start">
                    <div>
                      <strong>{incident.triggerName}</strong>{" "}
                      <SeverityBadge severity={incident.severity} />
                      <br />
                      <small className="text-muted">
                        Created {formatDate(incident.firstOccurrenceUtc)}
                      </small>
                    </div>
                    <StatusBadge status={incident.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

function SummaryCard({
  border,
  label,
  testId,
  value,
}: {
  border: string;
  label: string;
  testId: string;
  value: number;
}) {
  return (
    <div className="col-md-3">
      <div className={`card border-${border}`}>
        <div className="card-body">
          <h2 className="h6 text-muted mb-1">{label}</h2>
          <div className="h2 mb-0" data-testid={testId}>
            {value}
          </div>
        </div>
      </div>
    </div>
  );
}
