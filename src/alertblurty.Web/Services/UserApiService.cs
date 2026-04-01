using System.Net.Http.Json;
using System.Net.Http.Headers;
using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Users;

namespace alertblurty.Web.Services;

public class UserApiService : IUserApiService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStorageService _tokenStorage;

    public UserApiService(HttpClient httpClient, ITokenStorageService tokenStorage)
    {
        _httpClient = httpClient;
        _tokenStorage = tokenStorage;
    }

    private async Task AddAuthHeaderAsync()
    {
        var token = await _tokenStorage.GetTokenAsync();
        if (!string.IsNullOrEmpty(token))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
    }

    public async Task<UserDto?> GetMeAsync()
    {
        try
        {
            await AddAuthHeaderAsync();
            return await _httpClient.GetFromJsonAsync<UserDto>("/api/users/me");
        }
        catch
        {
            return null;
        }
    }

    public async Task<UserDto?> GetByIdAsync(Guid id)
    {
        try
        {
            await AddAuthHeaderAsync();
            return await _httpClient.GetFromJsonAsync<UserDto>($"/api/users/{id}");
        }
        catch
        {
            return null;
        }
    }

    public async Task<List<UserDto>> GetByOrganizationAsync(Guid organizationId)
    {
        try
        {
            await AddAuthHeaderAsync();
            return await _httpClient.GetFromJsonAsync<List<UserDto>>($"/api/users/organization/{organizationId}") ?? new List<UserDto>();
        }
        catch
        {
            return new List<UserDto>();
        }
    }

    public async Task<UserDto?> CreateAsync(CreateUserRequest request)
    {
        try
        {
            await AddAuthHeaderAsync();
            var response = await _httpClient.PostAsJsonAsync("/api/users", request);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<UserDto>();
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<UserDto?> UpdateAsync(Guid id, UpdateUserRequest request)
    {
        try
        {
            await AddAuthHeaderAsync();
            var response = await _httpClient.PutAsJsonAsync($"/api/users/{id}", request);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<UserDto>();
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        try
        {
            await AddAuthHeaderAsync();
            var response = await _httpClient.DeleteAsync($"/api/users/{id}");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
