using System.Net.Http.Json;
using System.Net.Http.Headers;
using alertblurty.Models.DTOs;

namespace alertblurty.Web.Services;

public class IncidentApiService : IIncidentApiService
{
    private readonly HttpClient _httpClient;
    private readonly ITokenStorageService _tokenStorage;

    public IncidentApiService(HttpClient httpClient, ITokenStorageService tokenStorage)
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

    public async Task<IncidentDto?> GetByIdAsync(Guid id)
    {
        try
        {
            await AddAuthHeaderAsync();
            return await _httpClient.GetFromJsonAsync<IncidentDto>($"/api/incidents/{id}");
        }
        catch
        {
            return null;
        }
    }

    public async Task<List<IncidentDto>> GetOpenAsync()
    {
        try
        {
            await AddAuthHeaderAsync();
            return await _httpClient.GetFromJsonAsync<List<IncidentDto>>("/api/incidents/open") ?? new List<IncidentDto>();
        }
        catch
        {
            return new List<IncidentDto>();
        }
    }

    public async Task<List<IncidentDto>> GetByTeamAsync(Guid teamId, IncidentStatus? status = null)
    {
        try
        {
            await AddAuthHeaderAsync();
            var url = $"/api/incidents/team/{teamId}";
            if (status.HasValue)
            {
                url += $"?status={status.Value}";
            }

            return await _httpClient.GetFromJsonAsync<List<IncidentDto>>(url) ?? new List<IncidentDto>();
        }
        catch
        {
            return new List<IncidentDto>();
        }
    }

    public async Task<IncidentDto?> AcknowledgeAsync(Guid id)
    {
        try
        {
            await AddAuthHeaderAsync();
            var response = await _httpClient.PostAsync($"/api/incidents/{id}/acknowledge", null);

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<IncidentDto>();
            }

            return null;
        }
        catch
        {
            return null;
        }
    }
}
