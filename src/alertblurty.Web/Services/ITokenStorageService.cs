namespace alertblurty.Web.Services;

public interface ITokenStorageService
{
    Task<string?> GetTokenAsync();
    Task SetTokenAsync(string token);
    Task RemoveTokenAsync();
    Task<bool> HasTokenAsync();
}
