using System.ComponentModel.DataAnnotations;

namespace AfghanVerify.WebApi.Dtos;

public sealed record CreateStaffUserDto(
    [param: Required, StringLength(150)] string FullName,
    [param: Required, EmailAddress, StringLength(256)] string Email,
    [param: Required, MinLength(8), StringLength(128)] string Password,
    [param: Required, RegularExpression("^(MINISTRY_ADMIN|UNIVERSITY_ADMIN|UNIVERSITY_REGISTRAR)$")] string Role,
    Guid? UniversityId);

public sealed record UpdateStaffUserStatusDto(bool IsActive);

public sealed record UpdateStaffUserDto(
    [param: Required, StringLength(150)] string FullName,
    [param: Required, EmailAddress, StringLength(256)] string Email,
    [param: Required, RegularExpression("^(MINISTRY_ADMIN|UNIVERSITY_ADMIN|UNIVERSITY_REGISTRAR)$")] string Role,
    Guid? UniversityId,
    [param: MinLength(8), StringLength(128)] string? Password);

public sealed record StaffUserDto(Guid Id, string Name, string Email, string Role, Guid? UniversityId,
    string? AssignedUniversity, bool IsActive);
