using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Npgsql;
using alertblurty.Models.Interfaces;

namespace alertblurty.Api.Configuration;

public sealed class DatabaseBootstrapOptions
{
    public string Mode { get; set; } = "BundledDocker";
    public string Server { get; set; } = string.Empty;
    public int Port { get; set; } = 5432;
    public string DatabaseName { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string SslMode { get; set; } = "Prefer";
}

public sealed class TwilioBootstrapOptions
{
    public string AccountSid { get; set; } = string.Empty;
    public string AuthToken { get; set; } = string.Empty;
    public string PhoneNumber { get; set; } = string.Empty;

    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(AccountSid)
        && !string.IsNullOrWhiteSpace(AuthToken)
        && !string.IsNullOrWhiteSpace(PhoneNumber);
}

public sealed class RuntimeConfigurationSnapshot
{
    public string? ConnectionString { get; init; }
    public string? JwtSecret { get; init; }
    public string JwtIssuer { get; init; } = "AlertyBlurty";
    public string JwtAudience { get; init; } = "AlertyBlurty";
    public int JwtExpirationHours { get; init; } = 24;
    public TwilioBootstrapOptions Twilio { get; init; } = new();

    public bool IsDatabaseConfigured => !string.IsNullOrWhiteSpace(ConnectionString);
    public bool IsJwtConfigured => !string.IsNullOrWhiteSpace(JwtSecret);
    public bool IsTwilioConfigured => Twilio.IsConfigured;
}

public static class BootstrapConfigurationBuilder
{
    public static RuntimeConfigurationSnapshot FromConfiguration(IConfiguration configuration)
    {
        return new RuntimeConfigurationSnapshot
        {
            ConnectionString = FirstNonEmpty(
                configuration["CONNECTION_STRING"],
                configuration.GetConnectionString("DefaultConnection")),
            JwtSecret = FirstNonEmpty(configuration["JWT_SECRET"], configuration["JwtSettings:Secret"]),
            JwtIssuer = FirstNonEmpty(configuration["JwtSettings:Issuer"], "AlertyBlurty")!,
            JwtAudience = FirstNonEmpty(configuration["JwtSettings:Audience"], "AlertyBlurty")!,
            JwtExpirationHours = ReadExpirationHours(configuration["JwtSettings:ExpirationHours"]),
            Twilio = new TwilioBootstrapOptions
            {
                AccountSid = FirstNonEmpty(configuration["TWILIO_ACCOUNT_SID"], configuration["Twilio:AccountSid"]) ?? string.Empty,
                AuthToken = FirstNonEmpty(
                    configuration["TWILIO_SECRET"],
                    configuration["TWILIO_AUTH_TOKEN"],
                    configuration["Twilio:AuthToken"]) ?? string.Empty,
                PhoneNumber = FirstNonEmpty(configuration["TWILIO_PHONE_NUMBER"], configuration["Twilio:PhoneNumber"]) ?? string.Empty
            }
        };
    }

    public static RuntimeConfigurationSnapshot FromDictionary(IDictionary<string, string?> values)
    {
        var configuration = new ConfigurationBuilder()
            .AddInMemoryCollection(values)
            .Build();

        return FromConfiguration(configuration);
    }

    public static string BuildPostgresConnectionString(DatabaseBootstrapOptions options)
    {
        var sslMode = Enum.TryParse<SslMode>(options.SslMode, ignoreCase: true, out var parsedSslMode)
            ? parsedSslMode
            : SslMode.Prefer;

        var builder = new NpgsqlConnectionStringBuilder
        {
            Host = Require(options.Server, nameof(options.Server)),
            Port = options.Port,
            Database = Require(options.DatabaseName, nameof(options.DatabaseName)),
            Username = Require(options.Username, nameof(options.Username)),
            Password = options.Password,
            Pooling = true,
            SslMode = sslMode
        };

        return builder.ConnectionString;
    }

    private static int ReadExpirationHours(string? value)
    {
        return int.TryParse(value, out var parsed) && parsed > 0 ? parsed : 24;
    }

    private static string Require(string value, string fieldName)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new ArgumentException($"{fieldName} is required", fieldName);
        }

        return value.Trim();
    }

    private static string? FirstNonEmpty(params string?[] values)
    {
        return values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));
    }
}

public sealed class BootstrapConfigurationStore : IAlertBlurtyRuntimeConfiguration
{
    private readonly string _localConfigurationPath;
    private RuntimeConfigurationSnapshot _current;

    public BootstrapConfigurationStore(IConfiguration configuration, IWebHostEnvironment environment)
    {
        _localConfigurationPath = configuration["ALERTYBLURTY_CONFIG_PATH"]
            ?? Path.Combine(environment.ContentRootPath, "data", "appsettings.Local.json");
        _current = BootstrapConfigurationBuilder.FromConfiguration(configuration);
    }

    public RuntimeConfigurationSnapshot Current => _current;

    public string LocalConfigurationPath => _localConfigurationPath;

    public string? ConnectionString => Current.ConnectionString;

    public string? JwtSecret => Current.JwtSecret;

    public string JwtIssuer => Current.JwtIssuer;

    public string JwtAudience => Current.JwtAudience;

    public int JwtExpirationHours => Current.JwtExpirationHours;

    public TwilioRuntimeConfiguration Twilio => new(
        Current.Twilio.AccountSid,
        Current.Twilio.AuthToken,
        Current.Twilio.PhoneNumber);

    public string GetRequiredConnectionString()
    {
        return Current.ConnectionString
            ?? throw new InvalidOperationException("Database connection is not configured. Complete first-run setup or set CONNECTION_STRING.");
    }

    public string GetRequiredJwtSecret()
    {
        return Current.JwtSecret
            ?? throw new InvalidOperationException("JWT secret is not configured. Set JWT_SECRET before issuing tokens.");
    }

    public async Task SaveAsync(RuntimeConfigurationSnapshot snapshot, CancellationToken cancellationToken = default)
    {
        var directory = Path.GetDirectoryName(_localConfigurationPath);
        if (!string.IsNullOrWhiteSpace(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var document = new
        {
            ConnectionStrings = new
            {
                DefaultConnection = snapshot.ConnectionString
            },
            JwtSettings = new
            {
                Secret = snapshot.JwtSecret,
                Issuer = snapshot.JwtIssuer,
                Audience = snapshot.JwtAudience,
                ExpirationHours = snapshot.JwtExpirationHours
            },
            Twilio = new
            {
                snapshot.Twilio.AccountSid,
                snapshot.Twilio.AuthToken,
                snapshot.Twilio.PhoneNumber
            }
        };

        await using var stream = File.Create(_localConfigurationPath);
        await JsonSerializer.SerializeAsync(
            stream,
            document,
            new JsonSerializerOptions { WriteIndented = true },
            cancellationToken);

        _current = snapshot;
    }
}
