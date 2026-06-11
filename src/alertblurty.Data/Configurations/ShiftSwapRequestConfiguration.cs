using alertblurty.Data.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace alertblurty.Data.Configurations;

public class ShiftSwapRequestConfiguration : IEntityTypeConfiguration<ShiftSwapRequest>
{
    public void Configure(EntityTypeBuilder<ShiftSwapRequest> builder)
    {
        builder.ToTable("shift_swap_requests");

        builder.HasKey(request => request.Id);

        builder.Property(request => request.RequesterNote)
            .HasMaxLength(1000);

        builder.Property(request => request.DecisionNote)
            .HasMaxLength(1000);

        builder.HasIndex(request => request.ShiftId)
            .HasDatabaseName("ix_shift_swap_requests_shift_id");

        builder.HasIndex(request => request.Status)
            .HasDatabaseName("ix_shift_swap_requests_status");

        builder.HasOne(request => request.Shift)
            .WithMany(shift => shift.SwapRequests)
            .HasForeignKey(request => request.ShiftId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasOne(request => request.RequestedByUser)
            .WithMany()
            .HasForeignKey(request => request.RequestedByUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(request => request.TargetUser)
            .WithMany()
            .HasForeignKey(request => request.TargetUserId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne(request => request.DecidedByUser)
            .WithMany()
            .HasForeignKey(request => request.DecidedByUserId)
            .OnDelete(DeleteBehavior.SetNull);
    }
}
