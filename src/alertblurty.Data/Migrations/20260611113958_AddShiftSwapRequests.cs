using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace alertblurty.Data.Migrations
{
    /// <inheritdoc />
    public partial class AddShiftSwapRequests : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "shift_swap_requests",
                schema: "public",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    ShiftId = table.Column<Guid>(type: "uuid", nullable: false),
                    RequestedByUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    TargetUserId = table.Column<Guid>(type: "uuid", nullable: false),
                    Status = table.Column<int>(type: "integer", nullable: false),
                    RequiresApprovalSnapshot = table.Column<bool>(type: "boolean", nullable: false),
                    RequestedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DecidedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true),
                    DecidedByUserId = table.Column<Guid>(type: "uuid", nullable: true),
                    RequesterNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    DecisionNote = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    UpdatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_shift_swap_requests", x => x.Id);
                    table.ForeignKey(
                        name: "FK_shift_swap_requests_OnCallShifts_ShiftId",
                        column: x => x.ShiftId,
                        principalSchema: "public",
                        principalTable: "OnCallShifts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_shift_swap_requests_users_DecidedByUserId",
                        column: x => x.DecidedByUserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_shift_swap_requests_users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_shift_swap_requests_users_TargetUserId",
                        column: x => x.TargetUserId,
                        principalSchema: "public",
                        principalTable: "users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_shift_swap_requests_DecidedByUserId",
                schema: "public",
                table: "shift_swap_requests",
                column: "DecidedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_shift_swap_requests_RequestedByUserId",
                schema: "public",
                table: "shift_swap_requests",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "ix_shift_swap_requests_shift_id",
                schema: "public",
                table: "shift_swap_requests",
                column: "ShiftId");

            migrationBuilder.CreateIndex(
                name: "ix_shift_swap_requests_status",
                schema: "public",
                table: "shift_swap_requests",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_shift_swap_requests_TargetUserId",
                schema: "public",
                table: "shift_swap_requests",
                column: "TargetUserId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "shift_swap_requests",
                schema: "public");
        }
    }
}
