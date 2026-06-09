using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;
using alertblurty.Models.Requests.Auth;
using alertblurty.Models.Responses;

namespace alertblurty.Data.Services;

public class AuthService : IAuthService
{
    private readonly IUserRepository _userRepository;
    private readonly IOrganizationRepository _organizationRepository;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IAlertBlurtyRuntimeConfiguration _configuration;

    public AuthService(
        IUserRepository userRepository,
        IOrganizationRepository organizationRepository,
        IPasswordHasher passwordHasher,
        IAlertBlurtyRuntimeConfiguration configuration)
    {
        _userRepository = userRepository;
        _organizationRepository = organizationRepository;
        _passwordHasher = passwordHasher;
        _configuration = configuration;
    }

    public async Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest request, CancellationToken cancellationToken = default)
    {
        // Find user by email
        var user = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (user == null)
        {
            return ApiResponse<AuthResponse>.ErrorResponse("Invalid email or password");
        }

        // Verify password
        var passwordHash = await _userRepository.GetPasswordHashAsync(request.Email, cancellationToken);
        if (passwordHash == null || !_passwordHasher.VerifyPassword(request.Password, passwordHash))
        {
            return ApiResponse<AuthResponse>.ErrorResponse("Invalid email or password");
        }

        // Check if user is active
        if (!user.IsActive)
        {
            return ApiResponse<AuthResponse>.ErrorResponse("User account is inactive");
        }

        // Generate JWT token
        var token = await GenerateJwtTokenAsync(user.Id, user.Email, user.Role.ToString(), user.OrganizationId);
        var expiresAt = DateTime.UtcNow.AddHours(GetTokenExpirationHours());

        var response = new AuthResponse
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = user
        };

        return ApiResponse<AuthResponse>.SuccessResponse(response);
    }

    public async Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest request, CancellationToken cancellationToken = default)
    {
        // Check if user already exists
        var existingUser = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (existingUser != null)
        {
            return ApiResponse<AuthResponse>.ErrorResponse("User with this email already exists");
        }

        // Create organization
        var organization = new OrganizationDto
        {
            Name = request.OrganizationName,
            DefaultTimezone = request.Timezone,
            IsSetupComplete = false
        };

        var createdOrg = await _organizationRepository.CreateAsync(organization, cancellationToken);

        // Create user (first user is SuperAdmin)
        var userDto = new UserDto
        {
            OrganizationId = createdOrg.Id,
            Email = request.Email,
            FullName = request.FullName,
            PhoneNumber = request.PhoneNumber,
            Timezone = request.Timezone,
            Role = UserRole.SuperAdmin,
            IsActive = true
        };

        var passwordHash = _passwordHasher.HashPassword(request.Password);
        var createdUser = await _userRepository.CreateAsync(userDto, passwordHash, cancellationToken);

        // Generate JWT token
        var token = await GenerateJwtTokenAsync(createdUser.Id, createdUser.Email, createdUser.Role.ToString(), createdUser.OrganizationId);
        var expiresAt = DateTime.UtcNow.AddHours(GetTokenExpirationHours());

        var response = new AuthResponse
        {
            Token = token,
            ExpiresAt = expiresAt,
            User = createdUser
        };

        return ApiResponse<AuthResponse>.SuccessResponse(response, "Registration successful");
    }

    public Task<string> GenerateJwtTokenAsync(Guid userId, string email, string role, Guid organizationId)
    {
        var jwtSecret = _configuration.GetRequiredJwtSecret();

        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.ASCII.GetBytes(jwtSecret);

        var tokenDescriptor = new SecurityTokenDescriptor
        {
            Subject = new ClaimsIdentity(new[]
            {
                new Claim(ClaimTypes.NameIdentifier, userId.ToString()),
                new Claim(ClaimTypes.Email, email),
                new Claim(ClaimTypes.Role, role),
                new Claim("OrganizationId", organizationId.ToString())
            }),
            Expires = DateTime.UtcNow.AddHours(GetTokenExpirationHours()),
            SigningCredentials = new SigningCredentials(
                new SymmetricSecurityKey(key),
                SecurityAlgorithms.HmacSha256Signature),
            Issuer = _configuration.JwtIssuer,
            Audience = _configuration.JwtAudience
        };

        var token = tokenHandler.CreateToken(tokenDescriptor);
        return Task.FromResult(tokenHandler.WriteToken(token));
    }

    private int GetTokenExpirationHours()
    {
        return _configuration.JwtExpirationHours;
    }
}
