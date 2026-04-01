# alertblurty v1 Implementation Plan

**Project**: alertblurty - Single-Tenant On-Call Alert Router for Zabbix 7.4
**Branch**: master
**Date**: 2025-10-13
**Mode**: PLAN
**Status**: Ready for Review & Approval (Updated)
**Revision**: Git operations moved to Phase 10

---

## Executive Summary

This plan details the complete implementation of **alertblurty v1**, a self-hosted on-call alert router that receives webhooks from Zabbix 7.4, groups related incidents by {host, trigger}, notifies on-call users via Twilio SMS, and provides bidirectional acknowledgment with Zabbix via API. The system includes role-based access control (superadmin, admin, user), on-call scheduling with swap functionality, immutable audit logging, and a Blazor web UI.

**Architecture**: Layered C#/.NET 8 application with PostgreSQL backend
**Deployment Target**: Docker (AWS ECR) + Kubernetes/Helm + self-hosted scripts
**Development Standards**: Eric Paul's standardized patterns (Data → Models → API/Console)

---

## Table of Contents

1. [Phase 1: Project Initialization & Structure](#phase-1-project-initialization--structure)
2. [Phase 2: Database Layer Implementation](#phase-2-database-layer-implementation)
3. [Phase 3: Models & DTOs Layer](#phase-3-models--dtos-layer)
4. [Phase 4: Core Services Implementation](#phase-4-core-services-implementation)
5. [Phase 5: API Layer & Webhooks](#phase-5-api-layer--webhooks)
6. [Phase 6: Blazor Web UI](#phase-6-blazor-web-ui)
7. [Phase 7: Setup Wizard](#phase-7-setup-wizard)
8. [Phase 8: Containerization & Deployment](#phase-8-containerization--deployment)
9. [Phase 9: Testing & Validation](#phase-9-testing--validation)
10. [Phase 10: Documentation & Delivery](#phase-10-documentation--delivery)

---

## Phase 1: Project Initialization & Structure

### 1.1 Git Repository Preparation

**Substep 1.1.1**: Create `.gitignore` for .NET Standard
- Download/generate standard .NET gitignore from GitHub
- Add custom entries:
  ```
  logs/
  appsettings.Development.json
  appsettings.Local.json
  *.user
  .vs/
  bin/
  obj/
  ```
- **Note**: Do NOT commit yet - git operations will be done later in Phase 10

**Substep 1.1.2**: Create README.md
- Project name and description
- Quick start instructions
- Link to documentation
- License information (if applicable)
- **Note**: Do NOT commit yet - git operations will be done later in Phase 10

### 1.2 Solution & Project Structure Creation

**Substep 1.2.1**: Create Solution File
```bash
dotnet new sln -n alertblurty
```

**Substep 1.2.2**: Create `src/alertblurty.Data` Project
```bash
mkdir -p src/alertblurty.Data
cd src/alertblurty.Data
dotnet new classlib -f net8.0
cd ../..
dotnet sln add src/alertblurty.Data/alertblurty.Data.csproj
```

**Dependencies**:
- `Npgsql.EntityFrameworkCore.PostgreSQL` (latest stable for .NET 8)
- `Microsoft.EntityFrameworkCore.Design`
- `NLog.Extensions.Logging`
- `Polly`

**Substep 1.2.3**: Create `src/alertblurty.Models` Project
```bash
mkdir -p src/alertblurty.Models
cd src/alertblurty.Models
dotnet new classlib -f net8.0
cd ../..
dotnet sln add src/alertblurty.Models/alertblurty.Models.csproj
```

**Dependencies**: None (pure DTOs and interfaces)

**Substep 1.2.4**: Create `src/alertblurty.Api` Project
```bash
mkdir -p src/alertblurty.Api
cd src/alertblurty.Api
dotnet new webapi -f net8.0
cd ../..
dotnet sln add src/alertblurty.Api/alertblurty.Api.csproj
```

**Dependencies**:
- Project references: `alertblurty.Data`, `alertblurty.Models`
- `NLog.Web.AspNetCore`
- `Polly`
- `Twilio` (official SDK)
- `Microsoft.AspNetCore.Authentication.JwtBearer`

**Substep 1.2.5**: Create `tests/alertblurty.Tests` Project
```bash
mkdir -p tests/alertblurty.Tests
cd tests/alertblurty.Tests
dotnet new xunit -f net8.0
cd ../..
dotnet sln add tests/alertblurty.Tests/alertblurty.Tests.csproj
```

**Dependencies**:
- Project references: All `src/` projects
- `Moq`
- `FluentAssertions`
- `Microsoft.AspNetCore.Mvc.Testing`
- `Testcontainers` (for PostgreSQL integration tests)

**Substep 1.2.6**: Create Additional Directories
```bash
mkdir -p docs
mkdir -p docker
mkdir -p scripts
mkdir -p logs
```

**Substep 1.2.7**: Verify Build
```bash
dotnet build
dotnet test
```

### 1.3 NLog Configuration

**Substep 1.3.1**: Create `src/alertblurty.Api/nlog.config`
```xml
<?xml version="1.0" encoding="utf-8" ?>
<nlog xmlns="http://www.nlog-project.org/schemas/NLog.xsd"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      autoReload="true"
      internalLogLevel="Info"
      internalLogFile="logs/internal-nlog.txt">

  <targets>
    <!-- Rolling file target with 7-day retention -->
    <target xsi:type="File" name="allfile"
            fileName="logs/alertblurty-${shortdate}.log"
            layout="${longdate}|${event-properties:item=EventId:whenEmpty=0}|${level:uppercase=true}|${logger}|${message} ${exception:format=tostring}"
            archiveEvery="Day"
            archiveNumbering="Date"
            archiveDateFormat="yyyyMMdd"
            maxArchiveFiles="7" />

    <!-- Console target for development -->
    <target xsi:type="Console" name="console"
            layout="${longdate}|${level:uppercase=true}|${logger}|${message} ${exception:format=tostring}" />
  </targets>

  <rules>
    <logger name="*" minlevel="Info" writeTo="allfile" />
    <logger name="*" minlevel="Info" writeTo="console" />
  </rules>
</nlog>
```

**Substep 1.3.2**: Configure NLog in `Program.cs`
- Add `builder.Logging.ClearProviders();`
- Add `builder.Logging.AddNLog();`

### 1.4 Environment Configuration

**Substep 1.4.1**: Create `src/alertblurty.Api/appsettings.json` (minimal)
```json
{
  "Logging": {
    "LogLevel": {
      "Default": "Information",
      "Microsoft.AspNetCore": "Warning"
    }
  },
  "AllowedHosts": "*"
}
```

**Substep 1.4.2**: Create `src/alertblurty.Api/appsettings.Development.json`
```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Port=5432;Database=alertblurty_dev;Username=postgres;Password=postgres"
  },
  "Logging": {
    "LogLevel": {
      "Default": "Debug"
    }
  }
}
```

**Substep 1.4.3**: Document Environment Variables
Create `docs/environment-variables.md` listing:
- `DATABASE_CONNECTION_STRING`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`
- `ZABBIX_API_URL`
- `ZABBIX_API_TOKEN`
- `JWT_SECRET_KEY`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `WEBHOOK_IP_ALLOWLIST` (comma-separated)
- `AUDIT_LOG_RETENTION_DAYS`

---

## Phase 2: Database Layer Implementation

### 2.1 Entity Models

**Substep 2.1.1**: Create `src/alertblurty.Data/Entities/BaseEntity.cs`
```csharp
public abstract class BaseEntity
{
    public Guid Id { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}
```

**Substep 2.1.2**: Create `src/alertblurty.Data/Entities/Organization.cs`
```csharp
public class Organization : BaseEntity
{
    public string Name { get; set; }
    public string DefaultTimezone { get; set; } = "UTC";
    public bool IsSetupComplete { get; set; } = false;

    // Navigation
    public ICollection<User> Users { get; set; }
    public ICollection<Team> Teams { get; set; }
}
```

**Substep 2.1.3**: Create `src/alertblurty.Data/Entities/User.cs`
```csharp
public class User : BaseEntity
{
    public Guid OrganizationId { get; set; }
    public string Email { get; set; }
    public string PasswordHash { get; set; }
    public string FullName { get; set; }
    public string PhoneNumber { get; set; }
    public string Timezone { get; set; } = "UTC";
    public UserRole Role { get; set; } = UserRole.User;
    public bool IsActive { get; set; } = true;

    // Navigation
    public Organization Organization { get; set; }
    public ICollection<TeamMember> TeamMemberships { get; set; }
    public ICollection<IncidentAcknowledgment> Acknowledgments { get; set; }
}

public enum UserRole
{
    User = 0,
    Admin = 1,
    SuperAdmin = 2
}
```

**Substep 2.1.4**: Create `src/alertblurty.Data/Entities/Team.cs`
```csharp
public class Team : BaseEntity
{
    public Guid OrganizationId { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public bool RequireAdminApprovalForSwaps { get; set; } = false;

    // Navigation
    public Organization Organization { get; set; }
    public ICollection<TeamMember> Members { get; set; }
    public ICollection<OnCallSchedule> Schedules { get; set; }
}
```

**Substep 2.1.5**: Create `src/alertblurty.Data/Entities/TeamMember.cs`
```csharp
public class TeamMember : BaseEntity
{
    public Guid TeamId { get; set; }
    public Guid UserId { get; set; }
    public int RotationOrder { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public Team Team { get; set; }
    public User User { get; set; }
}
```

**Substep 2.1.6**: Create `src/alertblurty.Data/Entities/OnCallSchedule.cs`
```csharp
public class OnCallSchedule : BaseEntity
{
    public Guid TeamId { get; set; }
    public string Name { get; set; }
    public ScheduleFrequency Frequency { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public int DurationMinutes { get; set; }
    public bool IsActive { get; set; } = true;

    // Navigation
    public Team Team { get; set; }
    public ICollection<OnCallShift> Shifts { get; set; }
}

public enum ScheduleFrequency
{
    Hourly = 0,
    Daily = 1,
    Weekly = 2,
    Monthly = 3
}
```

**Substep 2.1.7**: Create `src/alertblurty.Data/Entities/OnCallShift.cs`
```csharp
public class OnCallShift : BaseEntity
{
    public Guid ScheduleId { get; set; }
    public Guid UserId { get; set; }
    public DateTime StartTimeUtc { get; set; }
    public DateTime EndTimeUtc { get; set; }
    public bool IsSwapped { get; set; } = false;
    public Guid? SwappedWithUserId { get; set; }
    public Guid? ApprovedByUserId { get; set; }

    // Navigation
    public OnCallSchedule Schedule { get; set; }
    public User User { get; set; }
    public User SwappedWithUser { get; set; }
    public User ApprovedByUser { get; set; }
}
```

**Substep 2.1.8**: Create `src/alertblurty.Data/Entities/Incident.cs`
```csharp
public class Incident : BaseEntity
{
    public Guid TeamId { get; set; }
    public string ZabbixEventId { get; set; }
    public string ZabbixTriggerId { get; set; }
    public string HostName { get; set; }
    public string TriggerName { get; set; }
    public string TriggerDescription { get; set; }
    public int Severity { get; set; }
    public DateTime FirstOccurrenceUtc { get; set; }
    public DateTime LastOccurrenceUtc { get; set; }
    public int EventCount { get; set; } = 1;
    public IncidentStatus Status { get; set; } = IncidentStatus.Open;
    public Guid? AcknowledgedByUserId { get; set; }
    public DateTime? AcknowledgedAtUtc { get; set; }

    // Navigation
    public Team Team { get; set; }
    public User AcknowledgedByUser { get; set; }
    public ICollection<IncidentNotification> Notifications { get; set; }
    public ICollection<IncidentAcknowledgment> Acknowledgments { get; set; }
}

public enum IncidentStatus
{
    Open = 0,
    Acknowledged = 1,
    Resolved = 2
}
```

**Substep 2.1.9**: Create `src/alertblurty.Data/Entities/IncidentNotification.cs`
```csharp
public class IncidentNotification : BaseEntity
{
    public Guid IncidentId { get; set; }
    public Guid UserId { get; set; }
    public NotificationMethod Method { get; set; }
    public string Recipient { get; set; } // Phone number for SMS
    public NotificationStatus Status { get; set; }
    public DateTime SentAtUtc { get; set; }
    public DateTime? DeliveredAtUtc { get; set; }
    public string TwilioMessageSid { get; set; }
    public string ErrorMessage { get; set; }
    public int AttemptNumber { get; set; } = 1;

    // Navigation
    public Incident Incident { get; set; }
    public User User { get; set; }
}

public enum NotificationMethod
{
    SMS = 0,
    // Future: Email, Voice, Push, etc.
}

public enum NotificationStatus
{
    Pending = 0,
    Sent = 1,
    Delivered = 2,
    Failed = 3
}
```

**Substep 2.1.10**: Create `src/alertblurty.Data/Entities/IncidentAcknowledgment.cs`
```csharp
public class IncidentAcknowledgment : BaseEntity
{
    public Guid IncidentId { get; set; }
    public Guid UserId { get; set; }
    public DateTime AcknowledgedAtUtc { get; set; }
    public bool ZabbixAckSuccess { get; set; }
    public string ZabbixAckResponse { get; set; }

    // Navigation
    public Incident Incident { get; set; }
    public User User { get; set; }
}
```

**Substep 2.1.11**: Create `src/alertblurty.Data/Entities/AuditLog.cs`
```csharp
public class AuditLog : BaseEntity
{
    public Guid? UserId { get; set; }
    public string Action { get; set; }
    public string EntityType { get; set; }
    public Guid? EntityId { get; set; }
    public string Details { get; set; } // JSON
    public string IpAddress { get; set; }
    public string UserAgent { get; set; }

    // Navigation
    public User User { get; set; }
}
```

**Substep 2.1.12**: Create `src/alertblurty.Data/Entities/SystemConfiguration.cs`
```csharp
public class SystemConfiguration : BaseEntity
{
    public string Key { get; set; }
    public string Value { get; set; }
    public string Description { get; set; }
    public bool IsEncrypted { get; set; } = false;
}
```

### 2.2 DbContext Configuration

**Substep 2.2.1**: Create `src/alertblurty.Data/AlertBlurtyDbContext.cs`
```csharp
public class AlertBlurtyDbContext : DbContext
{
    public AlertBlurtyDbContext(DbContextOptions<AlertBlurtyDbContext> options)
        : base(options)
    {
    }

    public DbSet<Organization> Organizations { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<Team> Teams { get; set; }
    public DbSet<TeamMember> TeamMembers { get; set; }
    public DbSet<OnCallSchedule> OnCallSchedules { get; set; }
    public DbSet<OnCallShift> OnCallShifts { get; set; }
    public DbSet<Incident> Incidents { get; set; }
    public DbSet<IncidentNotification> IncidentNotifications { get; set; }
    public DbSet<IncidentAcknowledgment> IncidentAcknowledgments { get; set; }
    public DbSet<AuditLog> AuditLogs { get; set; }
    public DbSet<SystemConfiguration> SystemConfigurations { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Apply all entity configurations
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(AlertBlurtyDbContext).Assembly);

        // Set default schema
        modelBuilder.HasDefaultSchema("public");
    }

    public override int SaveChanges()
    {
        SetTimestamps();
        return base.SaveChanges();
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        SetTimestamps();
        return base.SaveChangesAsync(cancellationToken);
    }

    private void SetTimestamps()
    {
        var entries = ChangeTracker.Entries()
            .Where(e => e.Entity is BaseEntity &&
                       (e.State == EntityState.Added || e.State == EntityState.Modified));

        foreach (var entry in entries)
        {
            var entity = (BaseEntity)entry.Entity;

            if (entry.State == EntityState.Added)
            {
                entity.CreatedAtUtc = DateTime.UtcNow;
            }
            else if (entry.State == EntityState.Modified)
            {
                entity.UpdatedAtUtc = DateTime.UtcNow;
            }
        }
    }
}
```

**Substep 2.2.2**: Create Entity Type Configurations

Create `src/alertblurty.Data/Configurations/` directory with individual configuration classes:

- `OrganizationConfiguration.cs`
- `UserConfiguration.cs`
- `TeamConfiguration.cs`
- `TeamMemberConfiguration.cs`
- `OnCallScheduleConfiguration.cs`
- `OnCallShiftConfiguration.cs`
- `IncidentConfiguration.cs`
- `IncidentNotificationConfiguration.cs`
- `IncidentAcknowledgmentConfiguration.cs`
- `AuditLogConfiguration.cs`
- `SystemConfigurationConfiguration.cs`

Each configuration should:
- Set table names
- Configure primary keys
- Define required fields and max lengths
- Set up foreign key relationships
- Add appropriate indexes
- Configure cascade delete behaviors

**Example: `IncidentConfiguration.cs`**
```csharp
public class IncidentConfiguration : IEntityTypeConfiguration<Incident>
{
    public void Configure(EntityTypeBuilder<Incident> builder)
    {
        builder.ToTable("incidents");

        builder.HasKey(i => i.Id);

        builder.Property(i => i.ZabbixEventId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(i => i.ZabbixTriggerId)
            .IsRequired()
            .HasMaxLength(100);

        builder.Property(i => i.HostName)
            .IsRequired()
            .HasMaxLength(255);

        builder.Property(i => i.TriggerName)
            .IsRequired()
            .HasMaxLength(500);

        builder.Property(i => i.TriggerDescription)
            .HasMaxLength(2000);

        builder.HasIndex(i => new { i.HostName, i.ZabbixTriggerId, i.Status })
            .HasDatabaseName("ix_incidents_grouping");

        builder.HasIndex(i => i.ZabbixEventId)
            .HasDatabaseName("ix_incidents_zabbix_event_id");

        builder.HasOne(i => i.Team)
            .WithMany()
            .HasForeignKey(i => i.TeamId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(i => i.AcknowledgedByUser)
            .WithMany()
            .HasForeignKey(i => i.AcknowledgedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
```

### 2.3 Migrations Setup

**Substep 2.3.1**: Add EF Core Tools
```bash
dotnet tool install --global dotnet-ef
```

**Substep 2.3.2**: Create Initial Migration
```bash
cd src/alertblurty.Data
dotnet ef migrations add InitialCreate --startup-project ../alertblurty.Api
cd ../..
```

**Substep 2.3.3**: Create Database Update Script
Create `scripts/update-database.sh`:
```bash
#!/bin/bash
cd src/alertblurty.Api
dotnet ef database update --project ../alertblurty.Data
```

**Substep 2.3.4**: Document Migration Process
Create `docs/database-migrations.md` with instructions for:
- Creating new migrations
- Applying migrations
- Rolling back migrations
- Production migration strategy

---

## Phase 3: Models & DTOs Layer

### 3.1 Request/Response DTOs

**Substep 3.1.1**: Create `src/alertblurty.Models/DTOs/Auth/` directory
- `LoginRequest.cs`
- `LoginResponse.cs`
- `RegisterUserRequest.cs`
- `ChangePasswordRequest.cs`
- `UserDto.cs`

**Substep 3.1.2**: Create `src/alertblurty.Models/DTOs/Incidents/` directory
- `IncidentDto.cs`
- `IncidentListDto.cs`
- `AcknowledgeIncidentRequest.cs`
- `IncidentNotificationDto.cs`

**Substep 3.1.3**: Create `src/alertblurty.Models/DTOs/OnCall/` directory
- `OnCallScheduleDto.cs`
- `CreateScheduleRequest.cs`
- `OnCallShiftDto.cs`
- `SwapShiftRequest.cs`
- `ApproveSwapRequest.cs`
- `CurrentOnCallDto.cs`

**Substep 3.1.4**: Create `src/alertblurty.Models/DTOs/Teams/` directory
- `TeamDto.cs`
- `CreateTeamRequest.cs`
- `UpdateTeamRequest.cs`
- `TeamMemberDto.cs`
- `AddTeamMemberRequest.cs`

**Substep 3.1.5**: Create `src/alertblurty.Models/DTOs/Webhooks/` directory
- `ZabbixWebhookPayload.cs`
- `ZabbixEventData.cs`
- `WebhookValidationResult.cs`

**Substep 3.1.6**: Create `src/alertblurty.Models/DTOs/Setup/` directory
- `FirstRunSetupRequest.cs`
- `SetupStatusDto.cs`
- `ValidateZabbixRequest.cs`
- `ValidateTwilioRequest.cs`

### 3.2 Service Interfaces

**Substep 3.2.1**: Create `src/alertblurty.Models/Interfaces/IAuthService.cs`
```csharp
public interface IAuthService
{
    Task<LoginResponse> LoginAsync(LoginRequest request);
    Task<UserDto> RegisterUserAsync(RegisterUserRequest request);
    Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest request);
    Task<bool> ValidateTokenAsync(string token);
    Task<UserDto> GetCurrentUserAsync(string token);
}
```

**Substep 3.2.2**: Create `src/alertblurty.Models/Interfaces/IIncidentService.cs`
```csharp
public interface IIncidentService
{
    Task<IncidentDto> CreateOrUpdateIncidentAsync(ZabbixWebhookPayload payload);
    Task<IncidentDto> GetIncidentByIdAsync(Guid incidentId);
    Task<List<IncidentListDto>> GetIncidentsForUserAsync(Guid userId, IncidentStatus? status = null);
    Task<List<IncidentListDto>> GetIncidentsForTeamAsync(Guid teamId, IncidentStatus? status = null);
    Task<bool> AcknowledgeIncidentAsync(Guid incidentId, Guid userId);
    Task<int> GetOpenIncidentCountAsync(Guid? teamId = null);
}
```

**Substep 3.2.3**: Create `src/alertblurty.Models/Interfaces/INotificationService.cs`
```csharp
public interface INotificationService
{
    Task<bool> SendIncidentNotificationAsync(Guid incidentId, Guid userId);
    Task<List<IncidentNotificationDto>> GetNotificationHistoryAsync(Guid incidentId);
    Task ProcessDeliveryStatusAsync(string twilioMessageSid, string status);
}
```

**Substep 3.2.4**: Create `src/alertblurty.Models/Interfaces/IOnCallService.cs`
```csharp
public interface IOnCallService
{
    Task<OnCallScheduleDto> CreateScheduleAsync(CreateScheduleRequest request);
    Task<OnCallScheduleDto> UpdateScheduleAsync(Guid scheduleId, CreateScheduleRequest request);
    Task<bool> DeleteScheduleAsync(Guid scheduleId);
    Task<List<OnCallScheduleDto>> GetSchedulesForTeamAsync(Guid teamId);
    Task<CurrentOnCallDto> GetCurrentOnCallUserAsync(Guid teamId);
    Task<List<OnCallShiftDto>> GetUpcomingShiftsAsync(Guid teamId, int daysAhead = 7);
    Task<bool> RequestSwapAsync(SwapShiftRequest request);
    Task<bool> ApproveSwapAsync(ApproveSwapRequest request);
}
```

**Substep 3.2.5**: Create `src/alertblurty.Models/Interfaces/ITeamService.cs`
```csharp
public interface ITeamService
{
    Task<TeamDto> CreateTeamAsync(CreateTeamRequest request);
    Task<TeamDto> UpdateTeamAsync(Guid teamId, UpdateTeamRequest request);
    Task<bool> DeleteTeamAsync(Guid teamId);
    Task<TeamDto> GetTeamByIdAsync(Guid teamId);
    Task<List<TeamDto>> GetTeamsForOrganizationAsync(Guid organizationId);
    Task<List<TeamDto>> GetTeamsForUserAsync(Guid userId);
    Task<bool> AddMemberAsync(Guid teamId, AddTeamMemberRequest request);
    Task<bool> RemoveMemberAsync(Guid teamId, Guid userId);
    Task<bool> UpdateMemberRotationOrderAsync(Guid teamId, Dictionary<Guid, int> memberOrders);
}
```

**Substep 3.2.6**: Create `src/alertblurty.Models/Interfaces/IZabbixService.cs`
```csharp
public interface IZabbixService
{
    Task<bool> AcknowledgeEventAsync(string eventId, string message);
    Task<bool> ValidateConnectionAsync(string apiUrl, string apiToken);
    Task<string> GetZabbixVersionAsync();
}
```

**Substep 3.2.7**: Create `src/alertblurty.Models/Interfaces/ITwilioService.cs`
```csharp
public interface ITwilioService
{
    Task<(bool success, string messageSid)> SendSmsAsync(string toPhoneNumber, string message);
    Task<bool> ValidateCredentialsAsync(string accountSid, string authToken, string fromNumber);
}
```

**Substep 3.2.8**: Create `src/alertblurty.Models/Interfaces/IAuditService.cs`
```csharp
public interface IAuditService
{
    Task LogAsync(Guid? userId, string action, string entityType, Guid? entityId, object details, string ipAddress = null, string userAgent = null);
    Task<List<AuditLog>> GetAuditLogsAsync(DateTime? fromDate = null, DateTime? toDate = null, Guid? userId = null, string entityType = null);
    Task CleanupOldLogsAsync(int retentionDays);
}
```

**Substep 3.2.9**: Create `src/alertblurty.Models/Interfaces/ISetupService.cs`
```csharp
public interface ISetupService
{
    Task<bool> IsSetupCompleteAsync();
    Task<SetupStatusDto> GetSetupStatusAsync();
    Task<bool> CompleteFirstRunSetupAsync(FirstRunSetupRequest request);
}
```

### 3.3 Configuration Models

**Substep 3.3.1**: Create `src/alertblurty.Models/Configuration/` directory
- `TwilioSettings.cs`
- `ZabbixSettings.cs`
- `JwtSettings.cs`
- `SecuritySettings.cs`
- `AuditSettings.cs`

**Example: `TwilioSettings.cs`**
```csharp
public class TwilioSettings
{
    public string AccountSid { get; set; }
    public string AuthToken { get; set; }
    public string FromNumber { get; set; }
    public int MaxRetryAttempts { get; set; } = 5;
    public int RetryDelaySeconds { get; set; } = 10;
}
```

---

## Phase 4: Core Services Implementation

### 4.1 Polly Retry Policies

**Substep 4.1.1**: Create `src/alertblurty.Data/Services/Helpers/RetryPolicies.cs`
```csharp
public static class RetryPolicies
{
    public static AsyncRetryPolicy GetTwilioRetryPolicy(ILogger logger)
    {
        return Policy
            .Handle<HttpRequestException>()
            .Or<TaskCanceledException>()
            .WaitAndRetryAsync(
                retryCount: 5,
                sleepDurationProvider: attempt => TimeSpan.FromSeconds(Math.Pow(2, attempt)),
                onRetry: (exception, timeSpan, retryCount, context) =>
                {
                    logger.LogWarning(
                        exception,
                        "Twilio API call failed. Retry {RetryCount} after {RetryDelay}s",
                        retryCount,
                        timeSpan.TotalSeconds);
                });
    }

    public static AsyncRetryPolicy GetZabbixRetryPolicy(ILogger logger)
    {
        return Policy
            .Handle<HttpRequestException>()
            .Or<TaskCanceledException>()
            .WaitAndRetryAsync(
                retryCount: 3,
                sleepDurationProvider: attempt => TimeSpan.FromSeconds(attempt * 2),
                onRetry: (exception, timeSpan, retryCount, context) =>
                {
                    logger.LogWarning(
                        exception,
                        "Zabbix API call failed. Retry {RetryCount} after {RetryDelay}s",
                        retryCount,
                        timeSpan.TotalSeconds);
                });
    }
}
```

### 4.2 Twilio Service Implementation

**Substep 4.2.1**: Create `src/alertblurty.Data/Services/TwilioService.cs`
```csharp
public class TwilioService : ITwilioService
{
    private readonly ILogger<TwilioService> _logger;
    private readonly TwilioSettings _settings;
    private readonly AsyncRetryPolicy _retryPolicy;

    public TwilioService(
        ILogger<TwilioService> logger,
        IOptions<TwilioSettings> settings)
    {
        _logger = logger;
        _settings = settings.Value;
        _retryPolicy = RetryPolicies.GetTwilioRetryPolicy(_logger);

        // Initialize Twilio client
        TwilioClient.Init(_settings.AccountSid, _settings.AuthToken);
    }

    public async Task<(bool success, string messageSid)> SendSmsAsync(string toPhoneNumber, string message)
    {
        _logger.LogInformation("Attempting to send SMS to {PhoneNumber}", toPhoneNumber);

        try
        {
            var result = await _retryPolicy.ExecuteAsync(async () =>
            {
                var messageResource = await MessageResource.CreateAsync(
                    to: new PhoneNumber(toPhoneNumber),
                    from: new PhoneNumber(_settings.FromNumber),
                    body: message);

                return messageResource;
            });

            _logger.LogInformation(
                "SMS sent successfully. SID: {MessageSid}, Status: {Status}",
                result.Sid,
                result.Status);

            return (true, result.Sid);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send SMS to {PhoneNumber} after all retries", toPhoneNumber);
            return (false, null);
        }
    }

    public async Task<bool> ValidateCredentialsAsync(string accountSid, string authToken, string fromNumber)
    {
        _logger.LogInformation("Validating Twilio credentials");

        try
        {
            TwilioClient.Init(accountSid, authToken);

            var account = await AccountResource.FetchAsync();

            _logger.LogInformation("Twilio credentials validated. Account: {AccountSid}", account.Sid);
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Twilio credential validation failed");
            return false;
        }
    }
}
```

### 4.3 Zabbix Service Implementation

**Substep 4.3.1**: Create `src/alertblurty.Data/Services/ZabbixService.cs`
```csharp
public class ZabbixService : IZabbixService
{
    private readonly ILogger<ZabbixService> _logger;
    private readonly ZabbixSettings _settings;
    private readonly HttpClient _httpClient;
    private readonly AsyncRetryPolicy _retryPolicy;

    public ZabbixService(
        ILogger<ZabbixService> logger,
        IOptions<ZabbixSettings> settings,
        HttpClient httpClient)
    {
        _logger = logger;
        _settings = settings.Value;
        _httpClient = httpClient;
        _retryPolicy = RetryPolicies.GetZabbixRetryPolicy(_logger);
    }

    public async Task<bool> AcknowledgeEventAsync(string eventId, string message)
    {
        _logger.LogInformation("Acknowledging Zabbix event {EventId}", eventId);

        try
        {
            var result = await _retryPolicy.ExecuteAsync(async () =>
            {
                var requestPayload = new
                {
                    jsonrpc = "2.0",
                    method = "event.acknowledge",
                    @params = new
                    {
                        eventids = new[] { eventId },
                        message = message,
                        action = 6 // Acknowledge + close
                    },
                    auth = _settings.ApiToken,
                    id = 1
                };

                var response = await _httpClient.PostAsJsonAsync(_settings.ApiUrl, requestPayload);
                response.EnsureSuccessStatusCode();

                var responseContent = await response.Content.ReadAsStringAsync();
                _logger.LogDebug("Zabbix acknowledge response: {Response}", responseContent);

                return true;
            });

            _logger.LogInformation("Successfully acknowledged Zabbix event {EventId}", eventId);
            return result;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to acknowledge Zabbix event {EventId}", eventId);
            return false;
        }
    }

    public async Task<bool> ValidateConnectionAsync(string apiUrl, string apiToken)
    {
        _logger.LogInformation("Validating Zabbix connection to {ApiUrl}", apiUrl);

        try
        {
            var requestPayload = new
            {
                jsonrpc = "2.0",
                method = "apiinfo.version",
                @params = new { },
                id = 1
            };

            var response = await _httpClient.PostAsJsonAsync(apiUrl, requestPayload);
            response.EnsureSuccessStatusCode();

            _logger.LogInformation("Zabbix connection validated successfully");
            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Zabbix connection validation failed");
            return false;
        }
    }

    public async Task<string> GetZabbixVersionAsync()
    {
        try
        {
            var requestPayload = new
            {
                jsonrpc = "2.0",
                method = "apiinfo.version",
                @params = new { },
                id = 1
            };

            var response = await _httpClient.PostAsJsonAsync(_settings.ApiUrl, requestPayload);
            response.EnsureSuccessStatusCode();

            var result = await response.Content.ReadFromJsonAsync<JsonElement>();
            return result.GetProperty("result").GetString();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to get Zabbix version");
            return "Unknown";
        }
    }
}
```

### 4.4 Auth Service Implementation

**Substep 4.4.1**: Create password hashing helper
Create `src/alertblurty.Data/Services/Helpers/PasswordHasher.cs`
```csharp
public static class PasswordHasher
{
    public static string HashPassword(string password)
    {
        return BCrypt.Net.BCrypt.HashPassword(password);
    }

    public static bool VerifyPassword(string password, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(password, hash);
    }
}
```

**Substep 4.4.2**: Create JWT token generator
Create `src/alertblurty.Data/Services/Helpers/JwtTokenGenerator.cs`
```csharp
public class JwtTokenGenerator
{
    private readonly JwtSettings _settings;

    public JwtTokenGenerator(IOptions<JwtSettings> settings)
    {
        _settings = settings.Value;
    }

    public string GenerateToken(User user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Email, user.Email),
            new Claim(ClaimTypes.Name, user.FullName),
            new Claim(ClaimTypes.Role, user.Role.ToString())
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_settings.SecretKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var token = new JwtSecurityToken(
            issuer: _settings.Issuer,
            audience: _settings.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddMinutes(_settings.ExpiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    public ClaimsPrincipal ValidateToken(string token)
    {
        var tokenHandler = new JwtSecurityTokenHandler();
        var key = Encoding.UTF8.GetBytes(_settings.SecretKey);

        var validationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = _settings.Issuer,
            ValidAudience = _settings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(key),
            ClockSkew = TimeSpan.Zero
        };

        return tokenHandler.ValidateToken(token, validationParameters, out _);
    }
}
```

**Substep 4.4.3**: Implement `AuthService.cs`
```csharp
public class AuthService : IAuthService
{
    private readonly AlertBlurtyDbContext _context;
    private readonly ILogger<AuthService> _logger;
    private readonly JwtTokenGenerator _tokenGenerator;
    private readonly IAuditService _auditService;

    public AuthService(
        AlertBlurtyDbContext context,
        ILogger<AuthService> logger,
        JwtTokenGenerator tokenGenerator,
        IAuditService auditService)
    {
        _context = context;
        _logger = logger;
        _tokenGenerator = tokenGenerator;
        _auditService = auditService;
    }

    public async Task<LoginResponse> LoginAsync(LoginRequest request)
    {
        _logger.LogInformation("Login attempt for email: {Email}", request.Email);

        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Email == request.Email && u.IsActive);

        if (user == null || !PasswordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            _logger.LogWarning("Login failed for email: {Email}", request.Email);
            return null;
        }

        var token = _tokenGenerator.GenerateToken(user);

        await _auditService.LogAsync(
            user.Id,
            "Login",
            "User",
            user.Id,
            new { Email = user.Email });

        _logger.LogInformation("Login successful for user: {UserId}", user.Id);

        return new LoginResponse
        {
            Token = token,
            User = MapToUserDto(user)
        };
    }

    public async Task<UserDto> RegisterUserAsync(RegisterUserRequest request)
    {
        _logger.LogInformation("Registering new user: {Email}", request.Email);

        if (await _context.Users.AnyAsync(u => u.Email == request.Email))
        {
            _logger.LogWarning("Registration failed: Email already exists: {Email}", request.Email);
            throw new InvalidOperationException("Email already exists");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            OrganizationId = request.OrganizationId,
            Email = request.Email,
            PasswordHash = PasswordHasher.HashPassword(request.Password),
            FullName = request.FullName,
            PhoneNumber = request.PhoneNumber,
            Timezone = request.Timezone ?? "UTC",
            Role = request.Role,
            IsActive = true
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        await _auditService.LogAsync(
            null,
            "Register",
            "User",
            user.Id,
            new { Email = user.Email, Role = user.Role });

        _logger.LogInformation("User registered successfully: {UserId}", user.Id);

        return MapToUserDto(user);
    }

    public async Task<bool> ChangePasswordAsync(Guid userId, ChangePasswordRequest request)
    {
        _logger.LogInformation("Password change attempt for user: {UserId}", userId);

        var user = await _context.Users.FindAsync(userId);
        if (user == null || !PasswordHasher.VerifyPassword(request.CurrentPassword, user.PasswordHash))
        {
            _logger.LogWarning("Password change failed for user: {UserId}", userId);
            return false;
        }

        user.PasswordHash = PasswordHasher.HashPassword(request.NewPassword);
        await _context.SaveChangesAsync();

        await _auditService.LogAsync(userId, "PasswordChange", "User", userId, new { });

        _logger.LogInformation("Password changed successfully for user: {UserId}", userId);
        return true;
    }

    public async Task<bool> ValidateTokenAsync(string token)
    {
        try
        {
            var principal = _tokenGenerator.ValidateToken(token);
            return principal != null;
        }
        catch
        {
            return false;
        }
    }

    public async Task<UserDto> GetCurrentUserAsync(string token)
    {
        var principal = _tokenGenerator.ValidateToken(token);
        var userIdClaim = principal.FindFirst(ClaimTypes.NameIdentifier);

        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return null;
        }

        var user = await _context.Users
            .Include(u => u.Organization)
            .FirstOrDefaultAsync(u => u.Id == userId);

        return user != null ? MapToUserDto(user) : null;
    }

    private UserDto MapToUserDto(User user)
    {
        return new UserDto
        {
            Id = user.Id,
            Email = user.Email,
            FullName = user.FullName,
            PhoneNumber = user.PhoneNumber,
            Timezone = user.Timezone,
            Role = user.Role.ToString(),
            IsActive = user.IsActive,
            OrganizationId = user.OrganizationId,
            OrganizationName = user.Organization?.Name
        };
    }
}
```

### 4.5 Incident Service Implementation

**Substep 4.5.1**: Create `src/alertblurty.Data/Services/IncidentService.cs`

This service handles:
- Incident deduplication by {host, trigger}
- Creating new incidents or updating event counts
- Fetching incidents for users and teams
- Acknowledgment flow (mark in DB + call Zabbix API)

Key methods:
```csharp
public async Task<IncidentDto> CreateOrUpdateIncidentAsync(ZabbixWebhookPayload payload)
{
    // Check if incident exists for this {host, trigger} and is not acknowledged
    var existingIncident = await _context.Incidents
        .FirstOrDefaultAsync(i =>
            i.HostName == payload.HostName &&
            i.ZabbixTriggerId == payload.TriggerId &&
            i.Status == IncidentStatus.Open);

    if (existingIncident != null)
    {
        // Update existing incident
        existingIncident.EventCount++;
        existingIncident.LastOccurrenceUtc = DateTime.UtcNow;
        await _context.SaveChangesAsync();

        _logger.LogInformation(
            "Updated existing incident {IncidentId}. New event count: {EventCount}",
            existingIncident.Id,
            existingIncident.EventCount);

        return MapToDto(existingIncident);
    }
    else
    {
        // Create new incident
        var incident = new Incident
        {
            Id = Guid.NewGuid(),
            TeamId = payload.TeamId, // Determined by webhook routing
            ZabbixEventId = payload.EventId,
            ZabbixTriggerId = payload.TriggerId,
            HostName = payload.HostName,
            TriggerName = payload.TriggerName,
            TriggerDescription = payload.TriggerDescription,
            Severity = payload.Severity,
            FirstOccurrenceUtc = DateTime.UtcNow,
            LastOccurrenceUtc = DateTime.UtcNow,
            Status = IncidentStatus.Open
        };

        _context.Incidents.Add(incident);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Created new incident {IncidentId} for {HostName}/{TriggerName}",
            incident.Id,
            incident.HostName,
            incident.TriggerName);

        // Trigger notification to on-call user
        await _notificationService.SendIncidentNotificationAsync(incident.Id, await GetCurrentOnCallUserId(incident.TeamId));

        return MapToDto(incident);
    }
}

public async Task<bool> AcknowledgeIncidentAsync(Guid incidentId, Guid userId)
{
    _logger.LogInformation("User {UserId} acknowledging incident {IncidentId}", userId, incidentId);

    var incident = await _context.Incidents.FindAsync(incidentId);
    if (incident == null || incident.Status != IncidentStatus.Open)
    {
        _logger.LogWarning("Incident {IncidentId} not found or already acknowledged", incidentId);
        return false;
    }

    // Acknowledge in Zabbix first
    var zabbixSuccess = await _zabbixService.AcknowledgeEventAsync(
        incident.ZabbixEventId,
        $"Acknowledged by {userId} via alertblurty");

    // Update incident status
    incident.Status = IncidentStatus.Acknowledged;
    incident.AcknowledgedByUserId = userId;
    incident.AcknowledgedAtUtc = DateTime.UtcNow;

    // Log acknowledgment
    var ack = new IncidentAcknowledgment
    {
        Id = Guid.NewGuid(),
        IncidentId = incidentId,
        UserId = userId,
        AcknowledgedAtUtc = DateTime.UtcNow,
        ZabbixAckSuccess = zabbixSuccess,
        ZabbixAckResponse = zabbixSuccess ? "Success" : "Failed"
    };

    _context.IncidentAcknowledgments.Add(ack);
    await _context.SaveChangesAsync();

    await _auditService.LogAsync(userId, "AcknowledgeIncident", "Incident", incidentId,
        new { ZabbixSuccess = zabbixSuccess });

    _logger.LogInformation("Incident {IncidentId} acknowledged. Zabbix sync: {ZabbixSuccess}",
        incidentId,
        zabbixSuccess);

    return true;
}
```

### 4.6 Notification Service Implementation

**Substep 4.6.1**: Create `src/alertblurty.Data/Services/NotificationService.cs`

Handles:
- Sending SMS via Twilio with retry
- Tracking notification attempts in DB
- Processing Twilio delivery status callbacks

Key method:
```csharp
public async Task<bool> SendIncidentNotificationAsync(Guid incidentId, Guid userId)
{
    _logger.LogInformation("Sending notification for incident {IncidentId} to user {UserId}",
        incidentId,
        userId);

    var incident = await _context.Incidents.FindAsync(incidentId);
    var user = await _context.Users.FindAsync(userId);

    if (incident == null || user == null)
    {
        _logger.LogError("Incident or user not found");
        return false;
    }

    var message = $"ALERT: {incident.TriggerName} on {incident.HostName}. Severity: {incident.Severity}. Reply ACK {incident.Id.ToString().Substring(0, 8)} to acknowledge.";

    var attemptNumber = await _context.IncidentNotifications
        .Where(n => n.IncidentId == incidentId && n.UserId == userId)
        .CountAsync() + 1;

    var (success, messageSid) = await _twilioService.SendSmsAsync(user.PhoneNumber, message);

    var notification = new IncidentNotification
    {
        Id = Guid.NewGuid(),
        IncidentId = incidentId,
        UserId = userId,
        Method = NotificationMethod.SMS,
        Recipient = user.PhoneNumber,
        Status = success ? NotificationStatus.Sent : NotificationStatus.Failed,
        SentAtUtc = DateTime.UtcNow,
        TwilioMessageSid = messageSid,
        AttemptNumber = attemptNumber,
        ErrorMessage = success ? null : "Failed to send SMS"
    };

    _context.IncidentNotifications.Add(notification);
    await _context.SaveChangesAsync();

    _logger.LogInformation("Notification {NotificationId} created. Status: {Status}",
        notification.Id,
        notification.Status);

    return success;
}
```

### 4.7 On-Call Service Implementation

**Substep 4.7.1**: Create `src/alertblurty.Data/Services/OnCallService.cs`

Implements:
- Schedule creation with rotation logic
- Shift generation based on frequency (hourly/daily/weekly/monthly)
- Current on-call user lookup
- Shift swap requests and approvals

Key methods:
```csharp
public async Task<CurrentOnCallDto> GetCurrentOnCallUserAsync(Guid teamId)
{
    var now = DateTime.UtcNow;

    var currentShift = await _context.OnCallShifts
        .Include(s => s.User)
        .Include(s => s.Schedule)
        .Where(s => s.Schedule.TeamId == teamId &&
                    s.Schedule.IsActive &&
                    s.StartTimeUtc <= now &&
                    s.EndTimeUtc > now)
        .OrderBy(s => s.StartTimeUtc)
        .FirstOrDefaultAsync();

    if (currentShift == null)
    {
        _logger.LogWarning("No active on-call shift found for team {TeamId}", teamId);
        return null;
    }

    // If shift was swapped, return the swapped user
    var onCallUser = currentShift.IsSwapped && currentShift.SwappedWithUserId.HasValue
        ? await _context.Users.FindAsync(currentShift.SwappedWithUserId.Value)
        : currentShift.User;

    return new CurrentOnCallDto
    {
        UserId = onCallUser.Id,
        UserName = onCallUser.FullName,
        PhoneNumber = onCallUser.PhoneNumber,
        ShiftStart = currentShift.StartTimeUtc,
        ShiftEnd = currentShift.EndTimeUtc,
        ScheduleName = currentShift.Schedule.Name
    };
}

public async Task<bool> RequestSwapAsync(SwapShiftRequest request)
{
    _logger.LogInformation("Swap request from user {RequestorId} to user {TargetId} for shift {ShiftId}",
        request.RequestorUserId,
        request.TargetUserId,
        request.ShiftId);

    var shift = await _context.OnCallShifts
        .Include(s => s.Schedule)
            .ThenInclude(sch => sch.Team)
        .FirstOrDefaultAsync(s => s.Id == request.ShiftId);

    if (shift == null || shift.UserId != request.RequestorUserId)
    {
        _logger.LogWarning("Shift not found or requestor is not the shift owner");
        return false;
    }

    var team = shift.Schedule.Team;

    if (team.RequireAdminApprovalForSwaps)
    {
        // Create pending swap request (would need separate SwapRequest entity)
        _logger.LogInformation("Swap requires admin approval for team {TeamId}", team.Id);
        // TODO: Implement SwapRequest entity and workflow
        return false;
    }
    else
    {
        // Direct swap (target user must still accept via separate endpoint)
        shift.IsSwapped = true;
        shift.SwappedWithUserId = request.TargetUserId;
        await _context.SaveChangesAsync();

        await _auditService.LogAsync(request.RequestorUserId, "SwapShift", "OnCallShift", shift.Id,
            new { TargetUserId = request.TargetUserId });

        _logger.LogInformation("Shift {ShiftId} swapped to user {TargetUserId}", shift.Id, request.TargetUserId);
        return true;
    }
}
```

### 4.8 Team Service Implementation

**Substep 4.8.1**: Create `src/alertblurty.Data/Services/TeamService.cs`

Standard CRUD operations for teams and team members. Includes:
- Team creation/update/deletion
- Member management
- Rotation order updates

### 4.9 Audit Service Implementation

**Substep 4.9.1**: Create `src/alertblurty.Data/Services/AuditService.cs`

Simple service to log all actions to `AuditLog` table:
```csharp
public async Task LogAsync(Guid? userId, string action, string entityType, Guid? entityId, object details, string ipAddress = null, string userAgent = null)
{
    var log = new AuditLog
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        Action = action,
        EntityType = entityType,
        EntityId = entityId,
        Details = JsonSerializer.Serialize(details),
        IpAddress = ipAddress,
        UserAgent = userAgent
    };

    _context.AuditLogs.Add(log);
    await _context.SaveChangesAsync();
}

public async Task CleanupOldLogsAsync(int retentionDays)
{
    var cutoffDate = DateTime.UtcNow.AddDays(-retentionDays);

    var oldLogs = await _context.AuditLogs
        .Where(l => l.CreatedAtUtc < cutoffDate)
        .ToListAsync();

    _context.AuditLogs.RemoveRange(oldLogs);
    await _context.SaveChangesAsync();

    _logger.LogInformation("Cleaned up {Count} audit logs older than {CutoffDate}", oldLogs.Count, cutoffDate);
}
```

### 4.10 Setup Service Implementation

**Substep 4.10.1**: Create `src/alertblurty.Data/Services/SetupService.cs`

Handles first-run setup wizard:
```csharp
public async Task<bool> IsSetupCompleteAsync()
{
    var org = await _context.Organizations.FirstOrDefaultAsync();
    return org != null && org.IsSetupComplete;
}

public async Task<bool> CompleteFirstRunSetupAsync(FirstRunSetupRequest request)
{
    _logger.LogInformation("Starting first-run setup");

    // Create organization
    var org = new Organization
    {
        Id = Guid.NewGuid(),
        Name = request.OrganizationName,
        DefaultTimezone = request.DefaultTimezone ?? "UTC",
        IsSetupComplete = false
    };
    _context.Organizations.Add(org);

    // Create superadmin user
    var superadmin = new User
    {
        Id = Guid.NewGuid(),
        OrganizationId = org.Id,
        Email = request.SuperadminEmail,
        PasswordHash = PasswordHasher.HashPassword(request.SuperadminPassword),
        FullName = request.SuperadminName,
        PhoneNumber = request.SuperadminPhoneNumber,
        Timezone = request.DefaultTimezone ?? "UTC",
        Role = UserRole.SuperAdmin,
        IsActive = true
    };
    _context.Users.Add(superadmin);

    // Create default team
    var team = new Team
    {
        Id = Guid.NewGuid(),
        OrganizationId = org.Id,
        Name = "Default Team",
        Description = "Initial team created during setup"
    };
    _context.Teams.Add(team);

    // Add superadmin to team
    var teamMember = new TeamMember
    {
        Id = Guid.NewGuid(),
        TeamId = team.Id,
        UserId = superadmin.Id,
        RotationOrder = 1,
        IsActive = true
    };
    _context.TeamMembers.Add(teamMember);

    // Store system configuration
    if (!string.IsNullOrEmpty(request.ZabbixApiUrl))
    {
        _context.SystemConfigurations.Add(new SystemConfiguration
        {
            Id = Guid.NewGuid(),
            Key = "ZabbixApiUrl",
            Value = request.ZabbixApiUrl,
            Description = "Zabbix API URL"
        });
    }

    if (!string.IsNullOrEmpty(request.ZabbixApiToken))
    {
        _context.SystemConfigurations.Add(new SystemConfiguration
        {
            Id = Guid.NewGuid(),
            Key = "ZabbixApiToken",
            Value = request.ZabbixApiToken,
            Description = "Zabbix API Token",
            IsEncrypted = true // TODO: Implement encryption
        });
    }

    // Mark setup complete
    org.IsSetupComplete = true;
    await _context.SaveChangesAsync();

    _logger.LogInformation("First-run setup completed. Organization: {OrgId}", org.Id);
    return true;
}
```

---

## Phase 5: API Layer & Webhooks

### 5.1 Dependency Injection Setup

**Substep 5.1.1**: Configure services in `Program.cs`
```csharp
// Database
builder.Services.AddDbContext<AlertBlurtyDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));

// Configuration
builder.Services.Configure<TwilioSettings>(builder.Configuration.GetSection("Twilio"));
builder.Services.Configure<ZabbixSettings>(builder.Configuration.GetSection("Zabbix"));
builder.Services.Configure<JwtSettings>(builder.Configuration.GetSection("Jwt"));
builder.Services.Configure<SecuritySettings>(builder.Configuration.GetSection("Security"));
builder.Services.Configure<AuditSettings>(builder.Configuration.GetSection("Audit"));

// Services
builder.Services.AddScoped<IAuthService, AuthService>();
builder.Services.AddScoped<IIncidentService, IncidentService>();
builder.Services.AddScoped<INotificationService, NotificationService>();
builder.Services.AddScoped<IOnCallService, OnCallService>();
builder.Services.AddScoped<ITeamService, TeamService>();
builder.Services.AddScoped<IZabbixService, ZabbixService>();
builder.Services.AddScoped<ITwilioService, TwilioService>();
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<ISetupService, SetupService>();

// Helpers
builder.Services.AddSingleton<JwtTokenGenerator>();

// HttpClient for Zabbix
builder.Services.AddHttpClient<IZabbixService, ZabbixService>();

// JWT Authentication
var jwtSettings = builder.Configuration.GetSection("Jwt").Get<JwtSettings>();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtSettings.Issuer,
            ValidAudience = jwtSettings.Audience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSettings.SecretKey)),
            ClockSkew = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("SuperAdminOnly", policy => policy.RequireRole("SuperAdmin"));
    options.AddPolicy("AdminOrAbove", policy => policy.RequireRole("Admin", "SuperAdmin"));
});

// Controllers
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS (if needed for Blazor)
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.AllowAnyOrigin()
              .AllowAnyMethod()
              .AllowAnyHeader();
    });
});
```

### 5.2 Middleware for Setup Check

**Substep 5.2.1**: Create `src/alertblurty.Api/Middleware/SetupCheckMiddleware.cs`
```csharp
public class SetupCheckMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<SetupCheckMiddleware> _logger;

    public SetupCheckMiddleware(RequestDelegate next, ILogger<SetupCheckMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context, ISetupService setupService)
    {
        var path = context.Request.Path.Value?.ToLower();

        // Allow setup endpoints and health checks
        if (path.StartsWith("/api/setup") ||
            path.StartsWith("/health") ||
            path.StartsWith("/swagger"))
        {
            await _next(context);
            return;
        }

        // Check if setup is complete
        if (!await setupService.IsSetupCompleteAsync())
        {
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new
            {
                error = "Setup not complete. Please complete first-run setup at /api/setup"
            }));
            return;
        }

        await _next(context);
    }
}
```

Register in `Program.cs`:
```csharp
app.UseMiddleware<SetupCheckMiddleware>();
```

### 5.3 Middleware for IP Allowlist

**Substep 5.3.1**: Create `src/alertblurty.Api/Middleware/IpAllowlistMiddleware.cs`
```csharp
public class IpAllowlistMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<IpAllowlistMiddleware> _logger;
    private readonly HashSet<string> _allowedIps;

    public IpAllowlistMiddleware(
        RequestDelegate next,
        ILogger<IpAllowlistMiddleware> logger,
        IOptions<SecuritySettings> securitySettings)
    {
        _next = next;
        _logger = logger;
        _allowedIps = new HashSet<string>(securitySettings.Value.WebhookIpAllowlist ?? Array.Empty<string>());
    }

    public async Task InvokeAsync(HttpContext context)
    {
        var path = context.Request.Path.Value?.ToLower();

        // Only apply to webhook endpoints
        if (path.StartsWith("/api/webhooks") && _allowedIps.Count > 0)
        {
            var remoteIp = context.Connection.RemoteIpAddress?.ToString();

            if (string.IsNullOrEmpty(remoteIp) || !_allowedIps.Contains(remoteIp))
            {
                _logger.LogWarning("Blocked webhook request from unauthorized IP: {RemoteIp}", remoteIp);
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsync("Forbidden");
                return;
            }

            _logger.LogDebug("Allowed webhook request from IP: {RemoteIp}", remoteIp);
        }

        await _next(context);
    }
}
```

### 5.4 Controllers Implementation

**Substep 5.4.1**: Create `src/alertblurty.Api/Controllers/SetupController.cs`
```csharp
[ApiController]
[Route("api/[controller]")]
public class SetupController : ControllerBase
{
    private readonly ISetupService _setupService;
    private readonly ILogger<SetupController> _logger;

    public SetupController(ISetupService setupService, ILogger<SetupController> logger)
    {
        _setupService = setupService;
        _logger = logger;
    }

    [HttpGet("status")]
    public async Task<IActionResult> GetStatus()
    {
        var status = await _setupService.GetSetupStatusAsync();
        return Ok(status);
    }

    [HttpPost("complete")]
    public async Task<IActionResult> CompleteSetup([FromBody] FirstRunSetupRequest request)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        var result = await _setupService.CompleteFirstRunSetupAsync(request);

        if (result)
        {
            return Ok(new { message = "Setup completed successfully" });
        }

        return BadRequest(new { error = "Setup failed" });
    }
}
```

**Substep 5.4.2**: Create `src/alertblurty.Api/Controllers/AuthController.cs`
```csharp
[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly IAuthService _authService;
    private readonly IAuditService _auditService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        IAuthService authService,
        IAuditService auditService,
        ILogger<AuthController> logger)
    {
        _authService = authService;
        _auditService = auditService;
        _logger = logger;
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest request)
    {
        var ipAddress = HttpContext.Connection.RemoteIpAddress?.ToString();
        var userAgent = HttpContext.Request.Headers["User-Agent"].ToString();

        var result = await _authService.LoginAsync(request);

        if (result == null)
        {
            await _auditService.LogAsync(null, "LoginFailed", "User", null,
                new { Email = request.Email }, ipAddress, userAgent);

            return Unauthorized(new { error = "Invalid credentials" });
        }

        return Ok(result);
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<IActionResult> GetCurrentUser()
    {
        var token = HttpContext.Request.Headers["Authorization"].ToString().Replace("Bearer ", "");
        var user = await _authService.GetCurrentUserAsync(token);

        if (user == null)
        {
            return Unauthorized();
        }

        return Ok(user);
    }

    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (userIdClaim == null || !Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var result = await _authService.ChangePasswordAsync(userId, request);

        if (!result)
        {
            return BadRequest(new { error = "Password change failed" });
        }

        return Ok(new { message = "Password changed successfully" });
    }
}
```

**Substep 5.4.3**: Create `src/alertblurty.Api/Controllers/WebhooksController.cs`
```csharp
[ApiController]
[Route("api/[controller]")]
public class WebhooksController : ControllerBase
{
    private readonly IIncidentService _incidentService;
    private readonly IAuditService _auditService;
    private readonly ILogger<WebhooksController> _logger;

    public WebhooksController(
        IIncidentService incidentService,
        IAuditService auditService,
        ILogger<WebhooksController> logger)
    {
        _incidentService = incidentService;
        _auditService = auditService;
        _logger = logger;
    }

    [HttpPost("zabbix")]
    public async Task<IActionResult> ReceiveZabbixWebhook([FromBody] ZabbixWebhookPayload payload)
    {
        _logger.LogInformation("Received Zabbix webhook for event {EventId}", payload.EventId);

        try
        {
            var incident = await _incidentService.CreateOrUpdateIncidentAsync(payload);

            await _auditService.LogAsync(null, "WebhookReceived", "Incident", incident.Id,
                new { EventId = payload.EventId, Host = payload.HostName });

            return Ok(new { incidentId = incident.Id, status = "processed" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to process Zabbix webhook");
            return StatusCode(500, new { error = "Failed to process webhook" });
        }
    }

    [HttpPost("twilio/status")]
    public async Task<IActionResult> ReceiveTwilioStatus([FromForm] string MessageSid, [FromForm] string MessageStatus)
    {
        _logger.LogInformation("Received Twilio status callback. SID: {MessageSid}, Status: {Status}",
            MessageSid,
            MessageStatus);

        // Update notification status in database
        // Implementation in NotificationService

        return Ok();
    }
}
```

**Substep 5.4.4**: Create `src/alertblurty.Api/Controllers/IncidentsController.cs`
```csharp
[Authorize]
[ApiController]
[Route("api/[controller]")]
public class IncidentsController : ControllerBase
{
    private readonly IIncidentService _incidentService;
    private readonly IAuditService _auditService;
    private readonly ILogger<IncidentsController> _logger;

    // Constructor...

    [HttpGet]
    public async Task<IActionResult> GetIncidents([FromQuery] Guid? teamId, [FromQuery] string status)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        IncidentStatus? statusFilter = null;
        if (Enum.TryParse<IncidentStatus>(status, true, out var parsedStatus))
        {
            statusFilter = parsedStatus;
        }

        var incidents = teamId.HasValue
            ? await _incidentService.GetIncidentsForTeamAsync(teamId.Value, statusFilter)
            : await _incidentService.GetIncidentsForUserAsync(userId, statusFilter);

        return Ok(incidents);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetIncident(Guid id)
    {
        var incident = await _incidentService.GetIncidentByIdAsync(id);

        if (incident == null)
        {
            return NotFound();
        }

        return Ok(incident);
    }

    [HttpPost("{id}/acknowledge")]
    public async Task<IActionResult> AcknowledgeIncident(Guid id)
    {
        var userIdClaim = User.FindFirst(ClaimTypes.NameIdentifier);
        if (!Guid.TryParse(userIdClaim.Value, out var userId))
        {
            return Unauthorized();
        }

        var result = await _incidentService.AcknowledgeIncidentAsync(id, userId);

        if (!result)
        {
            return BadRequest(new { error = "Failed to acknowledge incident" });
        }

        return Ok(new { message = "Incident acknowledged successfully" });
    }

    [HttpGet("stats")]
    public async Task<IActionResult> GetStats([FromQuery] Guid? teamId)
    {
        var openCount = await _incidentService.GetOpenIncidentCountAsync(teamId);

        return Ok(new { openIncidents = openCount });
    }
}
```

**Substep 5.4.5**: Create remaining controllers
- `TeamsController.cs` (CRUD for teams, member management)
- `OnCallController.cs` (schedules, current on-call, swaps)
- `UsersController.cs` (user management, superadmin/admin only)
- `AuditController.cs` (audit log queries, admin only)

### 5.5 Health Checks

**Substep 5.5.1**: Configure health checks in `Program.cs`
```csharp
builder.Services.AddHealthChecks()
    .AddDbContextCheck<AlertBlurtyDbContext>("database")
    .AddCheck("twilio", () =>
    {
        // Check if Twilio is configured
        var twilioSettings = builder.Configuration.GetSection("Twilio").Get<TwilioSettings>();
        return string.IsNullOrEmpty(twilioSettings?.AccountSid)
            ? HealthCheckResult.Degraded("Twilio not configured")
            : HealthCheckResult.Healthy();
    })
    .AddCheck("zabbix", () =>
    {
        // Check if Zabbix is configured
        var zabbixSettings = builder.Configuration.GetSection("Zabbix").Get<ZabbixSettings>();
        return string.IsNullOrEmpty(zabbixSettings?.ApiUrl)
            ? HealthCheckResult.Degraded("Zabbix not configured")
            : HealthCheckResult.Healthy();
    });

app.MapHealthChecks("/health");
```

---

## Phase 6: Blazor Web UI

### 6.1 Add Blazor to API Project

**Substep 6.1.1**: Add Blazor services to `Program.cs`
```csharp
builder.Services.AddRazorPages();
builder.Services.AddServerSideBlazor();
```

**Substep 6.1.2**: Map Blazor endpoints
```csharp
app.MapBlazorHub();
app.MapFallbackToPage("/_Host");
```

### 6.2 Create Blazor Pages Structure

**Substep 6.2.1**: Create `src/alertblurty.Api/Pages/` directory
- `_Host.cshtml` (main Blazor host page)
- `_Layout.cshtml`

**Substep 6.2.2**: Create `src/alertblurty.Api/Components/` directory
- `App.razor`
- `MainLayout.razor`
- `NavMenu.razor`

### 6.3 Create Blazor Pages

**Substep 6.3.1**: Create dashboard page
`src/alertblurty.Api/Pages/Index.razor`
- Display current on-call user
- Show open incidents count
- Quick stats

**Substep 6.3.2**: Create incidents page
`src/alertblurty.Api/Pages/Incidents.razor`
- List incidents with filters (status, team)
- Acknowledge button
- View incident details modal

**Substep 6.3.3**: Create on-call schedule page
`src/alertblurty.Api/Pages/OnCall.razor`
- Display current schedule
- Show upcoming shifts
- Request swap functionality

**Substep 6.3.4**: Create teams management page
`src/alertblurty.Api/Pages/Teams.razor`
- List teams
- Add/edit/delete teams
- Manage team members

**Substep 6.3.5**: Create users management page
`src/alertblurty.Api/Pages/Users.razor`
- User list
- Create new users
- Edit user roles

**Substep 6.3.6**: Create audit log page
`src/alertblurty.Api/Pages/Audit.razor`
- Filterable audit log viewer
- Export functionality

### 6.4 Blazor Authentication

**Substep 6.4.1**: Create custom AuthenticationStateProvider
```csharp
public class JwtAuthenticationStateProvider : AuthenticationStateProvider
{
    private readonly ILocalStorageService _localStorage;
    private readonly HttpClient _httpClient;

    public override async Task<AuthenticationState> GetAuthenticationStateAsync()
    {
        var token = await _localStorage.GetItemAsync<string>("authToken");

        if (string.IsNullOrEmpty(token))
        {
            return new AuthenticationState(new ClaimsPrincipal(new ClaimsIdentity()));
        }

        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token);

        // Validate token and get claims
        var claims = ParseClaimsFromJwt(token);
        var identity = new ClaimsIdentity(claims, "jwt");

        return new AuthenticationState(new ClaimsPrincipal(identity));
    }

    public void NotifyUserAuthentication(string token)
    {
        var claims = ParseClaimsFromJwt(token);
        var identity = new ClaimsIdentity(claims, "jwt");
        var user = new ClaimsPrincipal(identity);

        NotifyAuthenticationStateChanged(Task.FromResult(new AuthenticationState(user)));
    }

    public void NotifyUserLogout()
    {
        var identity = new ClaimsIdentity();
        var user = new ClaimsPrincipal(identity);

        NotifyAuthenticationStateChanged(Task.FromResult(new AuthenticationState(user)));
    }

    private IEnumerable<Claim> ParseClaimsFromJwt(string jwt)
    {
        var payload = jwt.Split('.')[1];
        var jsonBytes = ParseBase64WithoutPadding(payload);
        var keyValuePairs = JsonSerializer.Deserialize<Dictionary<string, object>>(jsonBytes);

        return keyValuePairs.Select(kvp => new Claim(kvp.Key, kvp.Value.ToString()));
    }

    private byte[] ParseBase64WithoutPadding(string base64)
    {
        switch (base64.Length % 4)
        {
            case 2: base64 += "=="; break;
            case 3: base64 += "="; break;
        }
        return Convert.FromBase64String(base64);
    }
}
```

**Substep 6.4.2**: Register authentication services
```csharp
builder.Services.AddScoped<AuthenticationStateProvider, JwtAuthenticationStateProvider>();
builder.Services.AddAuthorizationCore();
builder.Services.AddBlazoredLocalStorage();
```

### 6.5 Blazor HTTP Client Service

**Substep 6.5.1**: Create API client wrapper
```csharp
public class ApiClient
{
    private readonly HttpClient _httpClient;
    private readonly ILocalStorageService _localStorage;

    public ApiClient(HttpClient httpClient, ILocalStorageService localStorage)
    {
        _httpClient = httpClient;
        _localStorage = localStorage;
    }

    private async Task<HttpClient> GetAuthenticatedClientAsync()
    {
        var token = await _localStorage.GetItemAsync<string>("authToken");
        if (!string.IsNullOrEmpty(token))
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", token);
        }
        return _httpClient;
    }

    public async Task<T> GetAsync<T>(string url)
    {
        var client = await GetAuthenticatedClientAsync();
        var response = await client.GetAsync(url);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>();
    }

    public async Task<T> PostAsync<T>(string url, object data)
    {
        var client = await GetAuthenticatedClientAsync();
        var response = await client.PostAsJsonAsync(url, data);
        response.EnsureSuccessStatusCode();
        return await response.Content.ReadFromJsonAsync<T>();
    }

    // Additional methods for PUT, DELETE, etc.
}
```

---

## Phase 7: Setup Wizard

### 7.1 Setup Wizard UI

**Substep 7.1.1**: Create `src/alertblurty.Api/Pages/Setup.razor`

Multi-step wizard:
1. Welcome screen
2. Superadmin account creation
3. Organization details
4. Zabbix configuration (optional)
5. Twilio configuration (optional)
6. Security settings (IP allowlist, audit retention)
7. Completion confirmation

**Substep 7.1.2**: Implement wizard navigation
```csharp
private int currentStep = 0;
private FirstRunSetupRequest setupRequest = new();

private async Task NextStep()
{
    if (await ValidateCurrentStep())
    {
        currentStep++;
    }
}

private async Task<bool> ValidateCurrentStep()
{
    switch (currentStep)
    {
        case 2:
            // Validate superadmin details
            return !string.IsNullOrEmpty(setupRequest.SuperadminEmail);
        case 3:
            // Validate organization details
            return !string.IsNullOrEmpty(setupRequest.OrganizationName);
        case 4:
            // Validate Zabbix (if provided)
            if (!string.IsNullOrEmpty(setupRequest.ZabbixApiUrl))
            {
                return await ValidateZabbixConnection();
            }
            return true;
        case 5:
            // Validate Twilio (if provided)
            if (!string.IsNullOrEmpty(setupRequest.TwilioAccountSid))
            {
                return await ValidateTwilioCredentials();
            }
            return true;
        default:
            return true;
    }
}

private async Task CompleteSetup()
{
    var result = await Http.PostAsJsonAsync("/api/setup/complete", setupRequest);
    if (result.IsSuccessStatusCode)
    {
        NavigationManager.NavigateTo("/");
    }
}
```

### 7.2 Setup Check on Application Start

**Substep 7.2.1**: Add setup check to main layout
```csharp
@code {
    protected override async Task OnInitializedAsync()
    {
        var setupStatus = await Http.GetFromJsonAsync<SetupStatusDto>("/api/setup/status");

        if (!setupStatus.IsComplete && !NavigationManager.Uri.Contains("/setup"))
        {
            NavigationManager.NavigateTo("/setup");
        }
    }
}
```

---

## Phase 8: Containerization & Deployment

### 8.1 Dockerfile Creation

**Substep 8.1.1**: Create `docker/Dockerfile`
```dockerfile
# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project files
COPY alertblurty.sln ./
COPY src/alertblurty.Api/alertblurty.Api.csproj ./src/alertblurty.Api/
COPY src/alertblurty.Data/alertblurty.Data.csproj ./src/alertblurty.Data/
COPY src/alertblurty.Models/alertblurty.Models.csproj ./src/alertblurty.Models/
COPY tests/alertblurty.Tests/alertblurty.Tests.csproj ./tests/alertblurty.Tests/

# Restore dependencies
RUN dotnet restore

# Copy source code
COPY . .

# Build
WORKDIR /src/src/alertblurty.Api
RUN dotnet build -c Release -o /app/build

# Publish
RUN dotnet publish -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Create logs directory
RUN mkdir -p /app/logs

# Copy published application
COPY --from=build /app/publish .

# Expose ports
EXPOSE 80
EXPOSE 443

# Set environment variables
ENV ASPNETCORE_URLS=http://+:80
ENV ASPNETCORE_ENVIRONMENT=Production

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost/health || exit 1

# Run application
ENTRYPOINT ["dotnet", "alertblurty.Api.dll"]
```

**Substep 8.1.2**: Create `.dockerignore`
```
bin/
obj/
logs/
.vs/
.vscode/
*.user
*.suo
.git/
.gitignore
README.md
```

### 8.2 Docker Compose for Local Development

**Substep 8.2.1**: Create `docker/docker-compose.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: alertblurty_dev
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  alertblurty:
    build:
      context: ..
      dockerfile: docker/Dockerfile
    ports:
      - "8080:80"
    environment:
      - ConnectionStrings__DefaultConnection=Host=postgres;Port=5432;Database=alertblurty_dev;Username=postgres;Password=postgres
      - Jwt__SecretKey=YourSecretKeyHere_ChangeInProduction
      - Jwt__Issuer=alertblurty
      - Jwt__Audience=alertblurty-users
      - Jwt__ExpiryMinutes=60
    depends_on:
      - postgres
    volumes:
      - ./logs:/app/logs

volumes:
  postgres_data:
```

### 8.3 Kubernetes Deployment

**Substep 8.3.1**: Create `k8s/namespace.yaml`
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: alertblurty
```

**Substep 8.3.2**: Create `k8s/configmap.yaml`
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: alertblurty-config
  namespace: alertblurty
data:
  ASPNETCORE_ENVIRONMENT: "Production"
  Jwt__Issuer: "alertblurty"
  Jwt__Audience: "alertblurty-users"
  Jwt__ExpiryMinutes: "60"
```

**Substep 8.3.3**: Create `k8s/secret.yaml` (template)
```yaml
apiVersion: v1
kind: Secret
metadata:
  name: alertblurty-secrets
  namespace: alertblurty
type: Opaque
stringData:
  DATABASE_CONNECTION_STRING: "Host=postgres;Port=5432;Database=alertblurty;Username=postgres;Password=CHANGE_ME"
  JWT_SECRET_KEY: "CHANGE_ME"
  TWILIO_ACCOUNT_SID: "CHANGE_ME"
  TWILIO_AUTH_TOKEN: "CHANGE_ME"
  TWILIO_FROM_NUMBER: "CHANGE_ME"
  ZABBIX_API_URL: "CHANGE_ME"
  ZABBIX_API_TOKEN: "CHANGE_ME"
```

**Substep 8.3.4**: Create `k8s/deployment.yaml`
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: alertblurty
  namespace: alertblurty
spec:
  replicas: 2
  selector:
    matchLabels:
      app: alertblurty
  template:
    metadata:
      labels:
        app: alertblurty
    spec:
      containers:
      - name: alertblurty
        image: 344418511404.dkr.ecr.us-west-2.amazonaws.com/alertblurty:latest
        ports:
        - containerPort: 80
        envFrom:
        - configMapRef:
            name: alertblurty-config
        - secretRef:
            name: alertblurty-secrets
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 80
          initialDelaySeconds: 5
          periodSeconds: 10
        volumeMounts:
        - name: logs
          mountPath: /app/logs
      volumes:
      - name: logs
        emptyDir: {}
```

**Substep 8.3.5**: Create `k8s/service.yaml`
```yaml
apiVersion: v1
kind: Service
metadata:
  name: alertblurty
  namespace: alertblurty
spec:
  selector:
    app: alertblurty
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: LoadBalancer
```

**Substep 8.3.6**: Create `k8s/ingress.yaml` (optional, for HTTPS)
```yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: alertblurty
  namespace: alertblurty
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  ingressClassName: nginx
  tls:
  - hosts:
    - alertblurty.example.com
    secretName: alertblurty-tls
  rules:
  - host: alertblurty.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: alertblurty
            port:
              number: 80
```

### 8.4 Helm Chart (Optional)

**Substep 8.4.1**: Create Helm chart structure
```bash
helm create alertblurty-chart
```

**Substep 8.4.2**: Customize `values.yaml`, `Chart.yaml`, and templates

### 8.5 CI/CD Scripts

**Substep 8.5.1**: Create `scripts/build-docker.sh`
```bash
#!/bin/bash
set -e

VERSION=${1:-latest}
AWS_REGION=us-west-2
ECR_REPO=344418511404.dkr.ecr.us-west-2.amazonaws.com/alertblurty

echo "Building Docker image: $ECR_REPO:$VERSION"

# Build image
docker build -t alertblurty:$VERSION -f docker/Dockerfile .

# Tag for ECR
docker tag alertblurty:$VERSION $ECR_REPO:$VERSION
docker tag alertblurty:$VERSION $ECR_REPO:latest

echo "Docker image built and tagged successfully"
```

**Substep 8.5.2**: Create `scripts/push-docker.sh`
```bash
#!/bin/bash
set -e

VERSION=${1:-latest}
AWS_REGION=us-west-2
ECR_REPO=344418511404.dkr.ecr.us-west-2.amazonaws.com/alertblurty

echo "Authenticating with AWS ECR..."
aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_REPO

echo "Pushing Docker image: $ECR_REPO:$VERSION"
docker push $ECR_REPO:$VERSION
docker push $ECR_REPO:latest

echo "Docker image pushed successfully"
```

**Substep 8.5.3**: Create `scripts/deploy-k8s.sh`
```bash
#!/bin/bash
set -e

NAMESPACE=alertblurty

echo "Deploying to Kubernetes namespace: $NAMESPACE"

# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml

# Wait for rollout
kubectl rollout status deployment/alertblurty -n $NAMESPACE

echo "Deployment complete"
```

---

## Phase 9: Testing & Validation

### 9.1 Unit Tests

**Substep 9.1.1**: Create unit tests for services
- `AuthServiceTests.cs`
- `IncidentServiceTests.cs`
- `NotificationServiceTests.cs`
- `OnCallServiceTests.cs`
- `TeamServiceTests.cs`

**Example: `IncidentServiceTests.cs`**
```csharp
public class IncidentServiceTests
{
    private readonly Mock<AlertBlurtyDbContext> _mockContext;
    private readonly Mock<ILogger<IncidentService>> _mockLogger;
    private readonly Mock<INotificationService> _mockNotificationService;
    private readonly Mock<IZabbixService> _mockZabbixService;
    private readonly IncidentService _service;

    public IncidentServiceTests()
    {
        _mockContext = new Mock<AlertBlurtyDbContext>();
        _mockLogger = new Mock<ILogger<IncidentService>>();
        _mockNotificationService = new Mock<INotificationService>();
        _mockZabbixService = new Mock<IZabbixService>();

        _service = new IncidentService(
            _mockContext.Object,
            _mockLogger.Object,
            _mockNotificationService.Object,
            _mockZabbixService.Object);
    }

    [Fact]
    public async Task CreateOrUpdateIncidentAsync_CreatesNewIncident_WhenNoDuplicate()
    {
        // Arrange
        var payload = new ZabbixWebhookPayload
        {
            EventId = "12345",
            TriggerId = "67890",
            HostName = "server1",
            TriggerName = "CPU High",
            Severity = 3
        };

        _mockContext.Setup(c => c.Incidents.FirstOrDefaultAsync(It.IsAny<Expression<Func<Incident, bool>>>()))
            .ReturnsAsync((Incident)null);

        // Act
        var result = await _service.CreateOrUpdateIncidentAsync(payload);

        // Assert
        result.Should().NotBeNull();
        result.HostName.Should().Be("server1");
        result.TriggerName.Should().Be("CPU High");
    }

    [Fact]
    public async Task AcknowledgeIncidentAsync_CallsZabbixService_AndUpdatesIncident()
    {
        // Arrange
        var incidentId = Guid.NewGuid();
        var userId = Guid.NewGuid();

        var incident = new Incident
        {
            Id = incidentId,
            Status = IncidentStatus.Open,
            ZabbixEventId = "12345"
        };

        _mockContext.Setup(c => c.Incidents.FindAsync(incidentId))
            .ReturnsAsync(incident);

        _mockZabbixService.Setup(z => z.AcknowledgeEventAsync(It.IsAny<string>(), It.IsAny<string>()))
            .ReturnsAsync(true);

        // Act
        var result = await _service.AcknowledgeIncidentAsync(incidentId, userId);

        // Assert
        result.Should().BeTrue();
        _mockZabbixService.Verify(z => z.AcknowledgeEventAsync("12345", It.IsAny<string>()), Times.Once);
        incident.Status.Should().Be(IncidentStatus.Acknowledged);
    }
}
```

### 9.2 Integration Tests

**Substep 9.2.1**: Create integration tests with Testcontainers
```csharp
public class IncidentIntegrationTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;
    private readonly PostgreSqlContainer _postgresContainer;

    public IncidentIntegrationTests(WebApplicationFactory<Program> factory)
    {
        _postgresContainer = new PostgreSqlBuilder()
            .WithImage("postgres:15")
            .Build();

        _postgresContainer.StartAsync().Wait();

        _factory = factory.WithWebHostBuilder(builder =>
        {
            builder.ConfigureServices(services =>
            {
                // Replace DbContext with test container
                var descriptor = services.SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<AlertBlurtyDbContext>));
                if (descriptor != null)
                {
                    services.Remove(descriptor);
                }

                services.AddDbContext<AlertBlurtyDbContext>(options =>
                {
                    options.UseNpgsql(_postgresContainer.GetConnectionString());
                });
            });
        });
    }

    [Fact]
    public async Task WebhookEndpoint_CreatesIncident_WhenValidPayload()
    {
        // Arrange
        var client = _factory.CreateClient();
        var payload = new ZabbixWebhookPayload
        {
            EventId = "12345",
            TriggerId = "67890",
            HostName = "server1",
            TriggerName = "CPU High",
            Severity = 3
        };

        // Act
        var response = await client.PostAsJsonAsync("/api/webhooks/zabbix", payload);

        // Assert
        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }
}
```

### 9.3 Manual Testing Checklist

**Substep 9.3.1**: Create `docs/testing-checklist.md`

- [ ] First-run setup wizard completes successfully
- [ ] Superadmin can log in
- [ ] Teams can be created
- [ ] Users can be added to teams
- [ ] On-call schedules can be created
- [ ] Webhook endpoint receives Zabbix events
- [ ] Incidents are created and grouped correctly
- [ ] SMS notifications are sent via Twilio
- [ ] Incidents can be acknowledged
- [ ] Acknowledgment syncs to Zabbix
- [ ] Shift swaps work correctly
- [ ] Admin approval for swaps (if enabled)
- [ ] Audit logs capture all actions
- [ ] IP allowlist blocks unauthorized webhooks
- [ ] JWT authentication works
- [ ] Role-based access control enforced
- [ ] Health endpoint returns correct status

---

## Phase 10: Documentation & Delivery

### 10.1 User Documentation

**Substep 10.1.1**: Create `docs/user-guide.md`
- Getting started
- First-run setup
- Creating teams and users
- Configuring on-call schedules
- Handling incidents
- Swap shifts
- Admin features

**Substep 10.1.2**: Create `docs/admin-guide.md`
- Installation instructions
- Configuration reference
- Backup and restore
- Monitoring and troubleshooting
- Security best practices

### 10.2 API Documentation

**Substep 10.2.1**: Configure Swagger/OpenAPI
```csharp
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "alertblurty API",
        Version = "v1",
        Description = "On-call alert router for Zabbix 7.4"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

app.UseSwagger();
app.UseSwaggerUI(c =>
{
    c.SwaggerEndpoint("/swagger/v1/swagger.json", "alertblurty API v1");
});
```

**Substep 10.2.2**: Create `docs/api-reference.md`
- Authentication endpoints
- Webhook endpoints
- Incident management
- On-call management
- Team management
- User management
- Audit endpoints

### 10.3 Architecture Documentation

**Substep 10.3.1**: Create `docs/architecture.md`
- System overview diagram
- Database schema
- Service layer architecture
- Authentication flow
- Incident lifecycle
- Notification flow
- Deployment architecture

**Substep 10.3.2**: Create `docs/database-schema.md`
- ER diagram
- Table descriptions
- Relationship explanations
- Indexes and performance considerations

### 10.4 Operations Documentation

**Substep 10.4.1**: Create `docs/deployment.md`
- Docker deployment
- Kubernetes deployment
- Helm deployment
- AWS-specific setup
- DigitalOcean-specific setup

**Substep 10.4.2**: Create `docs/monitoring.md`
- Health check endpoints
- Metrics and counters
- Log aggregation
- Alerting setup

**Substep 10.4.3**: Create `docs/backup-restore.md`
- Database backup procedures
- Configuration backup
- Restore procedures
- Disaster recovery plan

### 10.5 Git Repository & Version Control

**Substep 10.5.1**: Initial Git Commit
```bash
# Add all project files
git add .

# Create initial commit
git commit -m "Initial commit: Complete alertblurty v1 implementation

- Project structure and solution files
- Database layer with EF Core migrations
- Core services (auth, incidents, notifications, on-call)
- API layer with controllers and middleware
- Blazor web UI with authentication
- Setup wizard
- Docker and Kubernetes manifests
- Comprehensive tests
- Complete documentation

🤖 Generated with Claude Code (https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Substep 10.5.2**: Create version tag
```bash
git tag -a v1.0.0 -m "alertblurty v1.0.0 - Initial Release"
```

**Substep 10.5.3**: (Optional) Push to remote repository
```bash
# Add remote if needed
git remote add origin <repository-url>

# Push commits and tags
git push origin master
git push origin v1.0.0
```

### 10.6 Final Delivery Package

**Substep 10.6.1**: Create release artifacts
- Docker image pushed to ECR
- Kubernetes manifests packaged
- Documentation compiled
- Release notes written

**Substep 10.6.2**: Create `CHANGELOG.md`
```markdown
# Changelog

## [1.0.0] - 2025-10-13

### Added
- Initial release of alertblurty v1
- Zabbix 7.4 webhook integration
- Twilio SMS notifications
- Incident grouping by host + trigger
- Bidirectional acknowledgment with Zabbix
- On-call scheduling with rotation
- Shift swap functionality
- Role-based access control
- Immutable audit logging
- Blazor web UI
- First-run setup wizard
- Docker containerization
- Kubernetes deployment manifests
- Comprehensive documentation
```

---

## Execution Order Summary

When entering EXECUTE mode, follow this order:

1. **Phase 1**: Initialize project structure, create solution and projects
2. **Phase 2**: Implement database layer (entities, DbContext, migrations)
3. **Phase 3**: Create all DTOs and service interfaces
4. **Phase 4**: Implement core services (auth, incidents, notifications, on-call)
5. **Phase 5**: Build API layer (controllers, middleware, health checks)
6. **Phase 6**: Create Blazor UI (pages, components, authentication)
7. **Phase 7**: Implement setup wizard
8. **Phase 8**: Containerize and create deployment manifests
9. **Phase 9**: Write and execute tests
10. **Phase 10**: Complete documentation and prepare delivery

---

## Dependencies Between Phases

- **Phase 2** depends on **Phase 1** (need project structure)
- **Phase 3** depends on **Phase 2** (DTOs reference entities)
- **Phase 4** depends on **Phase 2 & 3** (services use entities and interfaces)
- **Phase 5** depends on **Phase 4** (controllers call services)
- **Phase 6** depends on **Phase 5** (UI calls API endpoints)
- **Phase 7** depends on **Phase 5 & 6** (setup wizard uses API and UI components)
- **Phase 8** can be done in parallel with **Phase 9**
- **Phase 10** is final and depends on all others

---

## Success Criteria

✅ **Complete** when:
1. All code compiles without errors
2. All tests pass
3. Docker image builds successfully
4. Application deploys to Kubernetes
5. First-run setup wizard completes
6. Webhooks from Zabbix create incidents
7. SMS notifications are sent via Twilio
8. Incidents can be acknowledged
9. Zabbix receives acknowledgments
10. All documentation is complete

---

## Plan Status

**This plan is now ready for review and approval.**

Once approved, use `/riper:execute` to begin implementation, or `/riper:execute <substep>` to implement specific substeps (e.g., `/riper:execute 1.1.1` to create .gitignore first).

### Important Notes

- **Git Operations**: All git commits and version control operations have been moved to Phase 10 (substeps 10.5.1-10.5.3). This allows full implementation and testing before creating the initial commit.
- **Git Repository**: Git repository has already been initialized (during PLAN mode), but no commits will be made until Phase 10.
- **Development Flow**: Develop → Test → Document → Commit (in that order)

---

**End of Plan**
