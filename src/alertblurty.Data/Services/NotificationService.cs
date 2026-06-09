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
    private readonly IAlertBlurtyRuntimeConfiguration _configuration;
    private readonly AlertBlurtyDbContext _context;

    public NotificationService(
        ILogger<NotificationService> logger,
        IAlertBlurtyRuntimeConfiguration configuration,
        AlertBlurtyDbContext context)
    {
        _logger = logger;
        _configuration = configuration;
        _context = context;
    }

    public async Task<bool> SendSmsAsync(string phoneNumber, string message, CancellationToken cancellationToken = default)
    {
        try
        {
            if (!_configuration.Twilio.IsConfigured)
            {
                _logger.LogWarning("Twilio is not configured. SMS to {PhoneNumber} was not sent.", phoneNumber);
                return false;
            }

            TwilioClient.Init(_configuration.Twilio.AccountSid, _configuration.Twilio.AuthToken);

            var messageResource = await MessageResource.CreateAsync(
                to: new PhoneNumber(phoneNumber),
                from: new PhoneNumber(_configuration.Twilio.PhoneNumber),
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
