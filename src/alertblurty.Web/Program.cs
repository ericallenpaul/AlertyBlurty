using Microsoft.AspNetCore.Components.Authorization;
using Blazored.LocalStorage;
using alertblurty.Web.Models;
using alertblurty.Web.Services;

var builder = WebApplication.CreateBuilder(args);

// Configure API Settings
builder.Services.Configure<ApiSettings>(builder.Configuration.GetSection("ApiSettings"));

// Add Blazored LocalStorage
builder.Services.AddBlazoredLocalStorage();

// Add HttpClient
builder.Services.AddScoped(sp =>
{
    var apiSettings = builder.Configuration.GetSection("ApiSettings").Get<ApiSettings>() ?? new ApiSettings();
    return new HttpClient { BaseAddress = new Uri(apiSettings.BaseUrl) };
});

// Add Authentication State Provider
builder.Services.AddScoped<ITokenStorageService, TokenStorageService>();
builder.Services.AddScoped<CustomAuthenticationStateProvider>();
builder.Services.AddScoped<AuthenticationStateProvider>(provider =>
    provider.GetRequiredService<CustomAuthenticationStateProvider>());

// Add Authorization
builder.Services.AddAuthorizationCore();

// Add API Services
builder.Services.AddScoped<IAuthApiService, AuthApiService>();
builder.Services.AddScoped<IOrganizationApiService, OrganizationApiService>();
builder.Services.AddScoped<IUserApiService, UserApiService>();
builder.Services.AddScoped<ITeamApiService, TeamApiService>();
builder.Services.AddScoped<IIncidentApiService, IncidentApiService>();

// Add services to the container.
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();

var app = builder.Build();

// Configure the HTTP request pipeline.
if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
    app.UseHsts();
}

app.UseHttpsRedirection();

app.UseStaticFiles();

app.UseRouting();

app.MapBlazorHub();
app.MapFallbackToPage("/_Host");

app.Run();
