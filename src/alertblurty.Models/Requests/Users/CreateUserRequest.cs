using alertblurty.Models.DTOs;

namespace alertblurty.Models.Requests.Users;

public class CreateUserRequest
{
    public Guid OrganizationId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;
    public string Timezone { get; set; } = string.Empty;
    public UserRole Role { get; set; }
    public bool IsActive { get; set; } = true;
}
