import { type FormEvent, useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";
import type { EventClickArg, EventInput } from "@fullcalendar/core";

import {
  approveSwapRequest,
  createSchedule,
  createSwapRequest,
  generateScheduleShifts,
  getScheduleShifts,
  getTeamSchedules,
  getTeamSwapRequests,
  rejectSwapRequest,
} from "../../api/schedules";
import {
  ScheduleFrequency,
  ShiftSwapRequestStatus,
  type OnCallScheduleDto,
  type OnCallShiftDto,
  type ShiftSwapRequestDto,
  type TeamMemberDto,
} from "../../types/api";
import { ErrorAlert } from "../ErrorAlert";

type TeamSchedulePanelProps = {
  teamId: string;
  members: TeamMemberDto[];
  currentUserId?: string;
  canManage: boolean;
};

function toInputDateTime(value: Date) {
  return value.toISOString().slice(0, 16);
}

function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function shiftStatusText(shift: OnCallShiftDto) {
  if (shift.hasPendingSwapRequest) {
    return `Pending swap to ${shift.pendingSwapTargetUserFullName ?? shift.pendingSwapTargetUserId}`;
  }

  return shift.isSwapped ? "Swapped" : "Scheduled";
}

export function TeamSchedulePanel({
  teamId,
  members,
  currentUserId,
  canManage,
}: TeamSchedulePanelProps) {
  const [schedules, setSchedules] = useState<OnCallScheduleDto[]>([]);
  const [selectedScheduleId, setSelectedScheduleId] = useState("");
  const [shifts, setShifts] = useState<OnCallShiftDto[]>([]);
  const [swapRequests, setSwapRequests] = useState<ShiftSwapRequestDto[]>([]);
  const [scheduleName, setScheduleName] = useState("");
  const [startTime, setStartTime] = useState(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return toInputDateTime(now);
  });
  const [endTime, setEndTime] = useState(() => {
    const now = new Date();
    now.setMinutes(0, 0, 0);
    return toInputDateTime(addDays(now, 8));
  });
  const [swapTargets, setSwapTargets] = useState<Record<string, string>>({});
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [showCreateWizard, setShowCreateWizard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const activeMembers = useMemo(
    () => members.filter((member) => member.isActive),
    [members],
  );
  const selectedShift = useMemo(
    () => shifts.find((shift) => shift.id === selectedShiftId) ?? shifts[0],
    [selectedShiftId, shifts],
  );
  const calendarEvents = useMemo<EventInput[]>(
    () =>
      shifts.map((shift) => ({
        id: shift.id,
        title: shift.userFullName ?? shift.userId,
        start: shift.startTimeUtc,
        end: shift.endTimeUtc,
        backgroundColor: shift.hasPendingSwapRequest
          ? "#ffc107"
          : shift.isSwapped
            ? "#198754"
            : "#0d6efd",
        borderColor: shift.hasPendingSwapRequest
          ? "#ffc107"
          : shift.isSwapped
            ? "#198754"
            : "#0d6efd",
        textColor: shift.hasPendingSwapRequest ? "#212529" : "#ffffff",
      })),
    [shifts],
  );

  async function loadSchedules() {
    const loadedSchedules = await getTeamSchedules(teamId);
    setSchedules(loadedSchedules);
    setSelectedScheduleId(
      (existing) => existing || loadedSchedules[0]?.id || "",
    );
    return loadedSchedules;
  }

  async function loadScheduleData(scheduleId: string) {
    if (!scheduleId) {
      setShifts([]);
      setSelectedShiftId("");
      return;
    }

    const loadedShifts = await getScheduleShifts(scheduleId);
    setShifts(loadedShifts);
    setSelectedShiftId((current) =>
      loadedShifts.some((shift) => shift.id === current)
        ? current
        : loadedShifts[0]?.id || "",
    );
  }

  async function loadSwapRequests() {
    if (!canManage) {
      setSwapRequests([]);
      return;
    }

    setSwapRequests(await getTeamSwapRequests(teamId));
  }

  async function loadAll() {
    try {
      setError(null);
      const loadedSchedules = await loadSchedules();
      const scheduleId = selectedScheduleId || loadedSchedules[0]?.id || "";
      await loadScheduleData(scheduleId);
      await loadSwapRequests();
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load schedule data.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void Promise.resolve().then(loadAll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId, canManage]);

  useEffect(() => {
    void Promise.resolve().then(() => loadScheduleData(selectedScheduleId));
  }, [selectedScheduleId]);

  async function handleCreateSchedule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      const schedule = await createSchedule({
        teamId,
        name: scheduleName.trim(),
        frequency: ScheduleFrequency.Daily,
        startTimeUtc: new Date(startTime).toISOString(),
        durationMinutes: 1440,
      });
      await generateScheduleShifts(schedule.id, {
        endTimeUtc: new Date(endTime).toISOString(),
      });
      setScheduleName("");
      setShowCreateWizard(false);
      setSelectedScheduleId(schedule.id);
      setSuccess("Schedule created and shifts generated.");
      await loadAll();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to create schedule.",
      );
    }
  }

  async function handleGenerateShifts() {
    if (!selectedScheduleId) {
      return;
    }

    try {
      setError(null);
      setShifts(await generateScheduleShifts(selectedScheduleId, { count: 8 }));
      setSuccess("Shifts generated.");
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate shifts.",
      );
    }
  }

  async function handleRequestSwap(shift: OnCallShiftDto) {
    const targetUserId = swapTargets[shift.id];
    if (!targetUserId) {
      setError("Select a swap target.");
      return;
    }

    try {
      setError(null);
      await createSwapRequest(shift.id, { targetUserId, requesterNote: "" });
      setSuccess("Swap request submitted.");
      await loadScheduleData(selectedScheduleId);
      await loadSwapRequests();
    } catch (swapError) {
      setError(
        swapError instanceof Error
          ? swapError.message
          : "Failed to request swap.",
      );
    }
  }

  async function handleApprove(swapRequestId: string) {
    try {
      setError(null);
      await approveSwapRequest(swapRequestId, { decisionNote: "" });
      setSuccess("Swap approved.");
      await loadScheduleData(selectedScheduleId);
      await loadSwapRequests();
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "Failed to approve swap.",
      );
    }
  }

  async function handleReject(swapRequestId: string) {
    try {
      setError(null);
      await rejectSwapRequest(swapRequestId, { decisionNote: "" });
      setSuccess("Swap rejected.");
      await loadScheduleData(selectedScheduleId);
      await loadSwapRequests();
    } catch (rejectError) {
      setError(
        rejectError instanceof Error
          ? rejectError.message
          : "Failed to reject swap.",
      );
    }
  }

  const pendingSwapRequests = swapRequests.filter(
    (request) => request.status === ShiftSwapRequestStatus.Pending,
  );
  const selectedShiftCanRequestSwap =
    selectedShift != null &&
    currentUserId === selectedShift.userId &&
    !selectedShift.hasPendingSwapRequest;
  const selectedShiftTargetMembers = selectedShift
    ? activeMembers.filter((member) => member.userId !== selectedShift.userId)
    : [];

  function handleEventClick(eventClick: EventClickArg) {
    setSelectedShiftId(eventClick.event.id);
  }

  return (
    <div className="card shadow mt-4">
      <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
        <h2 className="h5 mb-0">Schedule</h2>
        {canManage ? (
          <div className="d-flex gap-2">
            <button
              className="btn btn-light btn-sm"
              onClick={() => setShowCreateWizard(true)}
              type="button"
            >
              Create Schedule
            </button>
            {selectedScheduleId ? (
              <button
                className="btn btn-outline-light btn-sm"
                onClick={() => void handleGenerateShifts()}
                type="button"
              >
                Update Future Schedule
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="card-body">
        {isLoading ? <p className="text-muted">Loading schedule...</p> : null}
        {error ? <ErrorAlert>{error}</ErrorAlert> : null}
        {success ? (
          <div className="alert alert-success" role="status">
            {success}
          </div>
        ) : null}

        {schedules.length > 1 ? (
          <div className="mb-3">
            <label className="form-label" htmlFor="scheduleSelect">
              Active schedule
            </label>
            <select
              className="form-select"
              id="scheduleSelect"
              onChange={(event) => setSelectedScheduleId(event.target.value)}
              value={selectedScheduleId}
            >
              {schedules.map((schedule) => (
                <option key={schedule.id} value={schedule.id}>
                  {schedule.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {shifts.length === 0 ? (
          <p className="text-muted mb-0">No shifts generated yet.</p>
        ) : (
          <div className="team-schedule-grid">
            <div
              className="team-schedule-calendar"
              aria-label="Team schedule calendar"
            >
              <FullCalendar
                eventClick={handleEventClick}
                events={calendarEvents}
                headerToolbar={{
                  left: "prev,next today",
                  center: "title",
                  right: "dayGridMonth,timeGridWeek",
                }}
                height="auto"
                initialView="dayGridMonth"
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              />
            </div>
            {selectedShift ? (
              <aside
                className="team-schedule-details"
                aria-label="Shift details"
              >
                <h3 className="h6">Shift Details</h3>
                <dl className="mb-3">
                  <dt>Assignee</dt>
                  <dd>{selectedShift.userFullName ?? selectedShift.userId}</dd>
                  <dt>Start</dt>
                  <dd>{formatDateTime(selectedShift.startTimeUtc)}</dd>
                  <dt>End</dt>
                  <dd>{formatDateTime(selectedShift.endTimeUtc)}</dd>
                  <dt>Status</dt>
                  <dd>{shiftStatusText(selectedShift)}</dd>
                </dl>
                {selectedShiftCanRequestSwap ? (
                  <div className="d-grid gap-2">
                    <label
                      className="form-label"
                      htmlFor={`swapTarget-${selectedShift.id}`}
                    >
                      Swap target
                    </label>
                    <select
                      aria-label="Swap target"
                      className="form-select form-select-sm"
                      id={`swapTarget-${selectedShift.id}`}
                      onChange={(event) =>
                        setSwapTargets((current) => ({
                          ...current,
                          [selectedShift.id]: event.target.value,
                        }))
                      }
                      value={swapTargets[selectedShift.id] ?? ""}
                    >
                      <option value="">Select member</option>
                      {selectedShiftTargetMembers.map((member) => (
                        <option key={member.userId} value={member.userId}>
                          {member.userFullName ?? member.userId}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-outline-primary btn-sm"
                      onClick={() => void handleRequestSwap(selectedShift)}
                      type="button"
                    >
                      Request Swap
                    </button>
                  </div>
                ) : (
                  <p className="text-muted small mb-0">
                    No swap action available.
                  </p>
                )}
              </aside>
            ) : null}
          </div>
        )}

        {canManage ? (
          <div className="mt-4">
            <h3 className="h6">Pending Swap Requests</h3>
            {pendingSwapRequests.length === 0 ? (
              <p className="text-muted mb-0">No pending swap requests.</p>
            ) : (
              <div className="list-group">
                {pendingSwapRequests.map((request) => (
                  <div
                    className="list-group-item d-flex justify-content-between align-items-center"
                    key={request.id}
                  >
                    <div>
                      <strong>
                        {request.requestedByUserFullName ??
                          request.requestedByUserId}{" "}
                        to {request.targetUserFullName ?? request.targetUserId}
                      </strong>
                      <div className="text-muted small">
                        {formatDateTime(request.shiftStartTimeUtc)}
                      </div>
                    </div>
                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => void handleApprove(request.id)}
                        type="button"
                      >
                        Approve
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => void handleReject(request.id)}
                        type="button"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </div>
      {showCreateWizard ? (
        <div
          aria-labelledby="create-schedule-dialog-title"
          aria-modal="true"
          className="modal show d-block"
          role="dialog"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          tabIndex={-1}
        >
          <div className="modal-dialog">
            <form className="modal-content" onSubmit={handleCreateSchedule}>
              <div className="modal-header bg-primary text-white">
                <h2
                  className="h5 modal-title"
                  id="create-schedule-dialog-title"
                >
                  Create Schedule
                </h2>
                <button
                  aria-label="Close create schedule dialog"
                  className="btn-close btn-close-white"
                  onClick={() => setShowCreateWizard(false)}
                  type="button"
                />
              </div>
              <div className="modal-body">
                <label className="form-label" htmlFor="scheduleName">
                  Schedule name
                </label>
                <input
                  className="form-control mb-3"
                  id="scheduleName"
                  onChange={(event) => setScheduleName(event.target.value)}
                  required
                  value={scheduleName}
                />
                <label className="form-label" htmlFor="scheduleStart">
                  Start time
                </label>
                <input
                  className="form-control mb-3"
                  id="scheduleStart"
                  onChange={(event) => setStartTime(event.target.value)}
                  type="datetime-local"
                  value={startTime}
                />
                <label className="form-label" htmlFor="scheduleEnd">
                  End time
                </label>
                <input
                  className="form-control"
                  id="scheduleEnd"
                  onChange={(event) => setEndTime(event.target.value)}
                  type="datetime-local"
                  value={endTime}
                />
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowCreateWizard(false)}
                  type="button"
                >
                  Cancel
                </button>
                <button className="btn btn-primary" type="submit">
                  Create On-Call Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
