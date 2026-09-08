using System.ComponentModel.DataAnnotations;

namespace AfghanVerify.WebApi.Dtos;

public sealed record CreateUniversityDto(
    [param: Required, StringLength(200)] string OfficialName,
    [param: StringLength(200)] string? NameDari,
    [param: StringLength(200)] string? NamePashto,
    [param: Required, RegularExpression("^[A-Za-z]{2,4}$", ErrorMessage = "University code must contain 2 to 4 letters.")] string Code,
    [param: Required, StringLength(80)] string ShortName,
    [param: Required, RegularExpression("^(Public|Private)$")] string UniversityType,
    [param: Required, StringLength(100)] string Province,
    [param: Required, StringLength(100)] string City,
    [param: StringLength(150)] string? CampusBranch,
    [param: Required, StringLength(500)] string OfficialAddress,
    [param: Required, EmailAddress, StringLength(256)] string OfficialEmail,
    [param: Required, RegularExpression("^\\+?[0-9][0-9 ()-]{6,30}$", ErrorMessage = "Enter a valid official phone number.")] string OfficialPhoneNumber,
    [param: OptionalHttpUrl, StringLength(2048)] string? Website,
    bool IsActive,
    Guid? UniversityAdminUserId);

public sealed record UpdateUniversityDto(
    [param: Required, StringLength(200)] string OfficialName,
    [param: StringLength(200)] string? NameDari,
    [param: StringLength(200)] string? NamePashto,
    [param: Required, RegularExpression("^[A-Za-z]{2,4}$", ErrorMessage = "University code must contain 2 to 4 letters.")] string Code,
    [param: Required, StringLength(80)] string ShortName,
    [param: Required, RegularExpression("^(Public|Private)$")] string UniversityType,
    [param: Required, StringLength(100)] string Province,
    [param: Required, StringLength(100)] string City,
    [param: StringLength(150)] string? CampusBranch,
    [param: Required, StringLength(500)] string OfficialAddress,
    [param: Required, EmailAddress, StringLength(256)] string OfficialEmail,
    [param: Required, RegularExpression("^\\+?[0-9][0-9 ()-]{6,30}$", ErrorMessage = "Enter a valid official phone number.")] string OfficialPhoneNumber,
    [param: OptionalHttpUrl, StringLength(2048)] string? Website,
    bool IsActive,
    Guid? UniversityAdminUserId,
    [param: Required] string RowVersion);

public sealed record UpdateUniversityStatusDto(bool IsActive, [param: Required] string RowVersion);

public sealed record UniversityManagementDto(
    Guid Id, string OfficialName, string NameDari, string NamePashto, string Code, string ShortName,
    string UniversityType, string Province, string City, string CampusBranch, string OfficialAddress,
    string OfficialEmail, string OfficialPhoneNumber, string Website, string LogoUrl, bool IsActive,
    int UserCount, int StudentCount, int CredentialCount, int FacultyCount,
    Guid? AssignedAdminUserId, string? AssignedAdminName, string RowVersion);

public sealed record UniversityAdminOptionDto(
    Guid Id, string Name, string Email, Guid? UniversityId, string? UniversityName, bool IsActive);

public sealed record AcademicStructureDto(Guid UniversityId, string UniversityName,
    IReadOnlyList<ManagedFacultyDto> Faculties);

public sealed record ManagedFacultyDto(Guid Id, string Name, bool IsActive, int StudentCount,
    IReadOnlyList<ManagedDepartmentDto> Departments);

public sealed record ManagedDepartmentDto(Guid Id, string Name, bool IsActive, int StudentCount);

public sealed record CreateAcademicUnitDto([param: Required, StringLength(200)] string Name);

public sealed record UpdateAcademicUnitDto([param: Required, StringLength(200)] string Name);

public sealed record UpdateAcademicUnitStatusDto(bool IsActive);
