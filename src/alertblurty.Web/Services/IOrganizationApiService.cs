using alertblurty.Models.DTOs;

namespace alertblurty.Web.Services;

public interface IOrganizationApiService
{
    Task<bool> HasOrganizationsAsync();
    Task<List<OrganizationDto>> GetAllAsync();
}
