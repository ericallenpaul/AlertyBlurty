using alertblurty.Models.DTOs;

namespace alertblurty.Web.Services;

public interface IIncidentApiService
{
    Task<IncidentDto?> GetByIdAsync(Guid id);
    Task<List<IncidentDto>> GetOpenAsync();
    Task<List<IncidentDto>> GetByTeamAsync(Guid teamId, IncidentStatus? status = null);
    Task<IncidentDto?> AcknowledgeAsync(Guid id);
}
