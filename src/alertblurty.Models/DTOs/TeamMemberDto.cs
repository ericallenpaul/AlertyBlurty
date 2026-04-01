namespace alertblurty.Models.DTOs;

public class TeamMemberDto : BaseDto
{
    public Guid TeamId { get; set; }
    public Guid UserId { get; set; }
    public int RotationOrder { get; set; }
    public bool IsActive { get; set; }

    // Navigation
    public string? UserFullName { get; set; }
    public string? UserEmail { get; set; }
    public string? TeamName { get; set; }
}
