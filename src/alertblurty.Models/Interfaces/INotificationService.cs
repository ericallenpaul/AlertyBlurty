using alertblurty.Models.DTOs;

namespace alertblurty.Models.Interfaces;

public interface INotificationService
{
    Task<bool> SendSmsAsync(string phoneNumber, string message, CancellationToken cancellationToken = default);
    Task<IncidentNotificationDto> CreateNotificationAsync(Guid incidentId, Guid userId, string phoneNumber, string message, CancellationToken cancellationToken = default);
    Task UpdateNotificationStatusAsync(Guid notificationId, NotificationStatus status, string? errorMessage = null, CancellationToken cancellationToken = default);
}
