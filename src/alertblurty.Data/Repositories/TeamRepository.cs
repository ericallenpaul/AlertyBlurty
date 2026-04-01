using Microsoft.EntityFrameworkCore;
using alertblurty.Data.Entities;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;

namespace alertblurty.Data.Repositories;

public class TeamRepository : ITeamRepository
{
    private readonly AlertBlurtyDbContext _context;

    public TeamRepository(AlertBlurtyDbContext context)
    {
        _context = context;
    }

    public async Task<TeamDto?> GetByIdAsync(Guid id, bool includeMembers = false, CancellationToken cancellationToken = default)
    {
        var query = _context.Teams
            .Include(t => t.Organization)
            .AsQueryable();

        if (includeMembers)
        {
            query = query.Include(t => t.Members).ThenInclude(m => m.User);
        }

        var team = await query.FirstOrDefaultAsync(t => t.Id == id, cancellationToken);
        return team == null ? null : MapToDto(team, includeMembers);
    }

    public async Task<List<TeamDto>> GetByOrganizationIdAsync(Guid organizationId, CancellationToken cancellationToken = default)
    {
        var teams = await _context.Teams
            .Include(t => t.Organization)
            .Where(t => t.OrganizationId == organizationId)
            .ToListAsync(cancellationToken);

        return teams.Select(t => MapToDto(t, false)).ToList();
    }

    public async Task<TeamDto> CreateAsync(TeamDto teamDto, CancellationToken cancellationToken = default)
    {
        var team = new Team
        {
            Id = Guid.NewGuid(),
            OrganizationId = teamDto.OrganizationId,
            Name = teamDto.Name,
            Description = teamDto.Description,
            RequireAdminApprovalForSwaps = teamDto.RequireAdminApprovalForSwaps
        };

        _context.Teams.Add(team);
        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(team.Id, false, cancellationToken) ?? throw new InvalidOperationException("Failed to retrieve created team");
    }

    public async Task<TeamDto> UpdateAsync(TeamDto teamDto, CancellationToken cancellationToken = default)
    {
        var team = await _context.Teams.FindAsync(new object[] { teamDto.Id }, cancellationToken)
            ?? throw new KeyNotFoundException($"Team with ID {teamDto.Id} not found");

        team.Name = teamDto.Name;
        team.Description = teamDto.Description;
        team.RequireAdminApprovalForSwaps = teamDto.RequireAdminApprovalForSwaps;

        await _context.SaveChangesAsync(cancellationToken);

        return await GetByIdAsync(team.Id, false, cancellationToken) ?? throw new InvalidOperationException("Failed to retrieve updated team");
    }

    public async Task DeleteAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var team = await _context.Teams.FindAsync(new object[] { id }, cancellationToken)
            ?? throw new KeyNotFoundException($"Team with ID {id} not found");

        _context.Teams.Remove(team);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<TeamMemberDto> AddMemberAsync(TeamMemberDto memberDto, CancellationToken cancellationToken = default)
    {
        var member = new TeamMember
        {
            Id = Guid.NewGuid(),
            TeamId = memberDto.TeamId,
            UserId = memberDto.UserId,
            RotationOrder = memberDto.RotationOrder,
            IsActive = true
        };

        _context.TeamMembers.Add(member);
        await _context.SaveChangesAsync(cancellationToken);

        var createdMember = await _context.TeamMembers
            .Include(m => m.User)
            .Include(m => m.Team)
            .FirstAsync(m => m.Id == member.Id, cancellationToken);

        return MapMemberToDto(createdMember);
    }

    public async Task RemoveMemberAsync(Guid teamId, Guid userId, CancellationToken cancellationToken = default)
    {
        var member = await _context.TeamMembers
            .FirstOrDefaultAsync(m => m.TeamId == teamId && m.UserId == userId, cancellationToken)
            ?? throw new KeyNotFoundException($"Team member not found");

        _context.TeamMembers.Remove(member);
        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<List<TeamMemberDto>> GetTeamMembersAsync(Guid teamId, CancellationToken cancellationToken = default)
    {
        var members = await _context.TeamMembers
            .Include(m => m.User)
            .Include(m => m.Team)
            .Where(m => m.TeamId == teamId)
            .OrderBy(m => m.RotationOrder)
            .ToListAsync(cancellationToken);

        return members.Select(MapMemberToDto).ToList();
    }

    private static TeamDto MapToDto(Team team, bool includeMembers)
    {
        var dto = new TeamDto
        {
            Id = team.Id,
            OrganizationId = team.OrganizationId,
            Name = team.Name,
            Description = team.Description,
            RequireAdminApprovalForSwaps = team.RequireAdminApprovalForSwaps,
            CreatedAtUtc = team.CreatedAtUtc,
            UpdatedAtUtc = team.UpdatedAtUtc,
            OrganizationName = team.Organization?.Name
        };

        if (includeMembers && team.Members != null)
        {
            dto.Members = team.Members.Select(MapMemberToDto).ToList();
        }

        return dto;
    }

    private static TeamMemberDto MapMemberToDto(TeamMember member)
    {
        return new TeamMemberDto
        {
            Id = member.Id,
            TeamId = member.TeamId,
            UserId = member.UserId,
            RotationOrder = member.RotationOrder,
            IsActive = member.IsActive,
            CreatedAtUtc = member.CreatedAtUtc,
            UpdatedAtUtc = member.UpdatedAtUtc,
            UserFullName = member.User?.FullName,
            UserEmail = member.User?.Email,
            TeamName = member.Team?.Name
        };
    }
}
