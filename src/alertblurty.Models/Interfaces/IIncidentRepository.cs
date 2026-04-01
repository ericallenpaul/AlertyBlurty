using alertblurty.Models.DTOs;

namespace alertblurty.Models.Interfaces;

public interface IIncidentRepository
{
    Task<IncidentDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<IncidentDto?> GetByZabbixEventIdAsync(string eventId, CancellationToken cancellationToken = default);
    Task<IncidentDto?> GetOpenIncidentByHostAndTriggerAsync(string hostName, string triggerId, CancellationToken cancellationToken = default);
    Task<List<IncidentDto>> GetByTeamIdAsync(Guid teamId, IncidentStatus? status = null, CancellationToken cancellationToken = default);
    Task<List<IncidentDto>> GetOpenIncidentsAsync(CancellationToken cancellationToken = default);
    Task<IncidentDto> CreateAsync(IncidentDto incident, CancellationToken cancellationToken = default);
    Task<IncidentDto> UpdateAsync(IncidentDto incident, CancellationToken cancellationToken = default);
    Task AcknowledgeAsync(Guid incidentId, Guid userId, CancellationToken cancellationToken = default);
    Task ResolveAsync(Guid incidentId, CancellationToken cancellationToken = default);
    Task IncrementEventCountAsync(Guid incidentId, CancellationToken cancellationToken = default);
}
