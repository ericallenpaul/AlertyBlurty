namespace alertblurty.Models.DTOs;

public class TeamDto : BaseDto
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool RequireAdminApprovalForSwaps { get; set; }

    // Navigation
    public string? OrganizationName { get; set; }
    public List<TeamMemberDto>? Members { get; set; }
}
