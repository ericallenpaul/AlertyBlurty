namespace alertblurty.Models.DTOs;

public class UserDto : BaseDto
{
    public Guid OrganizationId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Timezone { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; }

    // Navigation
    public string? OrganizationName { get; set; }
}

public enum UserRole
{
    User = 0,
    Admin = 1
}
