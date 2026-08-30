using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AfghanVerify.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class FacultyAndPrefixedVerificationCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<string>(
                name: "Department",
                table: "Students",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(max)");

            migrationBuilder.AddColumn<string>(
                name: "Faculty",
                table: "Students",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "VerificationCode",
                table: "Certificates",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(8)",
                oldMaxLength: 8);

            migrationBuilder.AddColumn<int>(
                name: "SignatureVersion",
                table: "Certificates",
                type: "int",
                nullable: false,
                defaultValue: 1);

            migrationBuilder.Sql("UPDATE Universities SET Code = 'KBL' WHERE Id = '11111111-1111-1111-1111-111111111111';");
            migrationBuilder.Sql("UPDATE Universities SET Code = 'KD' WHERE Id = '55555555-5555-5555-5555-555555555555';");
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM Universities WHERE Id = '77777777-7777-7777-7777-777777777777')
                INSERT INTO Universities (Id, NameEnglish, NameDari, NamePashto, Code, Location, IsActive, LogoUrl, PrimaryColor, CurrentDiplomaSequence, CurrentTranscriptSequence)
                VALUES ('77777777-7777-7777-7777-777777777777', 'Kateb University', N'پوهنتون کاتب', N'کاتب پوهنتون', 'KAT', N'کابل', 1, '/assets/logos/kateb-logo.png', '#7c2d12', 0, 0);
                """);
            migrationBuilder.Sql("""
                IF NOT EXISTS (SELECT 1 FROM Universities WHERE Id = '88888888-8888-8888-8888-888888888888')
                INSERT INTO Universities (Id, NameEnglish, NameDari, NamePashto, Code, Location, IsActive, LogoUrl, PrimaryColor, CurrentDiplomaSequence, CurrentTranscriptSequence)
                VALUES ('88888888-8888-8888-8888-888888888888', 'Kardan University', N'پوهنتون کاردان', N'کاردان پوهنتون', 'KRD', N'کابل', 1, '/assets/logos/kardan-logo.png', '#1e3a8a', 0, 0);
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DELETE FROM Universities WHERE Id IN ('77777777-7777-7777-7777-777777777777', '88888888-8888-8888-8888-888888888888');");
            migrationBuilder.Sql("UPDATE Universities SET Code = 'KU' WHERE Id = '11111111-1111-1111-1111-111111111111';");
            migrationBuilder.Sql("UPDATE Universities SET Code = 'KDU' WHERE Id = '55555555-5555-5555-5555-555555555555';");
            migrationBuilder.DropColumn(
                name: "Faculty",
                table: "Students");

            migrationBuilder.DropColumn(
                name: "SignatureVersion",
                table: "Certificates");

            migrationBuilder.AlterColumn<string>(
                name: "Department",
                table: "Students",
                type: "nvarchar(max)",
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(200)",
                oldMaxLength: 200);

            migrationBuilder.AlterColumn<string>(
                name: "VerificationCode",
                table: "Certificates",
                type: "nvarchar(8)",
                maxLength: 8,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(16)",
                oldMaxLength: 16);
        }
    }
}
