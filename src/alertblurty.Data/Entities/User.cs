namespace alertblurty.Data.Entities;

public class User : BaseEntity
{
    public Guid OrganizationId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Timezone { get; set; } = "UTC";
    public UserRole Role { get; set; } = UserRole.User;
    public bool IsActive { get; set; } = true;

    // Navigation properties
    public Organization Organization { get; set; } = null!;
    public ICollection<TeamMember> TeamMemberships { get; set; } = new List<TeamMember>();
    public ICollection<IncidentAcknowledgment> Acknowledgments { get; set; } = new List<IncidentAcknowledgment>();
}

public enum UserRole
{
    User = 0,
    Admin = 1,
    SuperAdmin = 2
}
