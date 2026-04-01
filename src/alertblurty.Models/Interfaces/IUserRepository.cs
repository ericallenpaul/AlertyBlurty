using alertblurty.Models.DTOs;

namespace alertblurty.Models.Interfaces;

public interface IUserRepository
{
    Task<UserDto?> GetByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<UserDto?> GetByEmailAsync(string email, CancellationToken cancellationToken = default);
    Task<List<UserDto>> GetByOrganizationIdAsync(Guid organizationId, CancellationToken cancellationToken = default);
    Task<UserDto> CreateAsync(UserDto user, string passwordHash, CancellationToken cancellationToken = default);
    Task<UserDto> UpdateAsync(UserDto user, CancellationToken cancellationToken = default);
    Task DeleteAsync(Guid id, CancellationToken cancellationToken = default);
    Task<string?> GetPasswordHashAsync(string email, CancellationToken cancellationToken = default);
}
