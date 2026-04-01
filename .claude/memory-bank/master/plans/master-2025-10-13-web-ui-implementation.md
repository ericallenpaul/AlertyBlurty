# AlertyBlurty Web UI Implementation Plan

## Metadata
- **Date Created**: 2025-10-13
- **Branch**: master
- **Status**: DRAFT - Awaiting Approval
- **Project**: AlertyBlurty Blazor Server Web UI
- **API Base URL**: http://localhost:5041
- **Web Base URL**: http://localhost:5000 (to be configured)

## Executive Summary

This plan details the complete implementation of a Blazor Server Web UI for AlertyBlurty, an on-call alert routing system. The Web UI will provide a full-featured administrative interface for managing organizations, users, teams, and incidents, with a critical first-run setup wizard for initial configuration.

### Key Deliverables
1. First-Run Setup Wizard (critical for new installations)
2. Authentication system (login/register)
3. Dashboard with incident overview
4. Team management (CRUD + member management)
5. User management (CRUD)
6. Incident management (view, acknowledge, filter)
7. Responsive layout with role-based navigation

---

## Technical Specification

### Technology Stack
- **Framework**: Blazor Server (.NET 8)
- **UI Library**: Bootstrap 5
- **HTTP Client**: System.Net.Http.HttpClient
- **State Management**: Blazor's built-in state management + custom AuthenticationStateProvider
- **Authentication**: JWT tokens (stored in sessionStorage via JSInterop)

### Architecture Overview

```
src/alertblurty.Web/
├── Services/
│   ├── ApiClient.cs                    # Base HTTP client wrapper
│   ├── AuthApiService.cs               # Auth endpoints
│   ├── UserApiService.cs               # User endpoints
│   ├── TeamApiService.cs               # Team endpoints
│   ├── IncidentApiService.cs           # Incident endpoints
│   ├── OrganizationApiService.cs       # Organization endpoints
│   └── TokenStorageService.cs          # JWT token storage
├── Authentication/
│   ├── CustomAuthStateProvider.cs      # Auth state provider
│   └── TokenAuthenticationHandler.cs   # HTTP message handler for JWT
├── Models/
│   └── ViewModels/
│       ├── LoginViewModel.cs
│       ├── RegisterViewModel.cs
│       └── SetupWizardViewModel.cs
├── Pages/
│   ├── Setup/
│   │   └── Wizard.razor               # First-run wizard
│   ├── Auth/
│   │   ├── Login.razor
│   │   └── Register.razor
│   ├── Dashboard/
│   │   └── Index.razor
│   ├── Teams/
│   │   ├── Index.razor
│   │   ├── Create.razor
│   │   ├── Edit.razor
│   │   └── Detail.razor
│   ├── Users/
│   │   ├── Index.razor
│   │   ├── Create.razor
│   │   ├── Edit.razor
│   │   └── Profile.razor
│   └── Incidents/
│       ├── Index.razor
│       └── Detail.razor
├── Shared/
│   ├── MainLayout.razor
│   ├── NavMenu.razor
│   ├── TopBar.razor
│   └── Components/
│       ├── LoadingSpinner.razor
│       ├── EmptyState.razor
│       └── ConfirmDialog.razor
└── wwwroot/
    ├── css/
    │   └── app.css                    # Custom styles
    └── js/
        └── storage.js                 # Token storage helpers
```

---

## Implementation Phases

---

## PHASE 1: Project Configuration & Core Infrastructure

### Objective
Set up the Blazor Server project with all necessary dependencies, configuration, and core services for API communication.

### Duration Estimate
2-3 hours

### Steps

#### 1.1 Add NuGet Packages

**File**: `src/alertblurty.Web/alertblurty.Web.csproj`

**Action**: Add the following PackageReference items:

```xml
<ItemGroup>
  <PackageReference Include="Blazored.SessionStorage" Version="2.4.0" />
  <PackageReference Include="System.IdentityModel.Tokens.Jwt" Version="7.1.2" />
</ItemGroup>
```

**Rationale**:
- `Blazored.SessionStorage`: Provides easy sessionStorage access for JWT tokens
- `System.IdentityModel.Tokens.Jwt`: For JWT token parsing and validation

#### 1.2 Create appsettings.json Configuration

**File**: `src/alertblurty.Web/appsettings.json`

**Action**: Create configuration file with API settings:

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*",
  "ApiSettings": {
    "BaseUrl": "http://localhost:5041",
    "Timeout": 30
  }
}
```

**File**: `src/alertblurty.Web/appsettings.Development.json`

```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Debug",
      "Microsoft.AspNetCore": "Information"
    }
  },
  "ApiSettings": {
    "BaseUrl": "http://localhost:5041"
  }
}
```

#### 1.3 Create API Client Base Service

**File**: `src/alertblurty.Web/Services/ApiClient.cs`

**Action**: Create base HTTP client wrapper with error handling:

```csharp
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace alertblurty.Web.Services;

public class ApiClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<ApiClient> _logger;

    public ApiClient(HttpClient httpClient, IConfiguration configuration, ILogger<ApiClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;

        var baseUrl = configuration["ApiSettings:BaseUrl"]
            ?? throw new InvalidOperationException("API BaseUrl not configured");
        _httpClient.BaseAddress = new Uri(baseUrl);
        _httpClient.Timeout = TimeSpan.FromSeconds(
            configuration.GetValue<int>("ApiSettings:Timeout", 30));
    }

    public void SetAuthorizationToken(string token)
    {
        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);
    }

    public void ClearAuthorizationToken()
    {
        _httpClient.DefaultRequestHeaders.Authorization = null;
    }

    public async Task<T?> GetAsync<T>(string endpoint, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.GetAsync(endpoint, cancellationToken);
            response.EnsureSuccessStatusCode();

            var content = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<T>(content, JsonOptions);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP request failed: {Endpoint}", endpoint);
            throw;
        }
    }

    public async Task<TResponse?> PostAsync<TRequest, TResponse>(
        string endpoint,
        TRequest data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var json = JsonSerializer.Serialize(data, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync(endpoint, content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<TResponse>(responseContent, JsonOptions);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP POST failed: {Endpoint}", endpoint);
            throw;
        }
    }

    public async Task<TResponse?> PutAsync<TRequest, TResponse>(
        string endpoint,
        TRequest data,
        CancellationToken cancellationToken = default)
    {
        try
        {
            var json = JsonSerializer.Serialize(data, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PutAsync(endpoint, content, cancellationToken);
            response.EnsureSuccessStatusCode();

            var responseContent = await response.Content.ReadAsStringAsync(cancellationToken);
            return JsonSerializer.Deserialize<TResponse>(responseContent, JsonOptions);
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP PUT failed: {Endpoint}", endpoint);
            throw;
        }
    }

    public async Task<bool> DeleteAsync(string endpoint, CancellationToken cancellationToken = default)
    {
        try
        {
            var response = await _httpClient.DeleteAsync(endpoint, cancellationToken);
            response.EnsureSuccessStatusCode();
            return true;
        }
        catch (HttpRequestException ex)
        {
            _logger.LogError(ex, "HTTP DELETE failed: {Endpoint}", endpoint);
            return false;
        }
    }

    private static JsonSerializerOptions JsonOptions => new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };
}
```

**Rationale**: Centralized HTTP client with consistent error handling and JSON serialization.

#### 1.4 Create Token Storage Service

**File**: `src/alertblurty.Web/Services/TokenStorageService.cs`

**Action**: Create service for managing JWT tokens:

```csharp
using Blazored.SessionStorage;

namespace alertblurty.Web.Services;

public class TokenStorageService
{
    private readonly ISessionStorageService _sessionStorage;
    private const string TokenKey = "auth_token";
    private const string TokenExpiryKey = "token_expiry";

    public TokenStorageService(ISessionStorageService sessionStorage)
    {
        _sessionStorage = sessionStorage;
    }

    public async Task StoreTokenAsync(string token, DateTime expiresAt)
    {
        await _sessionStorage.SetItemAsync(TokenKey, token);
        await _sessionStorage.SetItemAsync(TokenExpiryKey, expiresAt);
    }

    public async Task<string?> GetTokenAsync()
    {
        try
        {
            var token = await _sessionStorage.GetItemAsync<string>(TokenKey);
            var expiry = await _sessionStorage.GetItemAsync<DateTime>(TokenExpiryKey);

            if (string.IsNullOrEmpty(token) || expiry <= DateTime.UtcNow)
            {
                await ClearTokenAsync();
                return null;
            }

            return token;
        }
        catch
        {
            return null;
        }
    }

    public async Task ClearTokenAsync()
    {
        await _sessionStorage.RemoveItemAsync(TokenKey);
        await _sessionStorage.RemoveItemAsync(TokenExpiryKey);
    }

    public async Task<bool> HasValidTokenAsync()
    {
        var token = await GetTokenAsync();
        return !string.IsNullOrEmpty(token);
    }
}
```

#### 1.5 Create Custom Authentication State Provider

**File**: `src/alertblurty.Web/Authentication/CustomAuthStateProvider.cs`

**Action**: Implement custom AuthenticationStateProvider:

```csharp
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using Microsoft.AspNetCore.Components.Authorization;
using alertblurty.Web.Services;

namespace alertblurty.Web.Authentication;

public class CustomAuthStateProvider : AuthenticationStateProvider
{
    private readonly TokenStorageService _tokenStorage;
    private readonly ILogger<CustomAuthStateProvider> _logger;

    public CustomAuthStateProvider(
        TokenStorageService tokenStorage,
        ILogger<CustomAuthStateProvider> logger)
    {
        _tokenStorage = tokenStorage;
        _logger = logger;
    }

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        var token = await _tokenStorage.GetTokenAsync();

        if (string.IsNullOrEmpty(token))
        {
            return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
        }

        try
        {
            var claims = ParseClaimsFromJwt(token);
            var identity = new ClaimsIdentity(claims, "jwt");
            var user = new ClaimsPrincipal(identity);

            return new AuthenticationState(user);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse JWT token");
            await _tokenStorage.ClearTokenAsync();
            return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
        }
    }

    public async Task MarkUserAsAuthenticated(string token)
    {
        var claims = ParseClaimsFromJwt(token);
        var identity = new ClaimsIdentity(claims, "jwt");
        var user = new ClaimsPrincipal(identity);

        NotifyAuthenticationStateChanged(
            Task.FromResult(new AuthenticationState(user)));
    }

    public async Task MarkUserAsLoggedOut()
    {
        await _tokenStorage.ClearTokenAsync();

        var anonymousUser = new ClaimsPrincipal(new ClaimsIdentity());
        NotifyAuthenticationStateChanged(
            Task.FromResult(new AuthenticationState(anonymousUser)));
    }

    private IEnumerable<Claim> ParseClaimsFromJwt(string jwt)
    {
        var handler = new JwtSecurityTokenHandler();
        var token = handler.ReadJwtToken(jwt);
        return token.Claims;
    }
}
```

#### 1.6 Update Program.cs with Service Configuration

**File**: `src/alertblurty.Web/Program.cs`

**Action**: Replace entire file content:

```csharp
using Microsoft.AspNetCore.Components;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Web;
using Blazored.SessionStorage;
using alertblurty.Web.Services;
using alertblurty.Web.Authentication;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

// Add Blazored SessionStorage
builder.Services.AddBlazoredSessionStorage();

// Register HttpClient and API services
builder.Services.AddScoped<ApiClient>();
builder.Services.AddScoped<TokenStorageService>();
builder.Services.AddScoped<AuthApiService>();
builder.Services.AddScoped<UserApiService>();
builder.Services.AddScoped<TeamApiService>();
builder.Services.AddScoped<IncidentApiService>();
builder.Services.AddScoped<OrganizationApiService>();

// Configure HttpClient
builder.Services.AddHttpClient<ApiClient>();

// Configure Authentication
builder.Services.AddScoped<AuthenticationStateProvider, CustomAuthStateProvider>();
builder.Services.AddAuthorizationCore();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();

app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();
```

**Rationale**: Registers all services, authentication, and configures the HTTP client pipeline.

#### 1.7 Update _Imports.razor

**File**: `src/alertblurty.Web/_Imports.razor`

**Action**: Add additional imports:

```razor
@using System.Net.Http
@using Microsoft.AspNetCore.Authorization
@using Microsoft.AspNetCore.Components.Authorization
@using Microsoft.AspNetCore.Components.Forms
@using Microsoft.AspNetCore.Components.Routing
@using Microsoft.AspNetCore.Components.Web
@using Microsoft.AspNetCore.Components.Web.Virtualization
@using Microsoft.JSInterop
@using alertblurty.Web
@using alertblurty.Web.Shared
@using alertblurty.Web.Services
@using alertblurty.Web.Authentication
@using alertblurty.Models.DTOs
@using alertblurty.Models.Requests.Auth
@using alertblurty.Models.Requests.Users
@using alertblurty.Models.Requests.Teams
@using alertblurty.Models.Requests.Incidents
@using alertblurty.Models.Responses
```

### Success Criteria
- [ ] Project builds without errors
- [ ] All NuGet packages restored
- [ ] ApiClient service instantiates correctly
- [ ] TokenStorageService can store and retrieve tokens
- [ ] CustomAuthStateProvider registered in DI container

### Testing Strategy
1. Build the project: `dotnet build src/alertblurty.Web/`
2. Verify no compilation errors
3. Run project: `dotnet run --project src/alertblurty.Web/`
4. Verify it starts on localhost:5000 (or configured port)

---

## PHASE 2: API Service Layer

### Objective
Create service classes for each API endpoint group, providing strongly-typed methods for all backend operations.

### Duration Estimate
3-4 hours

### Steps

#### 2.1 Create Authentication API Service

**File**: `src/alertblurty.Web/Services/AuthApiService.cs`

**Action**: Create service for auth endpoints:

```csharp
using alertblurty.Models.Requests.Auth;
using alertblurty.Models.Responses;

namespace alertblurty.Web.Services;

public class AuthApiService
{
    private readonly ApiClient _apiClient;
    private readonly TokenStorageService _tokenStorage;
    private readonly CustomAuthStateProvider _authStateProvider;

    public AuthApiService(
        ApiClient apiClient,
        TokenStorageService tokenStorage,
        AuthenticationStateProvider authStateProvider)
    {
        _apiClient = apiClient;
        _tokenStorage = tokenStorage;
        _authStateProvider = (CustomAuthStateProvider)authStateProvider;
    }

    public async Task<ApiResponse<AuthResponse>> LoginAsync(LoginRequest request)
    {
        try
        {
            var response = await _apiClient.PostAsync<LoginRequest, ApiResponse<AuthResponse>>(
                "/api/auth/login",
                request);

            if (response?.Success == true && response.Data != null)
            {
                await _tokenStorage.StoreTokenAsync(
                    response.Data.Token,
                    response.Data.ExpiresAt);

                _apiClient.SetAuthorizationToken(response.Data.Token);
                await _authStateProvider.MarkUserAsAuthenticated(response.Data.Token);
            }

            return response ?? new ApiResponse<AuthResponse>
            {
                Success = false,
                Message = "Login failed"
            };
        }
        catch (Exception ex)
        {
            return new ApiResponse<AuthResponse>
            {
                Success = false,
                Message = ex.Message
            };
        }
    }

    public async Task<ApiResponse<AuthResponse>> RegisterAsync(RegisterRequest request)
    {
        try
        {
            var response = await _apiClient.PostAsync<RegisterRequest, ApiResponse<AuthResponse>>(
                "/api/auth/register",
                request);

            if (response?.Success == true && response.Data != null)
            {
                await _tokenStorage.StoreTokenAsync(
                    response.Data.Token,
                    response.Data.ExpiresAt);

                _apiClient.SetAuthorizationToken(response.Data.Token);
                await _authStateProvider.MarkUserAsAuthenticated(response.Data.Token);
            }

            return response ?? new ApiResponse<AuthResponse>
            {
                Success = false,
                Message = "Registration failed"
            };
        }
        catch (Exception ex)
        {
            return new ApiResponse<AuthResponse>
            {
                Success = false,
                Message = ex.Message
            };
        }
    }

    public async Task LogoutAsync()
    {
        _apiClient.ClearAuthorizationToken();
        await _authStateProvider.MarkUserAsLoggedOut();
    }

    public async Task InitializeAsync()
    {
        var token = await _tokenStorage.GetTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            _apiClient.SetAuthorizationToken(token);
        }
    }
}
```

#### 2.2 Create Organization API Service

**File**: `src/alertblurty.Web/Services/OrganizationApiService.cs`

**Action**: Create service for organization endpoints:

```csharp
using alertblurty.Models.DTOs;

namespace alertblurty.Web.Services;

public class OrganizationApiService
{
    private readonly ApiClient _apiClient;

    public OrganizationApiService(ApiClient apiClient)
    {
        _apiClient = apiClient;
    }

    public async Task<OrganizationDto?> GetByIdAsync(Guid id)
    {
        return await _apiClient.GetAsync<OrganizationDto>($"/api/organizations/{id}");
    }

    public async Task<OrganizationDto?> CreateAsync(OrganizationDto organization)
    {
        return await _apiClient.PostAsync<OrganizationDto, OrganizationDto>(
            "/api/organizations",
            organization);
    }

    public async Task<OrganizationDto?> UpdateAsync(OrganizationDto organization)
    {
        return await _apiClient.PutAsync<OrganizationDto, OrganizationDto>(
            $"/api/organizations/{organization.Id}",
            organization);
    }

    public async Task<bool> CompleteSetupAsync(Guid id)
    {
        try
        {
            await _apiClient.PostAsync<object, object>(
                $"/api/organizations/{id}/complete-setup",
                new { });
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> IsSetupCompleteAsync()
    {
        try
        {
            var response = await _apiClient.GetAsync<SetupStatusResponse>(
                "/api/organizations/setup-status");
            return response?.IsSetupComplete ?? false;
        }
        catch
        {
            return false;
        }
    }
}

public class SetupStatusResponse
{
    public bool IsSetupComplete { get; set; }
    public int OrganizationCount { get; set; }
}
```

**Note**: The `/api/organizations/setup-status` endpoint needs to be added to the API in a future phase or assumed to exist.

#### 2.3 Create User API Service

**File**: `src/alertblurty.Web/Services/UserApiService.cs`

**Action**: Create service for user endpoints:

```csharp
using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Users;

namespace alertblurty.Web.Services;

public class UserApiService
{
    private readonly ApiClient _apiClient;

    public UserApiService(ApiClient apiClient)
    {
        _apiClient = apiClient;
    }

    public async Task<UserDto?> GetCurrentUserAsync()
    {
        return await _apiClient.GetAsync<UserDto>("/api/users/me");
    }

    public async Task<UserDto?> GetByIdAsync(Guid id)
    {
        return await _apiClient.GetAsync<UserDto>($"/api/users/{id}");
    }

    public async Task<List<UserDto>?> GetByOrganizationAsync(Guid organizationId)
    {
        return await _apiClient.GetAsync<List<UserDto>>(
            $"/api/users/organization/{organizationId}");
    }

    public async Task<UserDto?> CreateAsync(CreateUserRequest request)
    {
        return await _apiClient.PostAsync<CreateUserRequest, UserDto>(
            "/api/users",
            request);
    }

    public async Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request)
    {
        return await _apiClient.PutAsync<UpdateUserRequest, UserDto>(
            $"/api/users/{id}",
            request);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        return await _apiClient.DeleteAsync($"/api/users/{id}");
    }
}
```

#### 2.4 Create Team API Service

**File**: `src/alertblurty.Web/Services/TeamApiService.cs`

**Action**: Create service for team endpoints:

```csharp
using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Teams;

namespace alertblurty.Web.Services;

public class TeamApiService
{
    private readonly ApiClient _apiClient;

    public TeamApiService(ApiClient apiClient)
    {
        _apiClient = apiClient;
    }

    public async Task<TeamDto?> GetByIdAsync(Guid id)
    {
        return await _apiClient.GetAsync<TeamDto>($"/api/teams/{id}");
    }

    public async Task<List<TeamDto>?> GetByOrganizationAsync(Guid organizationId)
    {
        return await _apiClient.GetAsync<List<TeamDto>>(
            $"/api/teams/organization/{organizationId}");
    }

    public async Task<TeamDto?> CreateAsync(CreateTeamRequest request)
    {
        return await _apiClient.PostAsync<CreateTeamRequest, TeamDto>(
            "/api/teams",
            request);
    }

    public async Task<TeamDto?> UpdateAsync(Guid id, UpdateTeamRequest request)
    {
        return await _apiClient.PutAsync<UpdateTeamRequest, TeamDto>(
            $"/api/teams/{id}",
            request);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        return await _apiClient.DeleteAsync($"/api/teams/{id}");
    }

    public async Task<List<TeamMemberDto>?> GetTeamMembersAsync(Guid teamId)
    {
        return await _apiClient.GetAsync<List<TeamMemberDto>>(
            $"/api/teams/{teamId}/members");
    }

    public async Task<TeamMemberDto?> AddMemberAsync(Guid teamId, AddTeamMemberRequest request)
    {
        return await _apiClient.PostAsync<AddTeamMemberRequest, TeamMemberDto>(
            $"/api/teams/{teamId}/members",
            request);
    }

    public async Task<bool> RemoveMemberAsync(Guid teamId, Guid userId)
    {
        return await _apiClient.DeleteAsync($"/api/teams/{teamId}/members/{userId}");
    }
}
```

#### 2.5 Create Incident API Service

**File**: `src/alertblurty.Web/Services/IncidentApiService.cs`

**Action**: Create service for incident endpoints:

```csharp
using alertblurty.Models.DTOs;

namespace alertblurty.Web.Services;

public class IncidentApiService
{
    private readonly ApiClient _apiClient;

    public IncidentApiService(ApiClient apiClient)
    {
        _apiClient = apiClient;
    }

    public async Task<IncidentDto?> GetByIdAsync(Guid id)
    {
        return await _apiClient.GetAsync<IncidentDto>($"/api/incidents/{id}");
    }

    public async Task<List<IncidentDto>?> GetByTeamAsync(Guid teamId, IncidentStatus? status = null)
    {
        var endpoint = $"/api/incidents/team/{teamId}";
        if (status.HasValue)
        {
            endpoint += $"?status={status.Value}";
        }
        return await _apiClient.GetAsync<List<IncidentDto>>(endpoint);
    }

    public async Task<List<IncidentDto>?> GetOpenIncidentsAsync()
    {
        return await _apiClient.GetAsync<List<IncidentDto>>("/api/incidents/open");
    }

    public async Task<IncidentDto?> AcknowledgeAsync(Guid id)
    {
        return await _apiClient.PostAsync<object, IncidentDto>(
            $"/api/incidents/{id}/acknowledge",
            new { });
    }
}
```

### Success Criteria
- [ ] All API service classes compile without errors
- [ ] Services properly inject ApiClient dependency
- [ ] All CRUD operations have corresponding methods
- [ ] Authentication flow properly manages tokens
- [ ] Error handling exists for all API calls

### Testing Strategy
1. Build project to verify compilation
2. In Phase 3+, test each service through UI components
3. Use browser dev tools to verify API calls are made correctly

---

## PHASE 3: First-Run Setup Wizard

### Objective
Create a multi-step wizard that guides new users through initial system configuration. This is CRITICAL for first installations.

### Duration Estimate
4-5 hours

### Steps

#### 3.1 Create Setup Detection Logic

**File**: `src/alertblurty.Web/Services/SetupService.cs`

**Action**: Create service to detect if setup is needed:

```csharp
namespace alertblurty.Web.Services;

public class SetupService
{
    private readonly OrganizationApiService _organizationApi;
    private bool? _isSetupComplete;

    public SetupService(OrganizationApiService organizationApi)
    {
        _organizationApi = organizationApi;
    }

    public async Task<bool> IsSetupRequiredAsync()
    {
        if (_isSetupComplete.HasValue)
        {
            return !_isSetupComplete.Value;
        }

        _isSetupComplete = await _organizationApi.IsSetupCompleteAsync();
        return !_isSetupComplete.Value;
    }

    public void MarkSetupComplete()
    {
        _isSetupComplete = true;
    }
}
```

**Registration**: Add to `Program.cs`:
```csharp
builder.Services.AddScoped<SetupService>();
```

#### 3.2 Create Setup Wizard View Model

**File**: `src/alertblurty.Web/Models/ViewModels/SetupWizardViewModel.cs`

**Action**: Create view model for wizard state:

```csharp
using System.ComponentModel.DataAnnotations;

namespace alertblurty.Web.Models.ViewModels;

public class SetupWizardViewModel
{
    public int CurrentStep { get; set; } = 1;
    public int TotalSteps { get; } = 3;

    // Step 1: Organization
    [Required(ErrorMessage = "Organization name is required")]
    [StringLength(100, MinimumLength = 2)]
    public string OrganizationName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Timezone is required")]
    public string DefaultTimezone { get; set; } = "America/New_York";

    // Step 2: SuperAdmin User
    [Required(ErrorMessage = "Email is required")]
    [EmailAddress(ErrorMessage = "Invalid email address")]
    public string AdminEmail { get; set; } = string.Empty;

    [Required(ErrorMessage = "Password is required")]
    [StringLength(100, MinimumLength = 8, ErrorMessage = "Password must be at least 8 characters")]
    public string AdminPassword { get; set; } = string.Empty;

    [Required(ErrorMessage = "Please confirm password")]
    [Compare(nameof(AdminPassword), ErrorMessage = "Passwords do not match")]
    public string AdminPasswordConfirm { get; set; } = string.Empty;

    [Required(ErrorMessage = "Full name is required")]
    [StringLength(100, MinimumLength = 2)]
    public string AdminFullName { get; set; } = string.Empty;

    [Required(ErrorMessage = "Phone number is required")]
    [Phone(ErrorMessage = "Invalid phone number")]
    public string AdminPhoneNumber { get; set; } = string.Empty;

    [Required(ErrorMessage = "Timezone is required")]
    public string AdminTimezone { get; set; } = "America/New_York";

    // Step 3: Optional Twilio Configuration
    public string? TwilioAccountSid { get; set; }
    public string? TwilioAuthToken { get; set; }
    public string? TwilioPhoneNumber { get; set; }

    public bool CanGoNext => CurrentStep < TotalSteps;
    public bool CanGoPrevious => CurrentStep > 1;
    public bool IsComplete => CurrentStep == TotalSteps;
}
```

#### 3.3 Create Setup Wizard Component

**File**: `src/alertblurty.Web/Pages/Setup/Wizard.razor`

**Action**: Create multi-step wizard UI:

```razor
@page "/setup"
@using alertblurty.Web.Models.ViewModels
@using alertblurty.Models.Requests.Auth
@inject AuthApiService AuthApi
@inject OrganizationApiService OrganizationApi
@inject SetupService SetupService
@inject NavigationManager Navigation

<PageTitle>Setup - AlertyBlurty</PageTitle>

<div class="container mt-5">
    <div class="row justify-content-center">
        <div class="col-md-8">
            <div class="card">
                <div class="card-header">
                    <h3 class="mb-0">Welcome to AlertyBlurty</h3>
                    <p class="text-muted mb-0">Let's set up your on-call alert system</p>
                </div>
                <div class="card-body">
                    <!-- Progress Bar -->
                    <div class="mb-4">
                        <div class="progress" style="height: 25px;">
                            <div class="progress-bar"
                                 role="progressbar"
                                 style="width: @((_model.CurrentStep / (double)_model.TotalSteps) * 100)%"
                                 aria-valuenow="@_model.CurrentStep"
                                 aria-valuemin="0"
                                 aria-valuemax="@_model.TotalSteps">
                                Step @_model.CurrentStep of @_model.TotalSteps
                            </div>
                        </div>
                    </div>

                    @if (_error != null)
                    {
                        <div class="alert alert-danger">@_error</div>
                    }

                    @if (_isProcessing)
                    {
                        <div class="text-center py-5">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">Processing...</span>
                            </div>
                            <p class="mt-3">Setting up your system...</p>
                        </div>
                    }
                    else
                    {
                        <EditForm Model="_model" OnValidSubmit="HandleNextStep">
                            <DataAnnotationsValidator />

                            @if (_model.CurrentStep == 1)
                            {
                                <h4 class="mb-3">Organization Information</h4>

                                <div class="mb-3">
                                    <label class="form-label">Organization Name</label>
                                    <InputText @bind-Value="_model.OrganizationName"
                                               class="form-control"
                                               placeholder="e.g., Acme Corporation" />
                                    <ValidationMessage For="@(() => _model.OrganizationName)" />
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Default Timezone</label>
                                    <InputSelect @bind-Value="_model.DefaultTimezone" class="form-control">
                                        <option value="America/New_York">Eastern Time (US & Canada)</option>
                                        <option value="America/Chicago">Central Time (US & Canada)</option>
                                        <option value="America/Denver">Mountain Time (US & Canada)</option>
                                        <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                                        <option value="UTC">UTC</option>
                                    </InputSelect>
                                    <ValidationMessage For="@(() => _model.DefaultTimezone)" />
                                </div>
                            }
                            else if (_model.CurrentStep == 2)
                            {
                                <h4 class="mb-3">Create SuperAdmin Account</h4>

                                <div class="mb-3">
                                    <label class="form-label">Full Name</label>
                                    <InputText @bind-Value="_model.AdminFullName"
                                               class="form-control"
                                               placeholder="John Doe" />
                                    <ValidationMessage For="@(() => _model.AdminFullName)" />
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Email Address</label>
                                    <InputText @bind-Value="_model.AdminEmail"
                                               type="email"
                                               class="form-control"
                                               placeholder="admin@example.com" />
                                    <ValidationMessage For="@(() => _model.AdminEmail)" />
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Phone Number</label>
                                    <InputText @bind-Value="_model.AdminPhoneNumber"
                                               type="tel"
                                               class="form-control"
                                               placeholder="+1234567890" />
                                    <small class="form-text text-muted">Format: +1234567890</small>
                                    <ValidationMessage For="@(() => _model.AdminPhoneNumber)" />
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Password</label>
                                    <InputText @bind-Value="_model.AdminPassword"
                                               type="password"
                                               class="form-control" />
                                    <small class="form-text text-muted">Minimum 8 characters</small>
                                    <ValidationMessage For="@(() => _model.AdminPassword)" />
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Confirm Password</label>
                                    <InputText @bind-Value="_model.AdminPasswordConfirm"
                                               type="password"
                                               class="form-control" />
                                    <ValidationMessage For="@(() => _model.AdminPasswordConfirm)" />
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Timezone</label>
                                    <InputSelect @bind-Value="_model.AdminTimezone" class="form-control">
                                        <option value="America/New_York">Eastern Time (US & Canada)</option>
                                        <option value="America/Chicago">Central Time (US & Canada)</option>
                                        <option value="America/Denver">Mountain Time (US & Canada)</option>
                                        <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                                        <option value="UTC">UTC</option>
                                    </InputSelect>
                                    <ValidationMessage For="@(() => _model.AdminTimezone)" />
                                </div>
                            }
                            else if (_model.CurrentStep == 3)
                            {
                                <h4 class="mb-3">SMS Configuration (Optional)</h4>
                                <p class="text-muted">Configure Twilio for SMS alerts. You can skip this and configure later.</p>

                                <div class="mb-3">
                                    <label class="form-label">Twilio Account SID</label>
                                    <InputText @bind-Value="_model.TwilioAccountSid"
                                               class="form-control"
                                               placeholder="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Twilio Auth Token</label>
                                    <InputText @bind-Value="_model.TwilioAuthToken"
                                               type="password"
                                               class="form-control"
                                               placeholder="Your auth token" />
                                </div>

                                <div class="mb-3">
                                    <label class="form-label">Twilio Phone Number</label>
                                    <InputText @bind-Value="_model.TwilioPhoneNumber"
                                               type="tel"
                                               class="form-control"
                                               placeholder="+1234567890" />
                                </div>
                            }

                            <div class="d-flex justify-content-between mt-4">
                                @if (_model.CanGoPrevious)
                                {
                                    <button type="button"
                                            class="btn btn-secondary"
                                            @onclick="GoToPreviousStep">
                                        Previous
                                    </button>
                                }
                                else
                                {
                                    <div></div>
                                }

                                @if (_model.IsComplete)
                                {
                                    <button type="submit" class="btn btn-success">
                                        Complete Setup
                                    </button>
                                }
                                else
                                {
                                    <button type="submit" class="btn btn-primary">
                                        Next
                                    </button>
                                }
                            </div>
                        </EditForm>
                    }
                </div>
            </div>
        </div>
    </div>
</div>

@code {
    private SetupWizardViewModel _model = new();
    private bool _isProcessing = false;
    private string? _error = null;

    private void GoToPreviousStep()
    {
        if (_model.CanGoPrevious)
        {
            _model.CurrentStep--;
            _error = null;
        }
    }

    private async Task HandleNextStep()
    {
        _error = null;

        if (_model.IsComplete)
        {
            await CompleteSetup();
        }
        else if (_model.CanGoNext)
        {
            _model.CurrentStep++;
        }
    }

    private async Task CompleteSetup()
    {
        _isProcessing = true;

        try
        {
            // Step 1: Register the SuperAdmin user (which creates the organization)
            var registerRequest = new RegisterRequest
            {
                Email = _model.AdminEmail,
                Password = _model.AdminPassword,
                FullName = _model.AdminFullName,
                PhoneNumber = _model.AdminPhoneNumber,
                Timezone = _model.AdminTimezone,
                OrganizationName = _model.OrganizationName
            };

            var result = await AuthApi.RegisterAsync(registerRequest);

            if (!result.Success)
            {
                _error = result.Message ?? "Registration failed. Please try again.";
                _isProcessing = false;
                return;
            }

            // TODO: Step 2: Save Twilio configuration if provided
            // This would require a SystemConfiguration API endpoint

            // Mark setup as complete
            SetupService.MarkSetupComplete();

            // Navigate to dashboard
            Navigation.NavigateTo("/dashboard");
        }
        catch (Exception ex)
        {
            _error = $"Setup failed: {ex.Message}";
            _isProcessing = false;
        }
    }
}
```

#### 3.4 Update App.razor to Check Setup Status

**File**: `src/alertblurty.Web/App.razor`

**Action**: Add setup check logic:

```razor
<CascadingAuthenticationState>
    <Router AppAssembly="@typeof(App).Assembly">
        <Found Context="routeData">
            <AuthorizeRouteView RouteData="@routeData" DefaultLayout="@typeof(MainLayout)">
                <NotAuthorized>
                    @if (context.User.Identity?.IsAuthenticated != true)
                    {
                        <RedirectToLogin />
                    }
                    else
                    {
                        <p role="alert">You are not authorized to access this resource.</p>
                    }
                </NotAuthorized>
            </AuthorizeRouteView>
            <FocusOnNavigate RouteData="@routeData" Selector="h1" />
        </Found>
        <NotFound>
            <PageTitle>Not found</PageTitle>
            <LayoutView Layout="@typeof(MainLayout)">
                <p role="alert">Sorry, there's nothing at this address.</p>
            </LayoutView>
        </NotFound>
    </Router>
</CascadingAuthenticationState>

@code {
    // Setup check handled in MainLayout
}
```

#### 3.5 Create RedirectToLogin Component

**File**: `src/alertblurty.Web/Shared/RedirectToLogin.razor`

**Action**: Create redirect helper:

```razor
@inject NavigationManager Navigation

@code {
    protected override void OnInitialized()
    {
        Navigation.NavigateTo("/login");
    }
}
```

### Success Criteria
- [ ] Setup wizard displays correctly with 3 steps
- [ ] Form validation works on all fields
- [ ] Organization and user creation succeeds via API
- [ ] After setup, user is logged in automatically
- [ ] Setup wizard redirects to dashboard after completion
- [ ] Setup wizard is skipped on subsequent visits

### Testing Strategy
1. Clear sessionStorage in browser
2. Ensure API database is empty (no organizations)
3. Navigate to app root
4. Verify redirect to `/setup`
5. Complete all wizard steps
6. Verify redirect to dashboard
7. Verify user is authenticated

---

## PHASE 4: Authentication UI

### Objective
Create login and register pages with proper form validation and error handling.

### Duration Estimate
2-3 hours

### Steps

#### 4.1 Create Login Page

**File**: `src/alertblurty.Web/Pages/Auth/Login.razor`

**Action**: Create login form:

```razor
@page "/login"
@using alertblurty.Models.Requests.Auth
@inject AuthApiService AuthApi
@inject NavigationManager Navigation
@layout MinimalLayout

<PageTitle>Login - AlertyBlurty</PageTitle>

<div class="container">
    <div class="row justify-content-center align-items-center" style="min-height: 100vh;">
        <div class="col-md-5">
            <div class="card shadow">
                <div class="card-body p-5">
                    <div class="text-center mb-4">
                        <h2>AlertyBlurty</h2>
                        <p class="text-muted">On-Call Alert Management</p>
                    </div>

                    @if (_error != null)
                    {
                        <div class="alert alert-danger">@_error</div>
                    }

                    <EditForm Model="_model" OnValidSubmit="HandleLogin">
                        <DataAnnotationsValidator />

                        <div class="mb-3">
                            <label class="form-label">Email</label>
                            <InputText @bind-Value="_model.Email"
                                       class="form-control"
                                       placeholder="your@email.com"
                                       autofocus />
                            <ValidationMessage For="@(() => _model.Email)" />
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Password</label>
                            <InputText @bind-Value="_model.Password"
                                       type="password"
                                       class="form-control" />
                            <ValidationMessage For="@(() => _model.Password)" />
                        </div>

                        <button type="submit"
                                class="btn btn-primary w-100 mb-3"
                                disabled="@_isLoggingIn">
                            @if (_isLoggingIn)
                            {
                                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                                <span>Logging in...</span>
                            }
                            else
                            {
                                <span>Login</span>
                            }
                        </button>
                    </EditForm>

                    <div class="text-center">
                        <a href="/register" class="text-decoration-none">
                            Don't have an account? Register here
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

@code {
    private LoginRequest _model = new();
    private bool _isLoggingIn = false;
    private string? _error = null;

    private async Task HandleLogin()
    {
        _isLoggingIn = true;
        _error = null;

        try
        {
            var result = await AuthApi.LoginAsync(_model);

            if (result.Success)
            {
                Navigation.NavigateTo("/dashboard");
            }
            else
            {
                _error = result.Message ?? "Invalid email or password";
            }
        }
        catch (Exception ex)
        {
            _error = $"Login failed: {ex.Message}";
        }
        finally
        {
            _isLoggingIn = false;
        }
    }
}
```

#### 4.2 Create Register Page

**File**: `src/alertblurty.Web/Pages/Auth/Register.razor`

**Action**: Create registration form:

```razor
@page "/register"
@using alertblurty.Models.Requests.Auth
@using System.ComponentModel.DataAnnotations
@inject AuthApiService AuthApi
@inject NavigationManager Navigation
@inject SetupService SetupService
@layout MinimalLayout

<PageTitle>Register - AlertyBlurty</PageTitle>

<div class="container">
    <div class="row justify-content-center align-items-center" style="min-height: 100vh;">
        <div class="col-md-6">
            <div class="card shadow">
                <div class="card-body p-5">
                    <div class="text-center mb-4">
                        <h2>Create Account</h2>
                        <p class="text-muted">Join your organization on AlertyBlurty</p>
                    </div>

                    @if (_error != null)
                    {
                        <div class="alert alert-danger">@_error</div>
                    }

                    <EditForm Model="_model" OnValidSubmit="HandleRegister">
                        <DataAnnotationsValidator />

                        <div class="mb-3">
                            <label class="form-label">Full Name</label>
                            <InputText @bind-Value="_model.FullName"
                                       class="form-control"
                                       placeholder="John Doe" />
                            <ValidationMessage For="@(() => _model.FullName)" />
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Email</label>
                            <InputText @bind-Value="_model.Email"
                                       type="email"
                                       class="form-control"
                                       placeholder="your@email.com" />
                            <ValidationMessage For="@(() => _model.Email)" />
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Phone Number</label>
                            <InputText @bind-Value="_model.PhoneNumber"
                                       type="tel"
                                       class="form-control"
                                       placeholder="+1234567890" />
                            <small class="form-text text-muted">Format: +1234567890</small>
                            <ValidationMessage For="@(() => _model.PhoneNumber)" />
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Organization Name</label>
                            <InputText @bind-Value="_model.OrganizationName"
                                       class="form-control"
                                       placeholder="Acme Corporation" />
                            <ValidationMessage For="@(() => _model.OrganizationName)" />
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Password</label>
                            <InputText @bind-Value="_model.Password"
                                       type="password"
                                       class="form-control" />
                            <small class="form-text text-muted">Minimum 8 characters</small>
                            <ValidationMessage For="@(() => _model.Password)" />
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Confirm Password</label>
                            <InputText @bind-Value="_model.PasswordConfirm"
                                       type="password"
                                       class="form-control" />
                            <ValidationMessage For="@(() => _model.PasswordConfirm)" />
                        </div>

                        <div class="mb-3">
                            <label class="form-label">Timezone</label>
                            <InputSelect @bind-Value="_model.Timezone" class="form-control">
                                <option value="America/New_York">Eastern Time (US & Canada)</option>
                                <option value="America/Chicago">Central Time (US & Canada)</option>
                                <option value="America/Denver">Mountain Time (US & Canada)</option>
                                <option value="America/Los_Angeles">Pacific Time (US & Canada)</option>
                                <option value="UTC">UTC</option>
                            </InputSelect>
                            <ValidationMessage For="@(() => _model.Timezone)" />
                        </div>

                        <button type="submit"
                                class="btn btn-primary w-100 mb-3"
                                disabled="@_isRegistering">
                            @if (_isRegistering)
                            {
                                <span class="spinner-border spinner-border-sm me-2" role="status"></span>
                                <span>Creating account...</span>
                            }
                            else
                            {
                                <span>Register</span>
                            }
                        </button>
                    </EditForm>

                    <div class="text-center">
                        <a href="/login" class="text-decoration-none">
                            Already have an account? Login here
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>

@code {
    private RegisterViewModel _model = new();
    private bool _isRegistering = false;
    private string? _error = null;

    protected override async Task OnInitializedAsync()
    {
        // Check if setup is required
        var setupRequired = await SetupService.IsSetupRequiredAsync();
        if (setupRequired)
        {
            Navigation.NavigateTo("/setup");
        }
    }

    private async Task HandleRegister()
    {
        _isRegistering = true;
        _error = null;

        try
        {
            var request = new RegisterRequest
            {
                Email = _model.Email,
                Password = _model.Password,
                FullName = _model.FullName,
                PhoneNumber = _model.PhoneNumber,
                Timezone = _model.Timezone,
                OrganizationName = _model.OrganizationName
            };

            var result = await AuthApi.RegisterAsync(request);

            if (result.Success)
            {
                Navigation.NavigateTo("/dashboard");
            }
            else
            {
                _error = result.Message ?? "Registration failed";
            }
        }
        catch (Exception ex)
        {
            _error = $"Registration failed: {ex.Message}";
        }
        finally
        {
            _isRegistering = false;
        }
    }

    public class RegisterViewModel
    {
        [Required(ErrorMessage = "Email is required")]
        [EmailAddress(ErrorMessage = "Invalid email")]
        public string Email { get; set; } = string.Empty;

        [Required(ErrorMessage = "Password is required")]
        [StringLength(100, MinimumLength = 8)]
        public string Password { get; set; } = string.Empty;

        [Required]
        [Compare(nameof(Password), ErrorMessage = "Passwords do not match")]
        public string PasswordConfirm { get; set; } = string.Empty;

        [Required(ErrorMessage = "Full name is required")]
        public string FullName { get; set; } = string.Empty;

        [Required(ErrorMessage = "Phone is required")]
        [Phone]
        public string PhoneNumber { get; set; } = string.Empty;

        [Required]
        public string Timezone { get; set; } = "America/New_York";

        [Required(ErrorMessage = "Organization name is required")]
        public string OrganizationName { get; set; } = string.Empty;
    }
}
```

#### 4.3 Create Minimal Layout for Auth Pages

**File**: `src/alertblurty.Web/Shared/MinimalLayout.razor`

**Action**: Create simple layout without navigation:

```razor
@inherits LayoutComponentBase

<div class="minimal-layout">
    @Body
</div>

<style>
    .minimal-layout {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        min-height: 100vh;
    }
</style>
```

### Success Criteria
- [ ] Login page displays and validates correctly
- [ ] Register page displays and validates correctly
- [ ] Successful login redirects to dashboard
- [ ] Successful registration redirects to dashboard
- [ ] Invalid credentials show error message
- [ ] Form validation prevents submission with invalid data

### Testing Strategy
1. Navigate to `/login`
2. Attempt login with invalid credentials
3. Verify error message
4. Login with valid credentials
5. Verify redirect to dashboard
6. Logout and test registration flow
7. Verify registration creates user and logs in

---

## PHASE 5: Layout & Navigation

### Objective
Create shared layout components with responsive navigation and user interface elements.

### Duration Estimate
3-4 hours

### Steps

#### 5.1 Update MainLayout

**File**: `src/alertblurty.Web/Shared/MainLayout.razor`

**Action**: Replace with new layout:

```razor
@inherits LayoutComponentBase
@inject NavigationManager Navigation
@inject SetupService SetupService
@inject AuthenticationStateProvider AuthStateProvider

@if (_isCheckingSetup)
{
    <div class="d-flex justify-content-center align-items-center" style="height: 100vh;">
        <div class="spinner-border text-primary" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    </div>
}
else
{
    <div class="page">
        <div class="sidebar">
            <NavMenu />
        </div>

        <main>
            <div class="top-row px-4">
                <TopBar />
            </div>

            <article class="content px-4">
                @Body
            </article>
        </main>
    </div>
}

@code {
    private bool _isCheckingSetup = true;

    protected override async Task OnInitializedAsync()
    {
        // Check if setup is required
        var setupRequired = await SetupService.IsSetupRequiredAsync();
        if (setupRequired)
        {
            Navigation.NavigateTo("/setup", forceLoad: true);
            return;
        }

        // Check authentication
        var authState = await AuthStateProvider.GetAuthenticationStateAsync();
        var user = authState.User;

        if (!user.Identity?.IsAuthenticated ?? true)
        {
            var currentPath = Navigation.ToBaseRelativePath(Navigation.Uri);
            if (currentPath != "login" && currentPath != "register" && currentPath != "setup")
            {
                Navigation.NavigateTo("/login");
                return;
            }
        }

        _isCheckingSetup = false;
    }
}
```

#### 5.2 Create TopBar Component

**File**: `src/alertblurty.Web/Shared/TopBar.razor`

**Action**: Create top navigation bar:

```razor
@using System.Security.Claims
@inject AuthApiService AuthApi
@inject NavigationManager Navigation
@inject AuthenticationStateProvider AuthStateProvider

<AuthorizeView>
    <Authorized>
        <div class="d-flex justify-content-end align-items-center">
            <span class="me-3">Welcome, <strong>@GetUserName(context.User)</strong></span>
            <button class="btn btn-sm btn-outline-danger" @onclick="HandleLogout">
                Logout
            </button>
        </div>
    </Authorized>
    <NotAuthorized>
        <div></div>
    </NotAuthorized>
</AuthorizeView>

@code {
    private string GetUserName(ClaimsPrincipal user)
    {
        return user.FindFirst(ClaimTypes.Name)?.Value
            ?? user.FindFirst(ClaimTypes.Email)?.Value
            ?? "User";
    }

    private async Task HandleLogout()
    {
        await AuthApi.LogoutAsync();
        Navigation.NavigateTo("/login", forceLoad: true);
    }
}
```

#### 5.3 Update NavMenu Component

**File**: `src/alertblurty.Web/Shared/NavMenu.razor`

**Action**: Replace with role-based navigation:

```razor
@using System.Security.Claims

<div class="top-row ps-3 navbar navbar-dark">
    <div class="container-fluid">
        <a class="navbar-brand" href="">AlertyBlurty</a>
        <button title="Navigation menu" class="navbar-toggler" @onclick="ToggleNavMenu">
            <span class="navbar-toggler-icon"></span>
        </button>
    </div>
</div>

<div class="@NavMenuCssClass nav-scrollable" @onclick="ToggleNavMenu">
    <nav class="flex-column">
        <AuthorizeView>
            <Authorized>
                <div class="nav-item px-3">
                    <NavLink class="nav-link" href="dashboard" Match="NavLinkMatch.All">
                        <span class="oi oi-dashboard" aria-hidden="true"></span> Dashboard
                    </NavLink>
                </div>

                <div class="nav-item px-3">
                    <NavLink class="nav-link" href="incidents">
                        <span class="oi oi-warning" aria-hidden="true"></span> Incidents
                    </NavLink>
                </div>

                <div class="nav-item px-3">
                    <NavLink class="nav-link" href="teams">
                        <span class="oi oi-people" aria-hidden="true"></span> Teams
                    </NavLink>
                </div>

                <AuthorizeView Roles="Admin,SuperAdmin">
                    <Authorized>
                        <div class="nav-item px-3">
                            <NavLink class="nav-link" href="users">
                                <span class="oi oi-person" aria-hidden="true"></span> Users
                            </NavLink>
                        </div>
                    </Authorized>
                </AuthorizeView>

                <div class="nav-item px-3">
                    <NavLink class="nav-link" href="profile">
                        <span class="oi oi-person" aria-hidden="true"></span> My Profile
                    </NavLink>
                </div>
            </Authorized>
        </AuthorizeView>
    </nav>
</div>

@code {
    private bool collapseNavMenu = true;

    private string? NavMenuCssClass => collapseNavMenu ? "collapse" : null;

    private void ToggleNavMenu()
    {
        collapseNavMenu = !collapseNavMenu;
    }
}
```

#### 5.4 Create Shared Components

**File**: `src/alertblurty.Web/Shared/Components/LoadingSpinner.razor`

**Action**: Create reusable loading spinner:

```razor
@if (IsLoading)
{
    <div class="text-center py-5">
        <div class="spinner-border text-primary" role="status" style="width: 3rem; height: 3rem;">
            <span class="visually-hidden">Loading...</span>
        </div>
        @if (!string.IsNullOrEmpty(Message))
        {
            <p class="mt-3">@Message</p>
        }
    </div>
}

@code {
    [Parameter]
    public bool IsLoading { get; set; }

    [Parameter]
    public string? Message { get; set; }
}
```

**File**: `src/alertblurty.Web/Shared/Components/EmptyState.razor`

**Action**: Create empty state component:

```razor
<div class="text-center py-5">
    <div class="mb-3">
        @if (!string.IsNullOrEmpty(Icon))
        {
            <span class="oi oi-@Icon" style="font-size: 4rem; opacity: 0.3;"></span>
        }
    </div>
    <h4>@Title</h4>
    @if (!string.IsNullOrEmpty(Message))
    {
        <p class="text-muted">@Message</p>
    }
    @if (ChildContent != null)
    {
        <div class="mt-3">
            @ChildContent
        </div>
    }
</div>

@code {
    [Parameter]
    public string? Icon { get; set; }

    [Parameter]
    public string Title { get; set; } = "No Data";

    [Parameter]
    public string? Message { get; set; }

    [Parameter]
    public RenderFragment? ChildContent { get; set; }
}
```

**File**: `src/alertblurty.Web/Shared/Components/ConfirmDialog.razor`

**Action**: Create confirmation dialog:

```razor
@if (IsVisible)
{
    <div class="modal show d-block" tabindex="-1" role="dialog">
        <div class="modal-dialog" role="document">
            <div class="modal-content">
                <div class="modal-header">
                    <h5 class="modal-title">@Title</h5>
                    <button type="button" class="btn-close" @onclick="Cancel"></button>
                </div>
                <div class="modal-body">
                    <p>@Message</p>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-secondary" @onclick="Cancel">Cancel</button>
                    <button type="button" class="btn btn-danger" @onclick="Confirm">@ConfirmText</button>
                </div>
            </div>
        </div>
    </div>
    <div class="modal-backdrop show"></div>
}

@code {
    [Parameter]
    public bool IsVisible { get; set; }

    [Parameter]
    public string Title { get; set; } = "Confirm Action";

    [Parameter]
    public string Message { get; set; } = "Are you sure?";

    [Parameter]
    public string ConfirmText { get; set; } = "Confirm";

    [Parameter]
    public EventCallback OnConfirm { get; set; }

    [Parameter]
    public EventCallback OnCancel { get; set; }

    private async Task Confirm()
    {
        await OnConfirm.InvokeAsync();
    }

    private async Task Cancel()
    {
        await OnCancel.InvokeAsync();
    }
}
```

#### 5.5 Create Custom CSS

**File**: `src/alertblurty.Web/wwwroot/css/app.css`

**Action**: Create custom styles:

```css
/* Main Layout */
.page {
    position: relative;
    display: flex;
    flex-direction: column;
}

main {
    flex: 1;
}

.sidebar {
    background-image: linear-gradient(180deg, rgb(5, 39, 103) 0%, #3a0647 70%);
}

.top-row {
    background-color: #f7f7f7;
    border-bottom: 1px solid #d6d5d5;
    justify-content: flex-end;
    height: 3.5rem;
    display: flex;
    align-items: center;
}

.top-row ::deep a, .top-row ::deep .btn-link {
    white-space: nowrap;
    margin-left: 1.5rem;
    text-decoration: none;
}

.top-row ::deep a:hover, .top-row ::deep .btn-link:hover {
    text-decoration: underline;
}

.top-row ::deep a:first-child {
    overflow: hidden;
    text-overflow: ellipsis;
}

/* Navigation */
.navbar-toggler {
    background-color: rgba(255, 255, 255, 0.1);
}

.valid.modified:not([type=checkbox]) {
    outline: 1px solid #26b050;
}

.invalid {
    outline: 1px solid red;
}

.validation-message {
    color: red;
    font-size: 0.875rem;
}

/* Cards */
.card {
    margin-bottom: 1.5rem;
}

.card-header {
    background-color: #f8f9fa;
    border-bottom: 1px solid rgba(0,0,0,.125);
}

/* Tables */
.table-hover tbody tr:hover {
    cursor: pointer;
}

/* Badges */
.badge {
    font-size: 0.875rem;
    font-weight: 500;
}

/* Status Colors */
.status-open {
    color: #dc3545;
}

.status-acknowledged {
    color: #ffc107;
}

.status-resolved {
    color: #28a745;
}

/* Buttons */
.btn {
    font-weight: 500;
}

/* Responsive */
@media (max-width: 640.98px) {
    .top-row:not(.auth) {
        display: none;
    }

    .top-row.auth {
        justify-content: space-between;
    }

    .top-row ::deep a, .top-row ::deep .btn-link {
        margin-left: 0;
    }
}

@media (min-width: 641px) {
    .page {
        flex-direction: row;
    }

    .sidebar {
        width: 250px;
        height: 100vh;
        position: sticky;
        top: 0;
    }

    .top-row {
        position: sticky;
        top: 0;
        z-index: 1;
    }

    .top-row.auth ::deep a:first-child {
        flex: 1;
        text-align: right;
        width: 0;
    }

    .top-row, article {
        padding-left: 2rem !important;
        padding-right: 1.5rem !important;
    }
}
```

### Success Criteria
- [ ] Navigation menu displays correctly
- [ ] Role-based menu items show/hide appropriately
- [ ] Top bar displays user info and logout button
- [ ] Logout function works correctly
- [ ] Responsive design works on mobile devices
- [ ] Loading spinner displays during async operations
- [ ] Empty state displays when no data

### Testing Strategy
1. Login as different user roles
2. Verify menu items change based on role
3. Test navigation between pages
4. Test logout functionality
5. Resize browser to test responsive design
6. Verify loading states appear correctly

---

## PHASE 6: Dashboard

### Objective
Create main dashboard showing incident overview and quick stats.

### Duration Estimate
2-3 hours

### Steps

#### 6.1 Create Dashboard Page

**File**: `src/alertblurty.Web/Pages/Dashboard/Index.razor`

**Action**: Create dashboard with incident overview:

```razor
@page "/dashboard"
@page "/"
@attribute [Authorize]
@using alertblurty.Models.DTOs
@inject IncidentApiService IncidentApi
@inject TeamApiService TeamApi
@inject UserApiService UserApi
@inject NavigationManager Navigation

<PageTitle>Dashboard - AlertyBlurty</PageTitle>

<div class="dashboard">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>Dashboard</h1>
        <button class="btn btn-primary" @onclick="RefreshData">
            <span class="oi oi-reload"></span> Refresh
        </button>
    </div>

    @if (_isLoading)
    {
        <LoadingSpinner IsLoading="true" Message="Loading dashboard..." />
    }
    else if (_error != null)
    {
        <div class="alert alert-danger">
            <strong>Error:</strong> @_error
        </div>
    }
    else
    {
        <!-- Stats Cards -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="card text-white bg-danger">
                    <div class="card-body">
                        <h5 class="card-title">Open Incidents</h5>
                        <h2 class="mb-0">@_openCount</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-white bg-warning">
                    <div class="card-body">
                        <h5 class="card-title">Acknowledged</h5>
                        <h2 class="mb-0">@_acknowledgedCount</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-white bg-success">
                    <div class="card-body">
                        <h5 class="card-title">Resolved Today</h5>
                        <h2 class="mb-0">@_resolvedTodayCount</h2>
                    </div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="card text-white bg-info">
                    <div class="card-body">
                        <h5 class="card-title">Total Teams</h5>
                        <h2 class="mb-0">@(_teams?.Count ?? 0)</h2>
                    </div>
                </div>
            </div>
        </div>

        <!-- Recent Incidents -->
        <div class="card">
            <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Recent Open Incidents</h5>
                <a href="/incidents" class="btn btn-sm btn-primary">View All</a>
            </div>
            <div class="card-body">
                @if (_incidents == null || !_incidents.Any())
                {
                    <EmptyState
                        Icon="warning"
                        Title="No Open Incidents"
                        Message="Great! There are no open incidents at the moment." />
                }
                else
                {
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Severity</th>
                                    <th>Host</th>
                                    <th>Trigger</th>
                                    <th>Team</th>
                                    <th>Status</th>
                                    <th>First Occurrence</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach (var incident in _incidents.Take(10))
                                {
                                    <tr @onclick="() => ViewIncident(incident.Id)" style="cursor: pointer;">
                                        <td>
                                            <span class="badge bg-@GetSeverityColor(incident.Severity)">
                                                @GetSeverityName(incident.Severity)
                                            </span>
                                        </td>
                                        <td>@incident.HostName</td>
                                        <td>@incident.TriggerName</td>
                                        <td>@incident.TeamName</td>
                                        <td>
                                            <span class="badge bg-@GetStatusColor(incident.Status)">
                                                @incident.Status
                                            </span>
                                        </td>
                                        <td>@incident.FirstOccurrenceUtc.ToLocalTime().ToString("g")</td>
                                        <td>
                                            @if (incident.Status == IncidentStatus.Open)
                                            {
                                                <button class="btn btn-sm btn-warning"
                                                        @onclick="() => AcknowledgeIncident(incident.Id)"
                                                        @onclick:stopPropagation="true">
                                                    Acknowledge
                                                </button>
                                            }
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                }
            </div>
        </div>

        <!-- Team Overview -->
        @if (_teams != null && _teams.Any())
        {
            <div class="card mt-4">
                <div class="card-header">
                    <h5 class="mb-0">Team Overview</h5>
                </div>
                <div class="card-body">
                    <div class="row">
                        @foreach (var team in _teams)
                        {
                            <div class="col-md-4 mb-3">
                                <div class="card">
                                    <div class="card-body">
                                        <h6 class="card-title">@team.Name</h6>
                                        <p class="card-text text-muted small">@team.Description</p>
                                        <p class="mb-1">
                                            <strong>Members:</strong> @(team.Members?.Count ?? 0)
                                        </p>
                                        <a href="/teams/@team.Id" class="btn btn-sm btn-outline-primary">
                                            View Details
                                        </a>
                                    </div>
                                </div>
                            </div>
                        }
                    </div>
                </div>
            </div>
        }
    }
</div>

@code {
    private bool _isLoading = true;
    private string? _error = null;

    private List<IncidentDto>? _incidents;
    private List<TeamDto>? _teams;
    private UserDto? _currentUser;

    private int _openCount = 0;
    private int _acknowledgedCount = 0;
    private int _resolvedTodayCount = 0;

    protected override async Task OnInitializedAsync()
    {
        await LoadData();
    }

    private async Task LoadData()
    {
        _isLoading = true;
        _error = null;

        try
        {
            // Load current user
            _currentUser = await UserApi.GetCurrentUserAsync();

            if (_currentUser == null)
            {
                _error = "Failed to load user information";
                return;
            }

            // Load incidents
            _incidents = await IncidentApi.GetOpenIncidentsAsync();

            // Calculate stats
            _openCount = _incidents?.Count(i => i.Status == IncidentStatus.Open) ?? 0;
            _acknowledgedCount = _incidents?.Count(i => i.Status == IncidentStatus.Acknowledged) ?? 0;
            _resolvedTodayCount = 0; // This would require additional API endpoint

            // Load teams
            _teams = await TeamApi.GetByOrganizationAsync(_currentUser.OrganizationId);
        }
        catch (Exception ex)
        {
            _error = $"Failed to load dashboard: {ex.Message}";
        }
        finally
        {
            _isLoading = false;
        }
    }

    private async Task RefreshData()
    {
        await LoadData();
    }

    private void ViewIncident(Guid id)
    {
        Navigation.NavigateTo($"/incidents/{id}");
    }

    private async Task AcknowledgeIncident(Guid id)
    {
        try
        {
            await IncidentApi.AcknowledgeAsync(id);
            await LoadData(); // Refresh
        }
        catch (Exception ex)
        {
            _error = $"Failed to acknowledge incident: {ex.Message}";
        }
    }

    private string GetSeverityColor(int severity)
    {
        return severity switch
        {
            >= 4 => "danger",   // Disaster, High
            3 => "warning",      // Average
            _ => "info"          // Warning, Info
        };
    }

    private string GetSeverityName(int severity)
    {
        return severity switch
        {
            5 => "Disaster",
            4 => "High",
            3 => "Average",
            2 => "Warning",
            1 => "Info",
            _ => "Unknown"
        };
    }

    private string GetStatusColor(IncidentStatus status)
    {
        return status switch
        {
            IncidentStatus.Open => "danger",
            IncidentStatus.Acknowledged => "warning",
            IncidentStatus.Resolved => "success",
            _ => "secondary"
        };
    }
}
```

### Success Criteria
- [ ] Dashboard displays stat cards correctly
- [ ] Recent incidents list shows open incidents
- [ ] Team overview displays all teams
- [ ] Acknowledge button works on incidents
- [ ] Refresh button reloads data
- [ ] Empty state shows when no incidents
- [ ] Loading state displays during data fetch

### Testing Strategy
1. Login and navigate to dashboard
2. Verify stats are calculated correctly
3. Click on incident to view details
4. Acknowledge an incident from dashboard
5. Verify refresh button updates data
6. Test with empty database (no incidents)

---

## PHASE 7: Incident Management

### Objective
Create pages for viewing, filtering, and managing incidents.

### Duration Estimate
3-4 hours

### Steps

#### 7.1 Create Incidents List Page

**File**: `src/alertblurty.Web/Pages/Incidents/Index.razor`

**Action**: Create incidents list with filtering:

```razor
@page "/incidents"
@attribute [Authorize]
@using alertblurty.Models.DTOs
@inject IncidentApiService IncidentApi
@inject TeamApiService TeamApi
@inject UserApiService UserApi
@inject NavigationManager Navigation

<PageTitle>Incidents - AlertyBlurty</PageTitle>

<div class="incidents-page">
    <div class="d-flex justify-content-between align-items-center mb-4">
        <h1>Incidents</h1>
        <button class="btn btn-primary" @onclick="LoadData">
            <span class="oi oi-reload"></span> Refresh
        </button>
    </div>

    <!-- Filters -->
    <div class="card mb-4">
        <div class="card-body">
            <div class="row">
                <div class="col-md-4">
                    <label class="form-label">Status</label>
                    <select class="form-select" @onchange="OnStatusFilterChanged">
                        <option value="">All</option>
                        <option value="@((int)IncidentStatus.Open)">Open</option>
                        <option value="@((int)IncidentStatus.Acknowledged)">Acknowledged</option>
                        <option value="@((int)IncidentStatus.Resolved)">Resolved</option>
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Team</label>
                    <select class="form-select" @onchange="OnTeamFilterChanged">
                        <option value="">All Teams</option>
                        @if (_teams != null)
                        {
                            @foreach (var team in _teams)
                            {
                                <option value="@team.Id">@team.Name</option>
                            }
                        }
                    </select>
                </div>
                <div class="col-md-4">
                    <label class="form-label">Search</label>
                    <input type="text"
                           class="form-control"
                           placeholder="Search by host or trigger..."
                           @bind="_searchText"
                           @bind:event="oninput"
                           @onkeyup="OnSearchChanged" />
                </div>
            </div>
        </div>
    </div>

    @if (_isLoading)
    {
        <LoadingSpinner IsLoading="true" Message="Loading incidents..." />
    }
    else if (_error != null)
    {
        <div class="alert alert-danger">@_error</div>
    }
    else
    {
        <div class="card">
            <div class="card-header">
                <h5 class="mb-0">
                    @(_filteredIncidents?.Count ?? 0) Incident(s)
                </h5>
            </div>
            <div class="card-body">
                @if (_filteredIncidents == null || !_filteredIncidents.Any())
                {
                    <EmptyState
                        Icon="warning"
                        Title="No Incidents Found"
                        Message="No incidents match your current filters." />
                }
                else
                {
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Severity</th>
                                    <th>Host</th>
                                    <th>Trigger</th>
                                    <th>Team</th>
                                    <th>Status</th>
                                    <th>Events</th>
                                    <th>First Occurrence</th>
                                    <th>Last Occurrence</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                @foreach (var incident in _filteredIncidents)
                                {
                                    <tr @onclick="() => ViewIncident(incident.Id)" style="cursor: pointer;">
                                        <td>
                                            <span class="badge bg-@GetSeverityColor(incident.Severity)">
                                                @GetSeverityName(incident.Severity)
                                            </span>
                                        </td>
                                        <td>@incident.HostName</td>
                                        <td>@incident.TriggerName</td>
                                        <td>@incident.TeamName</td>
                                        <td>
                                            <span class="badge bg-@GetStatusColor(incident.Status)">
                                                @incident.Status
                                            </span>
                                        </td>
                                        <td>@incident.EventCount</td>
                                        <td>@incident.FirstOccurrenceUtc.ToLocalTime().ToString("g")</td>
                                        <td>@incident.LastOccurrenceUtc.ToLocalTime().ToString("g")</td>
                                        <td>
                                            @if (incident.Status == IncidentStatus.Open)
                                            {
                                                <button class="btn btn-sm btn-warning"
                                                        @onclick="() => AcknowledgeIncident(incident.Id)"
                                                        @onclick:stopPropagation="true">
                                                    Acknowledge
                                                </button>
                                            }
                                            else if (incident.Status == IncidentStatus.Acknowledged)
                                            {
                                                <span class="text-muted small">
                                                    By @incident.AcknowledgedByUserName
                                                </span>
                                            }
                                        </td>
                                    </tr>
                                }
                            </tbody>
                        </table>
                    </div>
                }
            </div>
        </div>
    }
</div>

@code {
    private bool _isLoading = true;
    private string? _error = null;

    private List<IncidentDto>? _allIncidents;
    private List<IncidentDto>? _filteredIncidents;
    private List<TeamDto>? _teams;
    private UserDto? _currentUser;

    private IncidentStatus? _statusFilter = null;
    private Guid? _teamFilter = null;
    private string _searchText = string.Empty;

    protected override async Task OnInitializedAsync()
    {
        await LoadData();
    }

    private async Task LoadData()
    {
        _isLoading = true;
        _error = null;

        try
        {
            _currentUser = await UserApi.GetCurrentUserAsync();
            if (_currentUser == null)
            {
                _error = "Failed to load user information";
                return;
            }

            _allIncidents = await IncidentApi.GetOpenIncidentsAsync();
            _teams = await TeamApi.GetByOrganizationAsync(_currentUser.OrganizationId);

            ApplyFilters();
        }
        catch (Exception ex)
        {
            _error = $"Failed to load incidents: {ex.Message}";
        }
        finally
        {
            _isLoading = false;
        }
    }

    private void OnStatusFilterChanged(ChangeEventArgs e)
    {
        if (string.IsNullOrEmpty(e.Value?.ToString()))
        {
            _statusFilter = null;
        }
        else
        {
            _statusFilter = (IncidentStatus)int.Parse(e.Value.ToString()!);
        }
        ApplyFilters();
    }

    private void OnTeamFilterChanged(ChangeEventArgs e)
    {
        if (string.IsNullOrEmpty(e.Value?.ToString()))
        {
            _teamFilter = null;
        }
        else
        {
            _teamFilter = Guid.Parse(e.Value.ToString()!);
        }
        ApplyFilters();
    }

    private void OnSearchChanged()
    {
        ApplyFilters();
    }

    private void ApplyFilters()
    {
        _filteredIncidents = _allIncidents;

        if (_statusFilter.HasValue)
        {
            _filteredIncidents = _filteredIncidents?
                .Where(i => i.Status == _statusFilter.Value)
                .ToList();
        }

        if (_teamFilter.HasValue)
        {
            _filteredIncidents = _filteredIncidents?
                .Where(i => i.TeamId == _teamFilter.Value)
                .ToList();
        }

        if (!string.IsNullOrWhiteSpace(_searchText))
        {
            _filteredIncidents = _filteredIncidents?
                .Where(i =>
                    i.HostName.Contains(_searchText, StringComparison.OrdinalIgnoreCase) ||
                    i.TriggerName.Contains(_searchText, StringComparison.OrdinalIgnoreCase))
                .ToList();
        }
    }

    private void ViewIncident(Guid id)
    {
        Navigation.NavigateTo($"/incidents/{id}");
    }

    private async Task AcknowledgeIncident(Guid id)
    {
        try
        {
            await IncidentApi.AcknowledgeAsync(id);
            await LoadData();
        }
        catch (Exception ex)
        {
            _error = $"Failed to acknowledge incident: {ex.Message}";
        }
    }

    private string GetSeverityColor(int severity) => severity switch
    {
        >= 4 => "danger",
        3 => "warning",
        _ => "info"
    };

    private string GetSeverityName(int severity) => severity switch
    {
        5 => "Disaster",
        4 => "High",
        3 => "Average",
        2 => "Warning",
        1 => "Info",
        _ => "Unknown"
    };

    private string GetStatusColor(IncidentStatus status) => status switch
    {
        IncidentStatus.Open => "danger",
        IncidentStatus.Acknowledged => "warning",
        IncidentStatus.Resolved => "success",
        _ => "secondary"
    };
}
```

#### 7.2 Create Incident Detail Page

**File**: `src/alertblurty.Web/Pages/Incidents/Detail.razor`

**Action**: Create detailed incident view:

```razor
@page "/incidents/{Id:guid}"
@attribute [Authorize]
@using alertblurty.Models.DTOs
@inject IncidentApiService IncidentApi
@inject NavigationManager Navigation

<PageTitle>Incident Details - AlertyBlurty</PageTitle>

@if (_isLoading)
{
    <LoadingSpinner IsLoading="true" Message="Loading incident..." />
}
else if (_incident == null)
{
    <div class="alert alert-warning">
        <h4>Incident Not Found</h4>
        <p>The requested incident could not be found.</p>
        <a href="/incidents" class="btn btn-primary">Back to Incidents</a>
    </div>
}
else
{
    <div class="incident-detail">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h1>Incident Details</h1>
            <div>
                @if (_incident.Status == IncidentStatus.Open)
                {
                    <button class="btn btn-warning" @onclick="AcknowledgeIncident">
                        <span class="oi oi-check"></span> Acknowledge
                    </button>
                }
                <button class="btn btn-secondary" @onclick="GoBack">
                    <span class="oi oi-arrow-left"></span> Back
                </button>
            </div>
        </div>

        @if (_error != null)
        {
            <div class="alert alert-danger">@_error</div>
        }

        <div class="row">
            <div class="col-md-8">
                <div class="card mb-4">
                    <div class="card-header">
                        <h5 class="mb-0">Incident Information</h5>
                    </div>
                    <div class="card-body">
                        <dl class="row">
                            <dt class="col-sm-3">Status</dt>
                            <dd class="col-sm-9">
                                <span class="badge bg-@GetStatusColor(_incident.Status)">
                                    @_incident.Status
                                </span>
                            </dd>

                            <dt class="col-sm-3">Severity</dt>
                            <dd class="col-sm-9">
                                <span class="badge bg-@GetSeverityColor(_incident.Severity)">
                                    @GetSeverityName(_incident.Severity)
                                </span>
                            </dd>

                            <dt class="col-sm-3">Host</dt>
                            <dd class="col-sm-9">@_incident.HostName</dd>

                            <dt class="col-sm-3">Trigger</dt>
                            <dd class="col-sm-9">@_incident.TriggerName</dd>

                            <dt class="col-sm-3">Description</dt>
                            <dd class="col-sm-9">@_incident.TriggerDescription</dd>

                            <dt class="col-sm-3">Team</dt>
                            <dd class="col-sm-9">@_incident.TeamName</dd>

                            <dt class="col-sm-3">Event Count</dt>
                            <dd class="col-sm-9">@_incident.EventCount</dd>

                            <dt class="col-sm-3">First Occurrence</dt>
                            <dd class="col-sm-9">@_incident.FirstOccurrenceUtc.ToLocalTime().ToString("F")</dd>

                            <dt class="col-sm-3">Last Occurrence</dt>
                            <dd class="col-sm-9">@_incident.LastOccurrenceUtc.ToLocalTime().ToString("F")</dd>

                            @if (_incident.AcknowledgedByUserId.HasValue)
                            {
                                <dt class="col-sm-3">Acknowledged By</dt>
                                <dd class="col-sm-9">@_incident.AcknowledgedByUserName</dd>

                                <dt class="col-sm-3">Acknowledged At</dt>
                                <dd class="col-sm-9">@_incident.AcknowledgedAtUtc?.ToLocalTime().ToString("F")</dd>
                            }
                        </dl>
                    </div>
                </div>
            </div>

            <div class="col-md-4">
                <div class="card">
                    <div class="card-header">
                        <h5 class="mb-0">Zabbix Information</h5>
                    </div>
                    <div class="card-body">
                        <dl>
                            <dt>Event ID</dt>
                            <dd><code>@_incident.ZabbixEventId</code></dd>

                            <dt>Trigger ID</dt>
                            <dd><code>@_incident.ZabbixTriggerId</code></dd>

                            <dt>Created</dt>
                            <dd>@_incident.CreatedAtUtc.ToLocalTime().ToString("F")</dd>

                            <dt>Updated</dt>
                            <dd>@_incident.UpdatedAtUtc.ToLocalTime().ToString("F")</dd>
                        </dl>
                    </div>
                </div>
            </div>
        </div>
    </div>
}

@code {
    [Parameter]
    public Guid Id { get; set; }

    private bool _isLoading = true;
    private string? _error = null;
    private IncidentDto? _incident;

    protected override async Task OnInitializedAsync()
    {
        await LoadIncident();
    }

    private async Task LoadIncident()
    {
        _isLoading = true;
        _error = null;

        try
        {
            _incident = await IncidentApi.GetByIdAsync(Id);
        }
        catch (Exception ex)
        {
            _error = $"Failed to load incident: {ex.Message}";
        }
        finally
        {
            _isLoading = false;
        }
    }

    private async Task AcknowledgeIncident()
    {
        try
        {
            await IncidentApi.AcknowledgeAsync(Id);
            await LoadIncident(); // Reload to show updated status
        }
        catch (Exception ex)
        {
            _error = $"Failed to acknowledge incident: {ex.Message}";
        }
    }

    private void GoBack()
    {
        Navigation.NavigateTo("/incidents");
    }

    private string GetSeverityColor(int severity) => severity switch
    {
        >= 4 => "danger",
        3 => "warning",
        _ => "info"
    };

    private string GetSeverityName(int severity) => severity switch
    {
        5 => "Disaster",
        4 => "High",
        3 => "Average",
        2 => "Warning",
        1 => "Info",
        _ => "Unknown"
    };

    private string GetStatusColor(IncidentStatus status) => status switch
    {
        IncidentStatus.Open => "danger",
        IncidentStatus.Acknowledged => "warning",
        IncidentStatus.Resolved => "success",
        _ => "secondary"
    };
}
```

### Success Criteria
- [ ] Incidents list displays all incidents
- [ ] Filters work correctly (status, team, search)
- [ ] Clicking incident navigates to detail page
- [ ] Incident detail shows all information
- [ ] Acknowledge button works from both list and detail
- [ ] Empty state shows when no incidents match filters

### Testing Strategy
1. Navigate to incidents page
2. Test each filter independently
3. Test combined filters
4. Test search functionality
5. Click incident to view details
6. Acknowledge incident from detail page
7. Verify navigation back to list

---

## PHASE 8: Team Management

### Objective
Create full CRUD interface for teams and team member management.

### Duration Estimate
4-5 hours

### Steps

Due to length constraints, I'll provide the structure for Phase 8:

#### 8.1 Create Teams List Page
**File**: `src/alertblurty.Web/Pages/Teams/Index.razor`
- Display all teams in cards or table
- Show member count
- Links to create, edit, view details
- Admin/SuperAdmin only

#### 8.2 Create Team Create Page
**File**: `src/alertblurty.Web/Pages/Teams/Create.razor`
- Form for creating new team
- Name, description, settings
- Admin/SuperAdmin only

#### 8.3 Create Team Edit Page
**File**: `src/alertblurty.Web/Pages/Teams/Edit.razor`
- Form for updating team
- Same fields as create
- Admin/SuperAdmin only

#### 8.4 Create Team Detail Page
**File**: `src/alertblurty.Web/Pages/Teams/Detail.razor`
- Show team information
- List of members with rotation order
- Add/remove member functionality
- Show current on-call user

---

## PHASE 9: User Management

### Objective
Create user administration interface with role-based access.

### Duration Estimate
3-4 hours

### Steps

#### 9.1 Create Users List Page
**File**: `src/alertblurty.Web/Pages/Users/Index.razor`
- Admin/SuperAdmin only
- Table of all users
- Show role, status, contact info
- Create, edit, delete actions

#### 9.2 Create User Create Page
**File**: `src/alertblurty.Web/Pages/Users/Create.razor`
- Form for creating users
- Email, name, phone, role, timezone
- Admin/SuperAdmin only

#### 9.3 Create User Edit Page
**File**: `src/alertblurty.Web/Pages/Users/Edit.razor`
- Update user information
- Cannot change email
- Can update role (SuperAdmin only)

#### 9.4 Create User Profile Page
**File**: `src/alertblurty.Web/Pages/Users/Profile.razor`
- View and edit own profile
- Change password functionality
- View teams user belongs to

---

## PHASE 10: Testing & Polish

### Objective
Comprehensive testing, error handling, and UI polish.

### Duration Estimate
3-4 hours

### Steps

#### 10.1 Error Handling Audit
- Review all API calls for try-catch
- Add meaningful error messages
- Add error boundaries for components
- Test network failures

#### 10.2 Loading States
- Verify all async operations show loading
- Add skeleton screens where appropriate
- Test slow network conditions

#### 10.3 Form Validation
- Test all forms with invalid data
- Verify validation messages
- Test required fields
- Test format validation (email, phone)

#### 10.4 Responsive Design Testing
- Test on mobile devices
- Test on tablets
- Verify navigation works on small screens
- Test all tables are scrollable

#### 10.5 Empty States
- Test all pages with no data
- Verify empty state messages
- Add helpful actions in empty states

#### 10.6 User Flow Testing
- Test complete first-run flow
- Test login/logout
- Test each CRUD operation
- Test role-based access

---

## PHASE 11: Documentation

### Objective
Document the Web UI setup, usage, and deployment.

### Duration Estimate
2 hours

### Steps

#### 11.1 Update README

**File**: `README.md` (root)

Add sections for:
- Web UI setup instructions
- Running API and Web together
- First-run wizard process
- User roles and permissions
- Deployment instructions

#### 11.2 Create Web Project README

**File**: `src/alertblurty.Web/README.md`

Document:
- Project structure
- Adding new pages
- Service architecture
- Authentication flow
- API client usage

#### 11.3 Create Developer Guide

**File**: `docs/DEVELOPER.md`

Include:
- Development environment setup
- Running in development mode
- Debugging tips
- Common issues and solutions

---

## Implementation Order & Dependencies

### Critical Path
1. **Phase 1** (Foundation) → Required for all
2. **Phase 2** (API Services) → Required for all
3. **Phase 3** (Setup Wizard) → Blocks first usage
4. **Phase 4** (Authentication) → Blocks access
5. **Phase 5** (Layout) → Required for all pages
6. **Phase 6-9** (Features) → Can be done in parallel
7. **Phase 10-11** (Polish & Docs) → Final

### Parallel Work Opportunities
After Phases 1-5 are complete:
- Dashboard (Phase 6) - Independent
- Incidents (Phase 7) - Independent
- Teams (Phase 8) - Independent
- Users (Phase 9) - Independent

---

## API Endpoint Gaps

The following API endpoints may need to be added:

### Organization Endpoints
- `GET /api/organizations/setup-status` - Check if setup is complete
- `GET /api/organizations/{id}` - Get organization by ID
- `POST /api/organizations` - Create organization
- `PUT /api/organizations/{id}` - Update organization
- `POST /api/organizations/{id}/complete-setup` - Mark setup complete

### System Configuration Endpoints
- `GET /api/config` - Get system configuration
- `PUT /api/config` - Update system configuration (Twilio settings)

### Statistics Endpoints (Optional)
- `GET /api/incidents/stats` - Get incident statistics
- `GET /api/incidents/resolved-today` - Get resolved incidents count

---

## Environment Configuration

### Running Both API and Web

**Option 1: Separate Terminals**
```bash
# Terminal 1: API
cd src/alertblurty.Api
dotnet run

# Terminal 2: Web
cd src/alertblurty.Web
dotnet run
```

**Option 2: Docker Compose (Future)**
Create `docker-compose.yml` to run both together.

### Port Configuration
- API: `http://localhost:5041`
- Web: `http://localhost:5000` (default) or `http://localhost:5191`
- Ensure API BaseUrl in Web's appsettings matches API port

---

## Security Considerations

### Token Storage
- Tokens stored in sessionStorage (cleared on browser close)
- Consider localStorage for "remember me" functionality
- Always use HTTPS in production

### Authorization
- All pages (except login/register/setup) require authentication
- Role-based authorization on Admin/SuperAdmin features
- API validates roles on backend (frontend is UI only)

### CORS
- API must allow Web origin in production
- Configure CORS policy in API Program.cs

---

## Testing Checklist

### Setup Wizard
- [ ] Redirects on first run
- [ ] Creates organization
- [ ] Creates SuperAdmin user
- [ ] Logs in automatically
- [ ] Marks setup complete
- [ ] Doesn't show again

### Authentication
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Register new user
- [ ] Logout
- [ ] Token expiration handling
- [ ] Unauthorized redirect

### Dashboard
- [ ] Stats display correctly
- [ ] Incidents list loads
- [ ] Team overview shows
- [ ] Acknowledge from dashboard
- [ ] Refresh works

### Incidents
- [ ] List all incidents
- [ ] Filter by status
- [ ] Filter by team
- [ ] Search by text
- [ ] View incident details
- [ ] Acknowledge incident
- [ ] Empty state

### Teams
- [ ] List all teams
- [ ] Create team
- [ ] Edit team
- [ ] Delete team
- [ ] View team details
- [ ] Add member
- [ ] Remove member
- [ ] Rotation order

### Users
- [ ] List all users (Admin+)
- [ ] Create user (Admin+)
- [ ] Edit user (Admin+)
- [ ] Delete user (SuperAdmin)
- [ ] View profile
- [ ] Edit own profile
- [ ] Role enforcement

---

## Risk Mitigation

### Risk: API Not Ready
- **Mitigation**: Use mock data services during development
- **Fallback**: Create stub API responses

### Risk: Authentication Issues
- **Mitigation**: Comprehensive logging of auth state
- **Fallback**: Force logout and retry

### Risk: Performance with Many Incidents
- **Mitigation**: Implement pagination
- **Fallback**: Client-side filtering and limiting

### Risk: Browser Compatibility
- **Mitigation**: Test on Chrome, Firefox, Safari, Edge
- **Fallback**: Polyfills for older browsers

---

## Future Enhancements (Post-MVP)

1. **Real-time Updates**
   - SignalR for live incident updates
   - Push notifications

2. **Advanced Filtering**
   - Date range filters
   - Multiple team selection
   - Saved filters

3. **Reporting**
   - Incident reports
   - Team performance metrics
   - Export to CSV/PDF

4. **Mobile App**
   - Native mobile app
   - Push notifications

5. **On-Call Schedule UI**
   - Visual schedule calendar
   - Shift swapping UI
   - Vacation management

---

## Success Metrics

### Functional Completeness
- [ ] All planned pages implemented
- [ ] All CRUD operations working
- [ ] All API endpoints integrated
- [ ] First-run wizard functional

### Code Quality
- [ ] No compilation errors
- [ ] Consistent error handling
- [ ] Proper validation on all forms
- [ ] Responsive on all screen sizes

### User Experience
- [ ] Intuitive navigation
- [ ] Fast load times (<2s)
- [ ] Clear error messages
- [ ] Helpful empty states

### Security
- [ ] Authentication required
- [ ] Role-based authorization
- [ ] Secure token storage
- [ ] No sensitive data in client

---

## Appendix: Full File Structure

```
src/alertblurty.Web/
├── alertblurty.Web.csproj
├── Program.cs
├── App.razor
├── _Imports.razor
├── appsettings.json
├── appsettings.Development.json
├── Authentication/
│   ├── CustomAuthStateProvider.cs
│   └── TokenAuthenticationHandler.cs
├── Services/
│   ├── ApiClient.cs
│   ├── TokenStorageService.cs
│   ├── SetupService.cs
│   ├── AuthApiService.cs
│   ├── UserApiService.cs
│   ├── TeamApiService.cs
│   ├── IncidentApiService.cs
│   └── OrganizationApiService.cs
├── Models/
│   └── ViewModels/
│       ├── LoginViewModel.cs
│       ├── RegisterViewModel.cs
│       └── SetupWizardViewModel.cs
├── Pages/
│   ├── _Host.cshtml
│   ├── Error.cshtml
│   ├── Error.cshtml.cs
│   ├── Setup/
│   │   └── Wizard.razor
│   ├── Auth/
│   │   ├── Login.razor
│   │   └── Register.razor
│   ├── Dashboard/
│   │   └── Index.razor
│   ├── Teams/
│   │   ├── Index.razor
│   │   ├── Create.razor
│   │   ├── Edit.razor
│   │   └── Detail.razor
│   ├── Users/
│   │   ├── Index.razor
│   │   ├── Create.razor
│   │   ├── Edit.razor
│   │   └── Profile.razor
│   └── Incidents/
│       ├── Index.razor
│       └── Detail.razor
├── Shared/
│   ├── MainLayout.razor
│   ├── MainLayout.razor.css
│   ├── MinimalLayout.razor
│   ├── NavMenu.razor
│   ├── NavMenu.razor.css
│   ├── TopBar.razor
│   ├── RedirectToLogin.razor
│   └── Components/
│       ├── LoadingSpinner.razor
│       ├── EmptyState.razor
│       └── ConfirmDialog.razor
└── wwwroot/
    ├── css/
    │   ├── app.css
    │   ├── bootstrap/
    │   └── site.css
    ├── js/
    │   └── storage.js
    └── favicon.png
```

---

## Conclusion

This plan provides a complete, step-by-step roadmap for implementing the AlertyBlurty Blazor Server Web UI. Each phase builds upon the previous, with clear dependencies and success criteria. The implementation follows best practices for Blazor development, includes proper error handling, and provides a polished user experience.

**Total Estimated Duration**: 25-35 hours

**Priority Order**:
1. Phase 1-3 (Critical for first use)
2. Phase 4-5 (Required for navigation)
3. Phase 6-7 (Core functionality)
4. Phase 8-9 (Administration)
5. Phase 10-11 (Polish and docs)

This plan is ready for execution in EXECUTE mode.
