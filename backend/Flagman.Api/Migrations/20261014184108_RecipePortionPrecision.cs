using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flagman.Api.Migrations
{
    /// <inheritdoc />
    public partial class RecipePortionPrecision : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "QuantityPerPortion",
                table: "RecipeItems",
                type: "numeric(12,6)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,3)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<decimal>(
                name: "QuantityPerPortion",
                table: "RecipeItems",
                type: "numeric(12,3)",
                nullable: false,
                oldClrType: typeof(decimal),
                oldType: "numeric(12,6)");
        }
    }
}
