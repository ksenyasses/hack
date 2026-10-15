using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Flagman.Api.Migrations
{
    /// <inheritdoc />
    public partial class OrderServed : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ServedAt",
                table: "Orders",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ServedByUserId",
                table: "Orders",
                type: "integer",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ReadyByUserId",
                table: "OrderItems",
                type: "integer",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ServedAt",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ServedByUserId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ReadyByUserId",
                table: "OrderItems");
        }
    }
}
