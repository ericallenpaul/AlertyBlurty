namespace alertblurty.Data.Entities;

public class TeamMember : BaseEntity
{
    public Guid TeamId { get; set; }
    public Guid UserId { get; set; }
    public int RotationOrder { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public Team Team { get; set; } = null!;
    public User User { get; set; } = null!;
}
