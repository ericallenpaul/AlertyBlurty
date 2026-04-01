using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using alertblurty.Data.Entities;

namespace alertblurty.Data.Configurations;

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

        // Index for incident grouping by host + trigger + status
        builder.HasIndex(i => new { i.HostName, i.ZabbixTriggerId, i.Status })
            .HasDatabaseName("ix_incidents_grouping");

        builder.HasIndex(i => i.ZabbixEventId)
            .HasDatabaseName("ix_incidents_zabbix_event_id");

        builder.HasIndex(i => i.TeamId)
            .HasDatabaseName("ix_incidents_team_id");

        // Relationships
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
