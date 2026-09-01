using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.Infrastructure.Services;
using AfghanVerify.WebApi.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Route("api")]
[AllowAnonymous]
public sealed class VerificationController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CryptographyService _cryptography;
    public VerificationController(ApplicationDbContext db, CryptographyService cryptography) { _db = db; _cryptography = cryptography; }

    [HttpGet("verify/{token}")]
    [EnableRateLimiting("public-verification")]
    public async Task<IActionResult> Verify(string token, CancellationToken cancellationToken)
    {
        var code = NormalizeCode(token);
        if (code is null) return BadRequest(new { message = "A valid university-prefixed verification code is required." });
        var certificate = await _db.Certificates.AsNoTracking().Include(c => c.Student)!.ThenInclude(s => s!.University)
            .Include(c => c.Student)!.ThenInclude(s => s!.Grades).FirstOrDefaultAsync(c => c.VerificationCode == code, cancellationToken);
        if (certificate?.Student is null) return NotFound(new { message = "No academic document was found for this code." });
        var latestLog = await _db.VerificationRequests.AsNoTracking().Where(r => r.CertificateId == certificate.Id)
            .OrderByDescending(r => r.CreatedAt).FirstOrDefaultAsync(cancellationToken);
        var university = certificate.Student.University;
        var signatureValid = _cryptography.VerifyDocument(certificate.Student, certificate);
        var detailsAvailable = signatureValid && CertificateStatuses.IsPubliclyTrusted(certificate.Status);
        return Ok(new
        {
            detailsAvailable,
            studentName = detailsAvailable ? $"{certificate.Student.FirstName} {certificate.Student.LastName}".Trim() : null,
            fatherName = detailsAvailable ? certificate.Student.FatherName : null,
            tazkiraNumber = detailsAvailable ? MaskTazkira(certificate.Student.TazkiraNumber) : null,
            profilePicture = detailsAvailable ? certificate.Student.ProfilePicture : null,
            faculty = detailsAvailable ? certificate.Student.Faculty : null,
            department = detailsAvailable ? certificate.Student.Department : null,
            graduationYear = detailsAvailable ? certificate.Student.GraduationYear : (int?)null,
            gpa = detailsAvailable ? certificate.Gpa : null,
            documentType = detailsAvailable ? certificate.DocumentType : null,
            certificate.Status, securitySignature = certificate.DigitalHash, certificate.SignatureVersion,
            certificate.SigningKeyId,
            signatureValid,
            issuedAt = certificate.IssueDate, certificate.VerificationCode,
            diplomaFileUrl = detailsAvailable ? certificate.DiplomaFileUrl : null,
            transcriptFileUrl = detailsAvailable ? certificate.TranscriptFileUrl : null,
            issuanceSystem = detailsAvailable ? certificate.IssuanceSystem : null,
            legacyMaktoubNumber = detailsAvailable && certificate.IssuanceSystem == "Legacy" ? certificate.LegacyMaktoubNumber : null,
            remarks = latestLog?.Remarks ?? "",
            supersedesVerificationCode = certificate.SupersedesCertificateId.HasValue
                ? await _db.Certificates.AsNoTracking().Where(c => c.Id == certificate.SupersedesCertificateId)
                    .Select(c => c.VerificationCode).FirstOrDefaultAsync(cancellationToken)
                : null,
            replacementVerificationCode = certificate.Status == CertificateStatuses.Superseded
                ? await _db.Certificates.AsNoTracking().Where(c => c.SupersedesCertificateId == certificate.Id && c.Status == CertificateStatuses.Verified)
                    .OrderByDescending(c => c.IssueDate).Select(c => c.VerificationCode).FirstOrDefaultAsync(cancellationToken)
                : null,
            university = university is null ? null : new UniversityDto(university.Id, university.NameEnglish, university.NameDari,
                university.NamePashto, university.Code, university.LogoUrl, university.PrimaryColor, []),
            transcript = detailsAvailable
                ? certificate.Student.Grades.OrderBy(g => g.SemesterNumber).Select(g => new { g.SubjectName, g.SemesterNumber, g.Score, g.CreditHours })
                : []
        });
    }

    [HttpGet("universities")]
    public async Task<IReadOnlyList<UniversityDto>> Universities(CancellationToken cancellationToken)
    {
        var universities = await _db.Universities.AsNoTracking().AsSplitQuery().Where(u => u.IsActive && u.Faculties.Any(f => f.IsActive))
            .Include(u => u.Faculties.Where(f => f.IsActive)).ThenInclude(f => f.Departments.Where(d => d.IsActive))
            .OrderBy(u => u.NameEnglish).ToListAsync(cancellationToken);
        return universities.Select(u => new UniversityDto(u.Id, u.NameEnglish, u.NameDari, u.NamePashto, u.Code, u.LogoUrl,
            u.PrimaryColor, u.Faculties.OrderBy(f => f.Name).Select(f => new FacultyDto(f.Id, f.Name,
                f.Departments.OrderBy(d => d.Name).Select(d => new DepartmentDto(d.Id, d.Name)).ToList())).ToList())).ToList();
    }

    [HttpGet("universities/{code}/logo")]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any)]
    public async Task<IActionResult> UniversityLogo(string code, CancellationToken cancellationToken)
    {
        var normalized = code.Trim().ToUpperInvariant();
        var university = await _db.Universities.AsNoTracking().Where(u => u.IsActive && u.Code == normalized)
            .Select(u => new { u.Code, u.NameEnglish, u.PrimaryColor }).SingleOrDefaultAsync(cancellationToken);
        if (university is null) return NotFound();
        var safeCode = System.Net.WebUtility.HtmlEncode(university.Code);
        var safeName = System.Net.WebUtility.HtmlEncode(university.NameEnglish);
        var safeColor = System.Net.WebUtility.HtmlEncode(university.PrimaryColor);
        var svg = $"""
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="{safeName} logo">
              <circle cx="128" cy="128" r="120" fill="#fffdf5" stroke="{safeColor}" stroke-width="10"/>
              <circle cx="128" cy="128" r="96" fill="none" stroke="#d4af37" stroke-width="4"/>
              <path d="M64 112 128 78l64 34-64 34-64-34Zm18 27v31c28 19 64 19 92 0v-31l-46 24-46-24Z" fill="{safeColor}"/>
              <text x="128" y="54" text-anchor="middle" font-family="Arial,sans-serif" font-size="24" font-weight="800" fill="{safeColor}">{safeCode}</text>
              <text x="128" y="214" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="#334155">ESTABLISHED IN AFGHANISTAN</text>
            </svg>
            """;
        return Content(svg, "image/svg+xml; charset=utf-8");
    }

    private static string? NormalizeCode(string token)
    {
        var value = Uri.UnescapeDataString(token).Trim().TrimStart('#').ToUpperInvariant();
        if (Uri.TryCreate(value, UriKind.Absolute, out var uri)) value = uri.Segments.Last().Trim('/').ToUpperInvariant();
        var parts = value.Split('-', StringSplitOptions.RemoveEmptyEntries);
        var valid = (value.Length == 8 && value.All(char.IsAsciiHexDigit))
            || (parts.Length == 2 && parts[0].Length is >= 2 and <= 4 && parts[0].All(char.IsAsciiLetterOrDigit)
                && ((parts[1].Length == 9 && parts[1].All(char.IsAsciiDigit))
                    || (parts[1].Length == 5 && parts[1].All(char.IsAsciiHexDigit))));
        return valid ? value : null;
    }

    private static string MaskTazkira(string value)
    {
        var digits = new string(value.Where(char.IsAsciiDigit).ToArray());
        if (digits.Length <= 4) return new string('*', digits.Length);
        return $"{new string('*', digits.Length - 4)}{digits[^4..]}";
    }
}
