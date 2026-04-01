using alertblurty.Models.DTOs;

namespace alertblurty.Models.Requests.Users;

public class UpdateUserRequest
{
    public string? FullName { get; set; }
    public string? PhoneNumber { get; set; }
    public string? Timezone { get; set; }
    public UserRole? Role { get; set; }
    public bool? IsActive { get; set; }
}
