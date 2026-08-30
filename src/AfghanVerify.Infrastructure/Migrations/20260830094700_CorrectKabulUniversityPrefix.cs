using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace AfghanVerify.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class CorrectKabulUniversityPrefix : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE Universities
                SET Code = 'KU', LogoUrl = '/api/universities/KU/logo'
                WHERE Code = 'KBL' AND NameEnglish = 'Kabul University';
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                UPDATE Universities
                SET Code = 'KBL', LogoUrl = '/api/universities/KBL/logo'
                WHERE Code = 'KU' AND NameEnglish = 'Kabul University';
                """);
        }
    }
}
