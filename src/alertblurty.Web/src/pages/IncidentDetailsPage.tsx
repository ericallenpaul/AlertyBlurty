import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import { acknowledgeIncident, getIncident } from "../api/incidents";
import { ErrorAlert } from "../components/ErrorAlert";
import { LoadingState } from "../components/LoadingState";
import { SeverityBadge, StatusBadge } from "../components/Badges";
import { IncidentStatus, type IncidentDto } from "../types/api";
import { errorMessage, formatDate } from "./pageUtils";

export function IncidentDetailsPage() {
  const { id } = useParams();
  const [incident, setIncident] = useState<IncidentDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);

  async function loadIncident() {
    if (!id) {
      setError("Incident id is missing.");
      setIsLoading(false);
      return;
    }

    try {
      setError(null);
      setIncident(await getIncident(id));
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load incident details"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadIncident);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function handleAcknowledge() {
    if (!id) {
      return;
    }

    setIsAcknowledging(true);
    try {
      setIncident(await acknowledgeIncident(id));
    } catch (ackError) {
      setError(errorMessage(ackError, "Error acknowledging incident"));
    } finally {
      setIsAcknowledging(false);
    }
  }

  if (isLoading) {
    return <LoadingState message="Loading incident details..." />;
  }

  if (error || !incident) {
    return (
      <>
        <ErrorAlert>{error ?? "Incident not found."}</ErrorAlert>
        <Link className="btn btn-secondary" to="/incidents">
          Back to Incidents
        </Link>
      </>
    );
  }

  return (
    <section>
      <Link className="btn btn-secondary mb-3" to="/incidents">
        Back to Incidents
      </Link>
      <h1 className="h2">
        Incident Details <StatusBadge status={incident.status} />
      </h1>
      <div className="row">
        <div className="col-lg-8">
          <div className="card shadow mb-4">
            <div className="card-header bg-primary text-white">
              <h2 className="h5 mb-0">Trigger Information</h2>
            </div>
            <div className="card-body">
              <Detail label="Trigger Name" value={incident.triggerName} />
              <Detail label="Host Name" value={incident.hostName} />
              <Detail
                label="Description"
                value={incident.triggerDescription || "None"}
              />
              <p>
                <span className="text-muted small d-block">Severity</span>
                <SeverityBadge severity={incident.severity} />
              </p>
              <Detail label="Team" value={incident.teamName ?? "Unassigned"} />
              <Detail label="Event Count" value={String(incident.eventCount)} />
              <Detail
                label="First Occurrence"
                value={formatDate(incident.firstOccurrenceUtc)}
              />
              <Detail
                label="Last Occurrence"
                value={formatDate(incident.lastOccurrenceUtc)}
              />
            </div>
          </div>
          <div className="card shadow mb-4">
            <div className="card-header bg-primary text-white">
              <h2 className="h5 mb-0">Zabbix References</h2>
            </div>
            <div className="card-body">
              <Detail label="Event ID" value={incident.zabbixEventId} />
              <Detail label="Trigger ID" value={incident.zabbixTriggerId} />
            </div>
          </div>
        </div>
        <div className="col-lg-4">
          <div className="card shadow">
            <div className="card-header bg-primary text-white">
              <h2 className="h5 mb-0">Actions</h2>
            </div>
            <div className="card-body">
              {incident.status === IncidentStatus.Open ? (
                <button
                  className="btn btn-warning w-100"
                  disabled={isAcknowledging}
                  onClick={() => void handleAcknowledge()}
                  type="button"
                >
                  {isAcknowledging
                    ? "Acknowledging..."
                    : "Acknowledge Incident"}
                </button>
              ) : (
                <div className="alert alert-info mb-0">
                  This incident is{" "}
                  {IncidentStatus[incident.status].toLowerCase()}.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-3">
      <span className="text-muted small d-block">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
