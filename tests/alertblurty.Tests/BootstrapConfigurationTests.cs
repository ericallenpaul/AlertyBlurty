using FluentAssertions;
using alertblurty.Api.Configuration;

namespace alertblurty.Tests;

public class BootstrapConfigurationTests
{
    [Fact]
    public void BuildPostgresConnectionString_UsesDatabaseFieldsAndPassword()
    {
        var request = new DatabaseBootstrapOptions
        {
            Server = "postgres",
            Port = 5432,
            DatabaseName = "alertyblurty",
            Username = "alerty_app",
            Password = "app-password"
        };

        var connectionString = BootstrapConfigurationBuilder.BuildPostgresConnectionString(request);

        connectionString.Should().Contain("Host=postgres");
        connectionString.Should().Contain("Port=5432");
        connectionString.Should().Contain("Database=alertyblurty");
        connectionString.Should().Contain("Username=alerty_app");
        connectionString.Should().Contain("Password=app-password");
    }

    [Fact]
    public void FromConfiguration_PrefersConnectionStringEnvironmentVariableAndTwilioSecretAlias()
    {
        var values = new Dictionary<string, string?>
        {
            ["CONNECTION_STRING"] = "Host=db;Database=alertyblurty;Username=alerty_app;Password=from-single-var",
            ["ConnectionStrings:DefaultConnection"] = "Host=ignored;Database=ignored",
            ["TWILIO_ACCOUNT_SID"] = "AC123",
            ["TWILIO_SECRET"] = "twilio-secret-alias",
            ["TWILIO_PHONE_NUMBER"] = "+15555550100",
            ["JWT_SECRET"] = "jwt-secret-with-enough-length-for-tests"
        };

        var snapshot = BootstrapConfigurationBuilder.FromDictionary(values);

        snapshot.ConnectionString.Should().Be(values["CONNECTION_STRING"]);
        snapshot.Twilio.AuthToken.Should().Be("twilio-secret-alias");
        snapshot.IsDatabaseConfigured.Should().BeTrue();
        snapshot.IsTwilioConfigured.Should().BeTrue();
        snapshot.IsJwtConfigured.Should().BeTrue();
    }
}
