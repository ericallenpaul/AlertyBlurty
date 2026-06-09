namespace alertblurty.Models.Interfaces;

public sealed record TwilioRuntimeConfiguration(
    string AccountSid,
    string AuthToken,
    string PhoneNumber)
{
    public bool IsConfigured =>
        !string.IsNullOrWhiteSpace(AccountSid)
        && !string.IsNullOrWhiteSpace(AuthToken)
        && !string.IsNullOrWhiteSpace(PhoneNumber);
}

public interface IAlertBlurtyRuntimeConfiguration
{
    string? ConnectionString { get; }
    string? JwtSecret { get; }
    string JwtIssuer { get; }
    string JwtAudience { get; }
    int JwtExpirationHours { get; }
    TwilioRuntimeConfiguration Twilio { get; }

    string GetRequiredConnectionString();
    string GetRequiredJwtSecret();
}
