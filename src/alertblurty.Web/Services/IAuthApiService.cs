using alertblurty.Models.Requests.Auth;
using alertblurty.Models.Responses;

namespace alertblurty.Web.Services;

public interface IAuthApiService
{
    Task<AuthResponse?> RegisterAsync(RegisterRequest request);
    Task<AuthResponse?> LoginAsync(LoginRequest request);
}
