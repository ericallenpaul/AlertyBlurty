namespace alertblurty.Data.Entities;

public class Team : BaseEntity
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public bool RequireAdminApprovalForSwaps { get; set; } = false;

    // Navigation properties
    public Organization Organization { get; set; } = null!;
    public ICollection<TeamMember> Members { get; set; } = new List<TeamMember>();
    public ICollection<OnCallSchedule> Schedules { get; set; } = new List<OnCallSchedule>();
}
