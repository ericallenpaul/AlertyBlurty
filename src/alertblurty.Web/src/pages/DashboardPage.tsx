import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getOpenIncidents } from "../api/incidents";
import { getActiveSchedules, getScheduleShifts } from "../api/schedules";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import {
  IncidentStatus,
  type IncidentDto,
  type OnCallScheduleDto,
  type OnCallShiftDto,
} from "../types/api";
import { errorMessage, formatDate } from "./pageUtils";

export function DashboardPage() {
  const [incidents, setIncidents] = useState<IncidentDto[]>([]);
  const [coverage, setCoverage] = useState<CoverageRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function loadDashboard() {
      try {
        setError(null);
        const [loadedIncidents, loadedCoverage] = await Promise.all([
          getOpenIncidents(),
          loadCoverage(),
        ]);
        setIncidents(loadedIncidents);
        setCoverage(loadedCoverage);
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
      acknowledged: 0,
      resolved: 0,
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
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h2 className="h5 mb-0">On-Call Coverage</h2>
          <Link className="btn btn-light btn-sm" to="/on-call-calendar">
            View Calendar
          </Link>
        </div>
        <div className="card-body">
          {coverage.length === 0 ? (
            <p className="text-muted mb-0">No active on-call schedules.</p>
          ) : (
            <div className="row g-3">
              {coverage.map((row) => (
                <div className="col-md-6 col-xl-4" key={row.schedule.id}>
                  <div className="border rounded p-3 h-100 bg-white">
                    <h3 className="h6 mb-3">
                      {row.schedule.teamName ?? "Team"} / {row.schedule.name}
                    </h3>
                    <dl className="mb-0">
                      <dt className="text-muted small">Current</dt>
                      <dd className="fw-semibold">
                        {row.current?.userFullName ?? "Unassigned"}
                      </dd>
                      <dt className="text-muted small">On deck</dt>
                      <dd className="mb-0 fw-semibold">
                        {row.next?.userFullName ?? "Unassigned"}
                      </dd>
                    </dl>
                  </div>
                </div>
              ))}
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

type CoverageRow = {
  schedule: OnCallScheduleDto;
  current?: OnCallShiftDto;
  next?: OnCallShiftDto;
};

async function loadCoverage(): Promise<CoverageRow[]> {
  const schedules = await getActiveSchedules();
  const now = new Date();

  return Promise.all(
    schedules.map(async (schedule) => {
      const shifts = await getScheduleShifts(schedule.id);
      const current = shifts.find((shift) => {
        const start = new Date(shift.startTimeUtc);
        const end = new Date(shift.endTimeUtc);
        return start <= now && end > now;
      });
      const next = shifts.find((shift) => new Date(shift.startTimeUtc) > now);

      return { schedule, current, next };
    }),
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
