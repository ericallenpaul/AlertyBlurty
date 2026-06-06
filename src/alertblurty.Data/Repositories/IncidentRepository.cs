using Microsoft.EntityFrameworkCore;
using alertblurty.Data.Entities;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;

namespace alertblurty.Data.Repositories;

public class IncidentRepository : IIncidentRepository
{
    private readonly AlertBlurtyDbContext _context;

    public IncidentRepository(AlertBlurtyDbContext context)
    {
        _context = context;
    }

    public async Task<IncidentDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var incident = await _context.Incidents
            .Include(i => i.Team)
            .Include(i => i.AcknowledgedByUser)
            .FirstOrDefaultAsync(i => i.Id == id, cancellationToken);

        return incident == null ? null : MapToDto(incident);
    }

    public async Task<IncidentDto?> GetByZabbixEventIdAsync(string eventId, CancellationToken cancellationToken = default)
    {
        var incident = await _context.Incidents
            .Include(i => i.Team)
            .Include(i => i.AcknowledgedByUser)
            .FirstOrDefaultAsync(i => i.ZabbixEventId == eventId, cancellationToken);

        return incident == null ? null : MapToDto(incident);
    }

    public async Task<IncidentDto?> GetOpenIncidentByHostAndTriggerAsync(Guid teamId, string hostName, string triggerId, CancellationToken cancellationToken = default)
    {
        var incident = await _context.Incidents
            .Include(i => i.Team)
            .Include(i => i.AcknowledgedByUser)
            .FirstOrDefaultAsync(i => i.TeamId == teamId
                && i.HostName == hostName
                && i.ZabbixTriggerId == triggerId
                && i.Status == Entities.IncidentStatus.Open, cancellationToken);

        return incident == null ? null : MapToDto(incident);
    }

    public async Task<List<IncidentDto>> GetByTeamIdAsync(Guid teamId, Models.DTOs.IncidentStatus? status = null, CancellationToken cancellationToken = default)
    {
        var query = _context.Incidents
            .Include(i => i.Team)
            .Include(i => i.AcknowledgedByUser)
            .Where(i => i.TeamId == teamId);

        if (status.HasValue)
        {
            var entityStatus = (Entities.IncidentStatus)status.Value;
            query = query.Where(i => i.Status == entityStatus);
        }

        var incidents = await query
            .OrderByDescending(i => i.FirstOccurrenceUtc)
            .ToListAsync(cancellationToken);

        return incidents.Select(MapToDto).ToList();
    }

    public async Task<List<IncidentDto>> GetOpenIncidentsAsync(CancellationToken cancellationToken = default)
    {
        var incidents = await _context.Incidents
            .Include(i => i.Team)
            .Include(i => i.AcknowledgedByUser)
            .Where(i => i.Status == Entities.IncidentStatus.Open)
            .OrderByDescending(i => i.FirstOccurrenceUtc)
            .ToListAsync(cancellationToken);

        return incidents.Select(MapToDto).ToList();
    }

    public async Task<IncidentDto> CreateAsync(IncidentDto incidentDto, CancellationToken cancellationToken = default)
    {
        var incident = new Incident
        {
            Id = Guid.NewGuid(),
            TeamId = incidentDto.TeamId,
            ZabbixEventId = incidentDto.ZabbixEventId,
            ZabbixTriggerId = incidentDto.ZabbixTriggerId,
            HostName = incidentDto.HostName,
            TriggerName = incidentDto.TriggerName,
            TriggerDescription = incidentDto.TriggerDescription,
            Severity = incidentDto.Severity,
            FirstOccurrenceUtc = incidentDto.FirstOccurrenceUtc,
            LastOccurrenceUtc = incidentDto.LastOccurrenceUtc,
            EventCount = 1,
            Status = Entities.IncidentStatus.Open
        };

        _context.Incidents.Add(incident);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(incident.Id, cancellationToken) ?? throw new InvalidOperationException("Failed to retrieve created incident");
    }

    public async Task<IncidentDto> UpdateAsync(IncidentDto incidentDto, CancellationToken cancellationToken = default)
    {
        var incident = await _context.Incidents.FindAsync(new object[] { incidentDto.Id }, cancellationToken)
            ?? throw new KeyNotFoundException($"Incident with ID {incidentDto.Id} not found");

        incident.TriggerName = incidentDto.TriggerName;
        incident.TriggerDescription = incidentDto.TriggerDescription;
        incident.Severity = incidentDto.Severity;
        incident.LastOccurrenceUtc = incidentDto.LastOccurrenceUtc;
        incident.EventCount = incidentDto.EventCount;

        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(incident.Id, cancellationToken) ?? throw new InvalidOperationException("Failed to retrieve updated incident");
    }

    public async Task AcknowledgeAsync(Guid incidentId, Guid userId, CancellationToken cancellationToken = default)
    {
        var incident = await _context.Incidents.FindAsync(new object[] { incidentId }, cancellationToken)
            ?? throw new KeyNotFoundException($"Incident with ID {incidentId} not found");

        incident.Status = Entities.IncidentStatus.Acknowledged;
        incident.AcknowledgedByUserId = userId;
        incident.AcknowledgedAtUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task ResolveAsync(Guid incidentId, CancellationToken cancellationToken = default)
    {
        var incident = await _context.Incidents.FindAsync(new object[] { incidentId }, cancellationToken)
            ?? throw new KeyNotFoundException($"Incident with ID {incidentId} not found");

        incident.Status = Entities.IncidentStatus.Resolved;

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task IncrementEventCountAsync(Guid incidentId, CancellationToken cancellationToken = default)
    {
        var incident = await _context.Incidents.FindAsync(new object[] { incidentId }, cancellationToken)
            ?? throw new KeyNotFoundException($"Incident with ID {incidentId} not found");

        incident.EventCount++;
        incident.LastOccurrenceUtc = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);
    }

    private static IncidentDto MapToDto(Incident incident)
    {
        return new IncidentDto
        {
            Id = incident.Id,
            TeamId = incident.TeamId,
            ZabbixEventId = incident.ZabbixEventId,
            ZabbixTriggerId = incident.ZabbixTriggerId,
            HostName = incident.HostName,
            TriggerName = incident.TriggerName,
            TriggerDescription = incident.TriggerDescription,
            Severity = incident.Severity,
            FirstOccurrenceUtc = incident.FirstOccurrenceUtc,
            LastOccurrenceUtc = incident.LastOccurrenceUtc,
            EventCount = incident.EventCount,
            Status = (Models.DTOs.IncidentStatus)incident.Status,
            AcknowledgedByUserId = incident.AcknowledgedByUserId,
            AcknowledgedAtUtc = incident.AcknowledgedAtUtc,
            CreatedAtUtc = incident.CreatedAtUtc,
            UpdatedAtUtc = incident.UpdatedAtUtc,
            TeamName = incident.Team?.Name,
            AcknowledgedByUserName = incident.AcknowledgedByUser?.FullName
        };
    }
}
