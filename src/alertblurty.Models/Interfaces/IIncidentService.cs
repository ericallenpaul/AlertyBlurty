using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Incidents;

namespace alertblurty.Models.Interfaces;

public interface IIncidentService
{
    Task<IncidentDto> ProcessZabbixWebhookAsync(ZabbixWebhookRequest request, Guid teamId, CancellationToken cancellationToken = default);
    Task<IncidentDto> AcknowledgeIncidentAsync(Guid incidentId, Guid userId, CancellationToken cancellationToken = default);
    Task NotifyOnCallUserAsync(IncidentDto incident, CancellationToken cancellationToken = default);
    Task<UserDto?> GetCurrentOnCallUserAsync(Guid teamId, CancellationToken cancellationToken = default);
}
