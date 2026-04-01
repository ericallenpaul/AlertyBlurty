using Microsoft.EntityFrameworkCore;
using alertblurty.Data.Entities;

namespace alertblurty.Data;

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

        // Apply all entity configurations from assembly
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
