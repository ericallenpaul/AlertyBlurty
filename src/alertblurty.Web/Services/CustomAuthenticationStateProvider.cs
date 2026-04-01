using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Components.Authorization;

namespace alertblurty.Web.Services;

public class CustomAuthenticationStateProvider : AuthenticationStateProvider
{
    private readonly ITokenStorageService _tokenStorage;

    public CustomAuthenticationStateProvider(ITokenStorageService tokenStorage)
    {
        _tokenStorage = tokenStorage;
    }

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        try
        {
            var token = await _tokenStorage.GetTokenAsync();

            if (string.IsNullOrEmpty(token))
            {
                return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
            }

            var claims = ParseClaimsFromJwt(token);
            var identity = new ClaimsIdentity(claims, "jwt");
            var user = new ClaimsPrincipal(identity);

            return new AuthenticationState(user);
        }
        catch
        {
            // During prerendering, localStorage is not available, return anonymous
            return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
        }
    }

    public void NotifyAuthenticationStateChanged()
    {
        NotifyAuthenticationStateChanged(GetAuthenticationStateAsync());
    }

    private IEnumerable<Claim> ParseClaimsFromJwt(string jwt)
    {
        var claims = new List<Claim>();
        var payload = jwt.Split('.')[1];

        // Add padding if needed
        var paddedPayload = payload.PadRight(payload.Length + (4 - payload.Length % 4) % 4, '=');
        var jsonBytes = Convert.FromBase64String(paddedPayload);
        var keyValuePairs = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonBytes);

        if (keyValuePairs != null)
        {
            // Try both the full ClaimTypes.Role URI and the short form "role"
            object? roles = null;
            keyValuePairs.TryGetValue(ClaimTypes.Role, out roles);

            if (roles == null)
            {
                keyValuePairs.TryGetValue("role", out roles);
            }

            if (roles != null)
            {
                if (roles.ToString()!.Trim().StartsWith("["))
                {
                    var parsedRoles = JsonSerializer.Deserialize<string[]>(roles.ToString()!);

                    if (parsedRoles != null)
                    {
                        claims.AddRange(parsedRoles.Select(role => new Claim(ClaimTypes.Role, role)));
                    }
                }
                else
                {
                    claims.Add(new Claim(ClaimTypes.Role, roles.ToString()!));
                }

                keyValuePairs.Remove(ClaimTypes.Role);
                keyValuePairs.Remove("role");
            }

            // Map JWT standard claims to ClaimTypes
            foreach (var kvp in keyValuePairs)
            {
                var claimType = kvp.Key switch
                {
                    "nameid" => ClaimTypes.NameIdentifier,
                    "email" => ClaimTypes.Email,
                    "unique_name" => ClaimTypes.Name,
                    _ => kvp.Key
                };
                claims.Add(new Claim(claimType, kvp.Value?.ToString() ?? ""));
            }
        }

        return claims;
    }
}
