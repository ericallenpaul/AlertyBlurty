using Microsoft.Extensions.Logging;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Incidents;

namespace alertblurty.Data.Services;

public class IncidentService : IIncidentService
{
    private readonly IIncidentRepository _incidentRepository;
    private readonly IScheduleRepository _scheduleRepository;
    private readonly IUserRepository _userRepository;
    private readonly INotificationService _notificationService;
    private readonly ILogger<IncidentService> _logger;

    public IncidentService(
        IIncidentRepository incidentRepository,
        IScheduleRepository scheduleRepository,
        IUserRepository userRepository,
        INotificationService notificationService,
        ILogger<IncidentService> logger)
    {
        _incidentRepository = incidentRepository;
        _scheduleRepository = scheduleRepository;
        _userRepository = userRepository;
        _notificationService = notificationService;
        _logger = logger;
    }

    public async Task<IncidentDto> ProcessZabbixWebhookAsync(
        ZabbixWebhookRequest request,
        Guid teamId,
        CancellationToken cancellationToken = default)
    {
        // Check if this is a resolved event
        if (request.Status.Equals("OK", StringComparison.OrdinalIgnoreCase) ||
            request.Status.Equals("RESOLVED", StringComparison.OrdinalIgnoreCase))
        {
            // Try to resolve existing incident
            var existingIncident = await _incidentRepository.GetOpenIncidentByHostAndTriggerAsync(
                request.HostName, request.TriggerId, cancellationToken);

            if (existingIncident != null)
            {
                await _incidentRepository.ResolveAsync(existingIncident.Id, cancellationToken);
                _logger.LogInformation("Incident {IncidentId} resolved for {HostName}/{TriggerId}",
                    existingIncident.Id, request.HostName, request.TriggerId);

                return await _incidentRepository.GetByIdAsync(existingIncident.Id, cancellationToken)
                    ?? existingIncident;
            }

            // If no existing incident, just log and return null incident
            _logger.LogInformation("Received OK status for {HostName}/{TriggerId} but no open incident found",
                request.HostName, request.TriggerId);

            throw new InvalidOperationException("No open incident found to resolve");
        }

        // Check if we already have an open incident for this host + trigger combo
        var incident = await _incidentRepository.GetOpenIncidentByHostAndTriggerAsync(
            request.HostName, request.TriggerId, cancellationToken);

        if (incident != null)
        {
            // Increment event count for existing incident
            await _incidentRepository.IncrementEventCountAsync(incident.Id, cancellationToken);
            _logger.LogInformation("Incremented event count for incident {IncidentId}. Host: {HostName}, Trigger: {TriggerId}",
                incident.Id, request.HostName, request.TriggerId);

            return await _incidentRepository.GetByIdAsync(incident.Id, cancellationToken) ?? incident;
        }

        // Create new incident
        var newIncident = new IncidentDto
        {
            TeamId = teamId,
            ZabbixEventId = request.EventId,
            ZabbixTriggerId = request.TriggerId,
            HostName = request.HostName,
            TriggerName = request.TriggerName,
            TriggerDescription = request.TriggerDescription,
            Severity = request.Severity,
            FirstOccurrenceUtc = request.EventTime,
            LastOccurrenceUtc = request.EventTime,
            EventCount = 1,
            Status = IncidentStatus.Open
        };

        var createdIncident = await _incidentRepository.CreateAsync(newIncident, cancellationToken);
        _logger.LogInformation("Created new incident {IncidentId} for {HostName}/{TriggerId}",
            createdIncident.Id, request.HostName, request.TriggerId);

        // Notify on-call user
        await NotifyOnCallUserAsync(createdIncident, cancellationToken);

        return createdIncident;
    }

    public async Task<IncidentDto> AcknowledgeIncidentAsync(
        Guid incidentId,
        Guid userId,
        CancellationToken cancellationToken = default)
    {
        var incident = await _incidentRepository.GetByIdAsync(incidentId, cancellationToken)
            ?? throw new KeyNotFoundException($"Incident {incidentId} not found");

        if (incident.Status != IncidentStatus.Open)
        {
            throw new InvalidOperationException($"Incident {incidentId} is not open");
        }

        await _incidentRepository.AcknowledgeAsync(incidentId, userId, cancellationToken);
        _logger.LogInformation("Incident {IncidentId} acknowledged by user {UserId}", incidentId, userId);

        return await _incidentRepository.GetByIdAsync(incidentId, cancellationToken) ?? incident;
    }

    public async Task NotifyOnCallUserAsync(IncidentDto incident, CancellationToken cancellationToken = default)
    {
        var onCallUser = await GetCurrentOnCallUserAsync(incident.TeamId, cancellationToken);
        if (onCallUser == null)
        {
            _logger.LogWarning("No on-call user found for team {TeamId}. Cannot send notification for incident {IncidentId}",
                incident.TeamId, incident.Id);
            return;
        }

        var message = $"[AlertyBlurty] ALERT: {incident.HostName} - {incident.TriggerName}\n" +
                     $"Severity: {incident.Severity}\n" +
                     $"Description: {incident.TriggerDescription}\n" +
                     $"Event ID: {incident.ZabbixEventId}";

        try
        {
            await _notificationService.CreateNotificationAsync(
                incident.Id,
                onCallUser.Id,
                onCallUser.PhoneNumber,
                message,
                cancellationToken);

            _logger.LogInformation("Sent notification for incident {IncidentId} to user {UserId}",
                incident.Id, onCallUser.Id);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send notification for incident {IncidentId} to user {UserId}",
                incident.Id, onCallUser.Id);
        }
    }

    public async Task<UserDto?> GetCurrentOnCallUserAsync(Guid teamId, CancellationToken cancellationToken = default)
    {
        var currentShift = await _scheduleRepository.GetCurrentShiftAsync(teamId, DateTime.UtcNow, cancellationToken);
        if (currentShift == null)
        {
            _logger.LogWarning("No current shift found for team {TeamId}", teamId);
            return null;
        }

        var user = await _userRepository.GetByIdAsync(currentShift.UserId, cancellationToken);
        if (user == null)
        {
            _logger.LogWarning("User {UserId} not found for current shift", currentShift.UserId);
            return null;
        }

        return user;
    }
}
