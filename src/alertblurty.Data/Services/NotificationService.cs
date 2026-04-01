using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Twilio;
using Twilio.Rest.Api.V2010.Account;
using Twilio.Types;
using alertblurty.Models.DTOs;
using alertblurty.Models.Interfaces;

namespace alertblurty.Data.Services;

public class NotificationService : INotificationService
{
    private readonly ILogger<NotificationService> _logger;
    private readonly IConfiguration _configuration;
    private readonly AlertBlurtyDbContext _context;
    private readonly string _twilioAccountSid;
    private readonly string _twilioAuthToken;
    private readonly string _twilioPhoneNumber;

    public NotificationService(
        ILogger<NotificationService> logger,
        IConfiguration configuration,
        AlertBlurtyDbContext context)
    {
        _logger = logger;
        _configuration = configuration;
        _context = context;

        _twilioAccountSid = _configuration["TWILIO_ACCOUNT_SID"]
            ?? _configuration["Twilio:AccountSid"]
            ?? throw new InvalidOperationException("Twilio Account SID not configured");

        _twilioAuthToken = _configuration["TWILIO_AUTH_TOKEN"]
            ?? _configuration["Twilio:AuthToken"]
            ?? throw new InvalidOperationException("Twilio Auth Token not configured");

        _twilioPhoneNumber = _configuration["TWILIO_PHONE_NUMBER"]
            ?? _configuration["Twilio:PhoneNumber"]
            ?? throw new InvalidOperationException("Twilio Phone Number not configured");

        TwilioClient.Init(_twilioAccountSid, _twilioAuthToken);
    }

    public async Task<bool> SendSmsAsync(string phoneNumber, string message, CancellationToken cancellationToken = default)
    {
        try
        {
            var messageResource = await MessageResource.CreateAsync(
                to: new PhoneNumber(phoneNumber),
                from: new PhoneNumber(_twilioPhoneNumber),
                body: message);

            _logger.LogInformation("SMS sent successfully. SID: {MessageSid}, Status: {Status}",
                messageResource.Sid, messageResource.Status);

            return messageResource.Status != MessageResource.StatusEnum.Failed
                && messageResource.Status != MessageResource.StatusEnum.Undelivered;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send SMS to {PhoneNumber}", phoneNumber);
            return false;
        }
    }

    public async Task<IncidentNotificationDto> CreateNotificationAsync(
        Guid incidentId,
        Guid userId,
        string phoneNumber,
        string message,
        CancellationToken cancellationToken = default)
    {
        var notification = new Entities.IncidentNotification
        {
            Id = Guid.NewGuid(),
            IncidentId = incidentId,
            UserId = userId,
            Method = Entities.NotificationMethod.SMS,
            Recipient = phoneNumber,
            Status = Entities.NotificationStatus.Pending,
            SentAtUtc = DateTime.UtcNow,
            TwilioMessageSid = string.Empty,
            AttemptNumber = 1
        };

        _context.IncidentNotifications.Add(notification);
        await _context.SaveChangesAsync(cancellationToken);

        // Try to send the SMS
        var success = await SendSmsAsync(phoneNumber, message, cancellationToken);

        // Update notification status
        notification.Status = success
            ? Entities.NotificationStatus.Sent
            : Entities.NotificationStatus.Failed;

        if (!success)
        {
            notification.ErrorMessage = "Failed to send SMS via Twilio";
        }

        await _context.SaveChangesAsync(cancellationToken);

        return new IncidentNotificationDto
        {
            Id = notification.Id,
            IncidentId = notification.IncidentId,
            UserId = notification.UserId,
            Method = (NotificationMethod)notification.Method,
            Recipient = notification.Recipient,
            Status = (NotificationStatus)notification.Status,
            SentAtUtc = notification.SentAtUtc,
            DeliveredAtUtc = notification.DeliveredAtUtc,
            TwilioMessageSid = notification.TwilioMessageSid,
            ErrorMessage = notification.ErrorMessage,
            AttemptNumber = notification.AttemptNumber,
            CreatedAtUtc = notification.CreatedAtUtc,
            UpdatedAtUtc = notification.UpdatedAtUtc
        };
    }

    public async Task UpdateNotificationStatusAsync(
        Guid notificationId,
        NotificationStatus status,
        string? errorMessage = null,
        CancellationToken cancellationToken = default)
    {
        var notification = await _context.IncidentNotifications.FindAsync(
            new object[] { notificationId }, cancellationToken);

        if (notification == null)
        {
            _logger.LogWarning("Notification {NotificationId} not found", notificationId);
            return;
        }

        notification.Status = (Entities.NotificationStatus)status;
        notification.ErrorMessage = errorMessage;

        if (status == NotificationStatus.Delivered)
        {
            notification.DeliveredAtUtc = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
