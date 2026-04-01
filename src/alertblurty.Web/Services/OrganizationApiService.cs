using System.Net.Http.Json;
using alertblurty.Models.DTOs;

namespace alertblurty.Web.Services;

public class OrganizationApiService : IOrganizationApiService
{
    private readonly HttpClient _httpClient;

    public OrganizationApiService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<bool> HasOrganizationsAsync()
    {
        try
        {
            var organizations = await GetAllAsync();
            return organizations.Count > 0;
        }
        catch
        {
            return false;
        }
    }

    public async Task<List<OrganizationDto>> GetAllAsync()
    {
        try
        {
            // Note: This endpoint doesn't exist in the API yet
            // We'll need to add it or use a different approach
            var response = await _httpClient.GetAsync("/api/organizations");

            if (response.IsSuccessStatusCode)
            {
                return await response.Content.ReadFromJsonAsync<List<OrganizationDto>>() ?? new List<OrganizationDto>();
            }

            return new List<OrganizationDto>();
        }
        catch
        {
            return new List<OrganizationDto>();
        }
    }
}
