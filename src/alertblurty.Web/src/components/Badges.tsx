import { IncidentStatus, UserRole } from "../types/api";

export function SeverityBadge({ severity }: { severity: number }) {
  return (
    <span className={`badge ${severityBadgeClass(severity)}`}>
      {severityText(severity)}
    </span>
  );
}

export function StatusBadge({ status }: { status: IncidentStatus }) {
  return (
    <span className={`badge ${statusBadgeClass(status)}`}>
      {IncidentStatus[status]}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span className={`badge ${roleBadgeClass(role)}`}>{roleText(role)}</span>
  );
}

function severityText(severity: number) {
  switch (severity) {
    case 5:
      return "Disaster";
    case 4:
      return "High";
    case 3:
      return "Average";
    case 2:
      return "Warning";
    case 1:
      return "Information";
    default:
      return "Unknown";
  }
}

function severityBadgeClass(severity: number) {
  switch (severity) {
    case 5:
    case 4:
      return "bg-danger";
    case 3:
      return "bg-warning text-dark";
    case 2:
      return "badge-alerty";
    case 1:
      return "bg-info";
    default:
      return "bg-secondary";
  }
}

function statusBadgeClass(status: IncidentStatus) {
  switch (status) {
    case IncidentStatus.Open:
      return "bg-danger text-white";
    case IncidentStatus.Acknowledged:
      return "bg-warning text-dark";
    case IncidentStatus.Resolved:
      return "bg-success text-white";
    default:
      return "bg-secondary text-white";
  }
}

function roleBadgeClass(role: UserRole) {
  switch (role) {
    case UserRole.SuperAdmin:
      return "badge-alerty-red";
    case UserRole.Admin:
      return "badge-alerty";
    case UserRole.User:
      return "bg-info";
    default:
      return "bg-secondary";
  }
}

function roleText(role: UserRole) {
  switch (role) {
    case UserRole.SuperAdmin:
      return "SuperAdmin";
    case UserRole.Admin:
      return "Admin";
    case UserRole.User:
      return "User";
    default:
      return "Unknown";
  }
}
