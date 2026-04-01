using alertblurty.Models.DTOs;

namespace alertblurty.Models.Interfaces;

public interface ITeamRepository
{
    Task<TeamDto?> GetByIdAsync(Guid id, bool includeMembers = false, CancellationToken cancellationToken = default);
    Task<List<TeamDto>> GetByOrganizationIdAsync(Guid organizationId, CancellationToken cancellationToken = default);
    Task<TeamDto> CreateAsync(TeamDto team, CancellationToken cancellationToken = default);
    Task<TeamDto> UpdateAsync(TeamDto team, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<TeamMemberDto> AddMemberAsync(TeamMemberDto member, CancellationToken cancellationToken = default);
    Task RemoveMemberAsync(Guid teamId, Guid userId, CancellationToken cancellationToken = default);
    Task<List<TeamMemberDto>> GetTeamMembersAsync(Guid teamId, CancellationToken cancellationToken = default);
}
