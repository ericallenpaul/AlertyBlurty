using System.Net.Http.Json;
using System.Net.Http.Headers;
using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Teams;

namespace alertblurty.Web.Services;

public class TeamApiService : ITeamApiService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStorageService _tokenStorage;

    public TeamApiService(HttpClient httpClient, ITokenStorageService tokenStorage)
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

    public async Task<TeamDto?> GetByIdAsync(Guid id)
    {
        try
        {
            await AddAuthHeaderAsync();
            return await _httpClient.GetFromJsonAsync<TeamDto>($"/api/teams/{id}");
        }
        catch
        {
            return null;
        }
    }

    public async Task<List<TeamDto>> GetByOrganizationAsync(Guid organizationId)
    {
        try
        {
            await AddAuthHeaderAsync();
            return await _httpClient.GetFromJsonAsync<List<TeamDto>>($"/api/teams/organization/{organizationId}") ?? new List<TeamDto>();
        }
        catch
        {
            return new List<TeamDto>();
        }
    }

    public async Task<TeamDto?> CreateAsync(CreateTeamRequest request)
    {
        try
        {
            await AddAuthHeaderAsync();
            var response = await _httpClient.PostAsJsonAsync("/api/teams", request);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<TeamDto>();
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<TeamDto?> UpdateAsync(Guid id, UpdateTeamRequest request)
    {
        try
        {
            await AddAuthHeaderAsync();
            var response = await _httpClient.PutAsJsonAsync($"/api/teams/{id}", request);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<TeamDto>();
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
            var response = await _httpClient.DeleteAsync($"/api/teams/{id}");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public async Task<List<TeamMemberDto>> GetMembersAsync(Guid teamId)
    {
        try
        {
            await AddAuthHeaderAsync();
            return await _httpClient.GetFromJsonAsync<List<TeamMemberDto>>($"/api/teams/{teamId}/members") ?? new List<TeamMemberDto>();
        }
        catch
        {
            return new List<TeamMemberDto>();
        }
    }

    public async Task<TeamMemberDto?> AddMemberAsync(Guid teamId, AddTeamMemberRequest request)
    {
        try
        {
            await AddAuthHeaderAsync();
            var response = await _httpClient.PostAsJsonAsync($"/api/teams/{teamId}/members", request);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<TeamMemberDto>();
            }

            return null;
        }
        catch
        {
            return null;
        }
    }

    public async Task<bool> RemoveMemberAsync(Guid teamId, Guid userId)
    {
        try
        {
            await AddAuthHeaderAsync();
            var response = await _httpClient.DeleteAsync($"/api/teams/{teamId}/members/{userId}");
            return response.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }
}
