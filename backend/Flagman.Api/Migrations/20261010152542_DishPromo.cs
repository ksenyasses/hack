using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flagman.Api.Migrations
{
    /// <inheritdoc />
    public partial class DishPromo : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateOnly>(
                name: "PromoUntil",
                table: "Dishes",
                type: "date",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PromoUntil",
                table: "Dishes");
        }
    }
}
