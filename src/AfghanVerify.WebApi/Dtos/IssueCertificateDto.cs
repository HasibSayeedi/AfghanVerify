using System.ComponentModel.DataAnnotations;
using System.Globalization;
using System.Text;

namespace AfghanVerify.WebApi.Dtos;

public sealed record SubjectGradeDto([param: Required, StringLength(200), RegularExpression(@".*\S.*", ErrorMessage = "Course name is required.")] string SubjectName,
    [param: Range(1, 14)] int SemesterNumber, [param: Range(0, 100)] int Score,
    [param: Required, RegularExpression("^[1-6]$", ErrorMessage = "Credit hours must be a whole number between 1 and 6.")] string CreditHours);

public sealed record IssueCertificateDto(
    [param: Required, StringLength(100), AfghanPersonName] string FirstName,
    [param: Required, StringLength(100), AfghanPersonName] string LastName,
    [param: Required, StringLength(100), AfghanPersonName] string FatherName,
    [param: Required(ErrorMessage = "Tazkira number is required."), RegularExpression("^[0-9]{13}$", ErrorMessage = "Tazkira number must contain exactly 13 digits.")] string TazkiraNumber,
    Guid UniversityId,
    Guid FacultyId,
    Guid DepartmentId,
    [param: Range(2000, 2045)] int GraduationYear,
    [param: Required, RegularExpression("^(Both|Diploma|DiplomaOnly|Transcript|TranscriptOnly)$")] string DocumentType,
    [param: Required, RegularExpression(@"^(?:[1-3](?:\.\d{1,2})?|4(?:\.0{1,2})?)$", ErrorMessage = "GPA must be between 1.00 and 4.00 with no more than two decimal places.")] string Gpa,
    [param: OptionalImageHttpUrl, StringLength(2048)] string? ProfilePicture,
    [param: Required, RegularExpression("^(DigitalFirst|Legacy)$")] string IssuanceSystem,
    [param: StringLength(128)] string? LegacyMaktoubNumber,
    [param: OptionalHttpUrl, StringLength(2048)] string? DiplomaFileUrl,
    [param: OptionalHttpUrl, StringLength(2048)] string? TranscriptFileUrl,
    [param: MaxLength(500)] IReadOnlyList<SubjectGradeDto>? Subjects);

public sealed record LoginRequestDto([param: Required] string Username, [param: Required] string Password);
public sealed record DepartmentDto(Guid Id, string Name);
public sealed record FacultyDto(Guid Id, string Name, IReadOnlyList<DepartmentDto> Departments);
public sealed record UniversityDto(Guid Id, string NameEnglish, string NameDari, string NamePashto, string Code, string LogoUrl,
    string PrimaryColor, IReadOnlyList<FacultyDto> Faculties);

[AttributeUsage(AttributeTargets.Parameter | AttributeTargets.Property)]
public class OptionalHttpUrlAttribute : ValidationAttribute
{
    public override bool IsValid(object? value)
    {
        if (value is null || value is string { Length: 0 }) return true;
        if (value is not string text || string.IsNullOrWhiteSpace(text)) return true;
        return Uri.TryCreate(text.Trim(), UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttps || uri.Scheme == Uri.UriSchemeHttp);
    }

    public override string FormatErrorMessage(string name) => $"{name} must be an absolute HTTP or HTTPS URL.";
}

public sealed class OptionalImageHttpUrlAttribute : OptionalHttpUrlAttribute
{
    private static readonly string[] AllowedExtensions = [".jpg", ".jpeg", ".png"];

    public override bool IsValid(object? value)
    {
        if (!base.IsValid(value)) return false;
        if (value is not string text || string.IsNullOrWhiteSpace(text)) return true;
        var uri = new Uri(text.Trim(), UriKind.Absolute);
        return AllowedExtensions.Any(extension => uri.AbsolutePath.EndsWith(extension, StringComparison.OrdinalIgnoreCase));
    }

    public override string FormatErrorMessage(string name) => $"{name} must be an HTTP or HTTPS image URL ending in .jpg, .jpeg, or .png.";
}

public sealed class AfghanPersonNameAttribute : ValidationAttribute
{
    public override bool IsValid(object? value)
    {
        if (value is not string text || string.IsNullOrWhiteSpace(text)) return false;
        var hasLetter = false;
        foreach (var rune in text.EnumerateRunes())
        {
            if (rune.Value == ' ') continue;
            var category = Rune.GetUnicodeCategory(rune);
            if (category is UnicodeCategory.NonSpacingMark or UnicodeCategory.SpacingCombiningMark or UnicodeCategory.EnclosingMark) continue;
            if (!Rune.IsLetter(rune) || !IsLatinOrArabic(rune.Value)) return false;
            hasLetter = true;
        }
        return hasLetter;
    }

    private static bool IsLatinOrArabic(int value) =>
        value is >= 0x0041 and <= 0x007A or >= 0x00C0 and <= 0x024F or >= 0x1E00 and <= 0x1EFF
            or >= 0x0600 and <= 0x06FF or >= 0x0750 and <= 0x077F or >= 0x08A0 and <= 0x08FF
            or >= 0xFB50 and <= 0xFDFF or >= 0xFE70 and <= 0xFEFF;

    public override string FormatErrorMessage(string name) => $"{name} may contain only Latin or Arabic-script letters and spaces.";
}
