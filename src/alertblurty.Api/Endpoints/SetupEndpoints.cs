using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;
using alertblurty.Api.Configuration;
using alertblurty.Data;

namespace alertblurty.Api.Endpoints;

public static class SetupEndpoints
{
    public static void MapSetupEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/setup")
            .AllowAnonymous()
            .WithTags("Setup");

        group.MapGet("/status", async (
            [FromServices] BootstrapConfigurationStore configuration,
            [FromServices] IServiceScopeFactory scopeFactory,
            CancellationToken cancellationToken) =>
        {
            var databaseReachable = false;
            var hasOrganizations = false;

            if (configuration.Current.IsDatabaseConfigured)
            {
                try
                {
                    await using var scope = scopeFactory.CreateAsyncScope();
                    var dbContext = scope.ServiceProvider.GetRequiredService<AlertBlurtyDbContext>();
                    databaseReachable = await dbContext.Database.CanConnectAsync(cancellationToken);
                    hasOrganizations = databaseReachable
                        && await dbContext.Organizations.AnyAsync(cancellationToken);
                }
                catch
                {
                    databaseReachable = false;
                    hasOrganizations = false;
                }
            }

            return Results.Ok(new SetupStatusResponse(
                IsConfigured: configuration.Current.IsDatabaseConfigured
                    && configuration.Current.IsJwtConfigured
                    && configuration.Current.IsTwilioConfigured
                    && hasOrganizations,
                DatabaseConfigured: configuration.Current.IsDatabaseConfigured,
                DatabaseReachable: databaseReachable,
                TwilioConfigured: configuration.Current.IsTwilioConfigured,
                JwtConfigured: configuration.Current.IsJwtConfigured,
                HasOrganizations: hasOrganizations));
        })
        .WithName("GetSetupStatus");

        group.MapPost("/bootstrap", async (
            [FromBody] BootstrapSetupRequest request,
            [FromServices] BootstrapConfigurationStore configuration,
            CancellationToken cancellationToken) =>
        {
            var validationError = ValidateBootstrapRequest(request);
            if (validationError is not null)
            {
                return Results.BadRequest(new { message = validationError });
            }

            var connectionString = BootstrapConfigurationBuilder.BuildPostgresConnectionString(request.Database);
            var jwtSecret = string.IsNullOrWhiteSpace(request.JwtSecret)
                ? configuration.Current.JwtSecret
                : request.JwtSecret.Trim();

            if (string.IsNullOrWhiteSpace(jwtSecret))
            {
                return Results.BadRequest(new { message = "JWT secret is required. Set JWT_SECRET or provide one during setup." });
            }

            var snapshot = new RuntimeConfigurationSnapshot
            {
                ConnectionString = connectionString,
                JwtSecret = jwtSecret,
                JwtIssuer = configuration.Current.JwtIssuer,
                JwtAudience = configuration.Current.JwtAudience,
                JwtExpirationHours = configuration.Current.JwtExpirationHours,
                Twilio = request.Twilio
            };

            var dbOptions = new DbContextOptionsBuilder<AlertBlurtyDbContext>()
                .UseNpgsql(connectionString)
                .Options;

            await using var dbContext = new AlertBlurtyDbContext(dbOptions);
            await dbContext.Database.MigrateAsync(cancellationToken);

            await configuration.SaveAsync(snapshot, cancellationToken);

            return Results.Ok(new { message = "Configuration saved and database migrations applied." });
        })
        .WithName("BootstrapSetup");
    }

    private static string? ValidateBootstrapRequest(BootstrapSetupRequest request)
    {
        if (!IsSupportedDatabaseMode(request.Database.Mode))
        {
            return "Database mode must be BundledDocker or ExternalPostgres.";
        }

        if (string.IsNullOrWhiteSpace(request.Database.Server)
            || string.IsNullOrWhiteSpace(request.Database.DatabaseName)
            || string.IsNullOrWhiteSpace(request.Database.Username))
        {
            return "Database server, database name, and username are required.";
        }

        if (request.Database.Port is < 1 or > 65535)
        {
            return "Database port must be between 1 and 65535.";
        }

        if (!Enum.TryParse<SslMode>(request.Database.SslMode, ignoreCase: true, out _))
        {
            return "Database SSL mode is invalid.";
        }

        if (!request.Twilio.IsConfigured)
        {
            return "Twilio account SID, auth token, and phone number are required.";
        }

        return null;
    }

    private static bool IsSupportedDatabaseMode(string mode)
    {
        return string.Equals(mode, "BundledDocker", StringComparison.OrdinalIgnoreCase)
            || string.Equals(mode, "ExternalPostgres", StringComparison.OrdinalIgnoreCase);
    }
}

public sealed class BootstrapSetupRequest
{
    public DatabaseBootstrapOptions Database { get; set; } = new();
    public TwilioBootstrapOptions Twilio { get; set; } = new();
    public string? JwtSecret { get; set; }
}

public sealed record SetupStatusResponse(
    bool IsConfigured,
    bool DatabaseConfigured,
    bool DatabaseReachable,
    bool TwilioConfigured,
    bool JwtConfigured,
    bool HasOrganizations);
