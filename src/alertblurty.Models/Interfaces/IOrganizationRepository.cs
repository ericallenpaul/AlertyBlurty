using alertblurty.Models.DTOs;

namespace alertblurty.Models.Interfaces;

public interface IOrganizationRepository
{
    Task<List<OrganizationDto>> GetAllAsync(CancellationToken cancellationToken = default);
    Task<OrganizationDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<OrganizationDto> CreateAsync(OrganizationDto organization, CancellationToken cancellationToken = default);
    Task<OrganizationDto> UpdateAsync(OrganizationDto organization, CancellationToken cancellationToken = default);
    Task CompleteSetupAsync(Guid id, CancellationToken cancellationToken = default);
}
