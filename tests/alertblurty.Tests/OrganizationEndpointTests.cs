using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using alertblurty.Data;
using alertblurty.Models.DTOs;
using alertblurty.Models.Requests.Auth;
using alertblurty.Models.Responses;

namespace alertblurty.Tests;

public class OrganizationEndpointTests
{
    [Fact]
    public async Task GetOrganizations_AfterRegistration_ReturnsRegisteredOrganization()
    {
        Environment.SetEnvironmentVariable("JWT_SECRET", "test-secret-with-enough-length-for-hmac-signing");

        await using var factory = new AlertBlurtyApiFactory();
        using var client = factory.CreateClient();

        var organizationName = $"Endpoint Test Org {Guid.NewGuid():N}";
        var registerResponse = await client.PostAsJsonAsync("/api/auth/register", new RegisterRequest
        {
            Email = $"admin-{Guid.NewGuid():N}@example.com",
            Password = "Passw0rd!",
            FullName = "Endpoint Admin",
            PhoneNumber = "+15555550123",
            Timezone = "UTC",
            OrganizationName = organizationName
        });

        var registerContent = await registerResponse.Content.ReadAsStringAsync();
        registerResponse.IsSuccessStatusCode.Should().BeTrue(registerContent);
        var auth = await registerResponse.Content.ReadFromJsonAsync<ApiResponse<AuthResponse>>();
        auth.Should().NotBeNull();
        auth!.Success.Should().BeTrue();

        var organizations = await client.GetFromJsonAsync<List<OrganizationDto>>("/api/organizations");

        organizations.Should().NotBeNull();
        organizations.Should().ContainSingle(o => o.Name == organizationName);
    }
}

internal sealed class AlertBlurtyApiFactory : WebApplicationFactory<Program>
{
    private readonly string _databaseName = $"alertblurty-api-tests-{Guid.NewGuid():N}";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.ConfigureAppConfiguration(configuration =>
        {
            configuration.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["ConnectionStrings:DefaultConnection"] = "Host=localhost;Database=alertblurty_tests"
            });
        });

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<AlertBlurtyDbContext>>();
            services.RemoveAll<AlertBlurtyDbContext>();

            var dbContextConfigurationDescriptors = services
                .Where(descriptor => descriptor.ServiceType.FullName?.Contains("IDbContextOptionsConfiguration") == true)
                .ToList();

            foreach (var descriptor in dbContextConfigurationDescriptors)
            {
                services.Remove(descriptor);
            }

            services.AddDbContext<AlertBlurtyDbContext>(options =>
                options.UseInMemoryDatabase(_databaseName));
        });
    }
}
