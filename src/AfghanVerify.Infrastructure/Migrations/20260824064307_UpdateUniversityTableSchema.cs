using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace AfghanVerify.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class UpdateUniversityTableSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DeleteData(
                table: "Universities",
                keyColumn: "Id",
                keyValue: new Guid("11111111-1111-1111-1111-111111111111"));

            migrationBuilder.DeleteData(
                table: "Universities",
                keyColumn: "Id",
                keyValue: new Guid("22222222-2222-2222-2222-222222222222"));

            migrationBuilder.DeleteData(
                table: "Universities",
                keyColumn: "Id",
                keyValue: new Guid("33333333-3333-3333-3333-333333333333"));

            migrationBuilder.DeleteData(
                table: "Universities",
                keyColumn: "Id",
                keyValue: new Guid("44444444-4444-4444-4444-444444444444"));

            migrationBuilder.DeleteData(
                table: "Universities",
                keyColumn: "Id",
                keyValue: new Guid("55555555-5555-5555-5555-555555555555"));

            migrationBuilder.RenameColumn(
                name: "Name",
                table: "Universities",
                newName: "PrimaryColor");

            migrationBuilder.AddColumn<string>(
                name: "LogoUrl",
                table: "Universities",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NameDari",
                table: "Universities",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NameEnglish",
                table: "Universities",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "NamePashto",
                table: "Universities",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "LogoUrl",
                table: "Universities");

            migrationBuilder.DropColumn(
                name: "NameDari",
                table: "Universities");

            migrationBuilder.DropColumn(
                name: "NameEnglish",
                table: "Universities");

            migrationBuilder.DropColumn(
                name: "NamePashto",
                table: "Universities");

            migrationBuilder.RenameColumn(
                name: "PrimaryColor",
                table: "Universities",
                newName: "Name");

            migrationBuilder.InsertData(
                table: "Universities",
                columns: new[] { "Id", "Code", "CurrentDiplomaSequence", "CurrentTranscriptSequence", "IsActive", "Location", "Name" },
                values: new object[,]
                {
                    { new Guid("11111111-1111-1111-1111-111111111111"), "KU", 0L, 0L, true, "کابل", "پوهنتون کابل" },
                    { new Guid("22222222-2222-2222-2222-222222222222"), "HU", 0L, 0L, true, "هرات", "پوهنتون هرات" },
                    { new Guid("33333333-3333-3333-3333-333333333333"), "BU", 0L, 0L, true, "بلخ", "پوهنتون بلخ" },
                    { new Guid("44444444-4444-4444-4444-444444444444"), "NU", 0L, 0L, true, "ننگرهار", "پوهنتون ننگرهار" },
                    { new Guid("55555555-5555-5555-5555-555555555555"), "KDU", 0L, 0L, true, "قندهار", "پوهنتون قندهار" }
                });
        }
    }
}
