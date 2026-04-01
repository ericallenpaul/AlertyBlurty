using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Users;

namespace alertblurty.Web.Services;

public interface IUserApiService
{
    Task<UserDto?> GetMeAsync();
    Task<UserDto?> GetByIdAsync(Guid id);
    Task<List<UserDto>> GetByOrganizationAsync(Guid organizationId);
    Task<UserDto?> CreateAsync(CreateUserRequest request);
    Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request);
    Task<bool> DeleteAsync(Guid id);
}
