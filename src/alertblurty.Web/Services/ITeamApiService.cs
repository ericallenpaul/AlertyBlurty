using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Teams;

namespace alertblurty.Web.Services;

public interface ITeamApiService
{
    Task<TeamDto?> GetByIdAsync(Guid id);
    Task<List<TeamDto>> GetByOrganizationAsync(Guid organizationId);
    Task<TeamDto?> CreateAsync(CreateTeamRequest request);
    Task<TeamDto?> UpdateAsync(Guid id, UpdateTeamRequest request);
    Task<bool> DeleteAsync(Guid id);
    Task<List<TeamMemberDto>> GetMembersAsync(Guid teamId);
    Task<TeamMemberDto?> AddMemberAsync(Guid teamId, AddTeamMemberRequest request);
    Task<bool> RemoveMemberAsync(Guid teamId, Guid userId);
}
