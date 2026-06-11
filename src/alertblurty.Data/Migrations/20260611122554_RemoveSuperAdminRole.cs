using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace alertblurty.Data.Migrations
{
    /// <inheritdoc />
    public partial class RemoveSuperAdminRole : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("UPDATE public.users SET \"Role\" = 1 WHERE \"Role\" = 2;");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
        }
    }
}
