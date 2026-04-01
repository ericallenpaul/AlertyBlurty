using Blazored.LocalStorage;

namespace alertblurty.Web.Services;

public class TokenStorageService : ITokenStorageService
{
    private readonly ILocalStorageService _localStorage;
    private const string TokenKey = "authToken";

    public TokenStorageService(ILocalStorageService localStorage)
    {
        _localStorage = localStorage;
    }

    public async Task<string?> GetTokenAsync()
    {
        return await _localStorage.GetItemAsync<string>(TokenKey);
    }

    public async Task SetTokenAsync(string token)
    {
        await _localStorage.SetItemAsync(TokenKey, token);
    }

    public async Task RemoveTokenAsync()
    {
        await _localStorage.RemoveItemAsync(TokenKey);
    }

    public async Task<bool> HasTokenAsync()
    {
        var token = await GetTokenAsync();
        return !string.IsNullOrEmpty(token);
    }
}
