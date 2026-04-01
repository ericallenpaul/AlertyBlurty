using alertblurty.Models.Requests.Auth;
using alertblurty.Models.Responses;

namespace alertblurty.Models.Interfaces;

public interface IAuthService
{
    Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default);
    Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default);
    Task<string> GenerateJwtTokenAsync(Guid userId, string email, string role, Guid organizationId);
}
