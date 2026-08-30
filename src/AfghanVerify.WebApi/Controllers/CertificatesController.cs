using System.Security.Cryptography;
using System.Data;
using System.Globalization;
using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.Infrastructure.Services;
using AfghanVerify.WebApi.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Route("api/certificates")]
[Authorize(Roles = "University")]
public sealed class CertificatesController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly CryptographyService _cryptography;
    public CertificatesController(ApplicationDbContext db, CryptographyService cryptography) { _db = db; _cryptography = cryptography; }

    [HttpPost("issue")]
    public async Task<IActionResult> Issue(IssueCertificateDto dto, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(User.FindFirst("university_id")?.Value, out var authorizedUniversityId) || authorizedUniversityId != dto.UniversityId) return Forbid();
        var university = await _db.Universities.SingleOrDefaultAsync(u => u.Id == dto.UniversityId && u.IsActive, cancellationToken);
        if (university is null)
            return NotFound(new { message = "The selected university does not exist or is inactive." });
        var department = await _db.Departments
            .Include(d => d.Faculty)
            .SingleOrDefaultAsync(d => d.Id == dto.DepartmentId && d.FacultyId == dto.FacultyId && d.IsActive
                && d.Faculty != null && d.Faculty.UniversityId == dto.UniversityId && d.Faculty.IsActive, cancellationToken);
        if (department?.Faculty is null)
            return BadRequest(new { message = "Select a valid faculty and department for the issuing university." });
        var isMedicalFaculty = department.Faculty.Name.Contains("Medicine", StringComparison.OrdinalIgnoreCase)
            || department.Faculty.Name.Contains("Medical", StringComparison.OrdinalIgnoreCase)
            || department.Faculty.Name.Contains("Stomatology", StringComparison.OrdinalIgnoreCase);
        var semesterLimit = isMedicalFaculty ? 14 : 8;
        if ((dto.Subjects ?? []).Any(subject => subject.SemesterNumber > semesterLimit))
        {
            ModelState.AddModelError(nameof(dto.Subjects), $"Semester must be between 1 and {semesterLimit} for the selected faculty.");
            return ValidationProblem(ModelState);
        }
        var requiresDiplomaUrl = dto.DocumentType is "Both" or "Diploma" or "DiplomaOnly";
        var requiresTranscriptUrl = dto.DocumentType is "Both" or "Transcript" or "TranscriptOnly";
        if (requiresDiplomaUrl && string.IsNullOrWhiteSpace(dto.DiplomaFileUrl))
            ModelState.AddModelError(nameof(dto.DiplomaFileUrl), "Diploma URL is required for the selected document type.");
        if (requiresTranscriptUrl && string.IsNullOrWhiteSpace(dto.TranscriptFileUrl))
            ModelState.AddModelError(nameof(dto.TranscriptFileUrl), "Transcript URL is required for the selected document type.");
        if (!ModelState.IsValid) return ValidationProblem(ModelState);
        if (dto.IssuanceSystem == "Legacy" && string.IsNullOrWhiteSpace(dto.LegacyMaktoubNumber))
        {
            ModelState.AddModelError(nameof(dto.LegacyMaktoubNumber), "A Maktoub number is required for legacy records.");
            return ValidationProblem(ModelState);
        }

        var student = new Student
        {
            Id = Guid.NewGuid(), FirstName = dto.FirstName.Trim(), LastName = dto.LastName.Trim(), FatherName = dto.FatherName.Trim(),
            TazkiraNumber = dto.TazkiraNumber.Trim(), UniversityId = dto.UniversityId, FacultyId = department.FacultyId,
            DepartmentId = department.Id, Faculty = department.Faculty.Name, Department = department.Name,
            GraduationYear = dto.GraduationYear, ProfilePicture = dto.ProfilePicture?.Trim() ?? ""
        };
        var grades = (dto.Subjects ?? []).Select(subject => new Grade
        {
            Id = Guid.NewGuid(), StudentId = student.Id, SubjectName = subject.SubjectName.Trim(), SemesterNumber = subject.SemesterNumber,
            Score = subject.Score, CreditHours = subject.CreditHours.Trim()
        }).ToList();
        foreach (var grade in grades) student.Grades.Add(grade);

        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        var certificate = new Certificate
        {
            Id = Guid.NewGuid(), StudentId = student.Id, DocumentType = dto.DocumentType,
            DiplomaFileUrl = dto.DiplomaFileUrl?.Trim() ?? "", TranscriptFileUrl = dto.TranscriptFileUrl?.Trim() ?? "",
            Gpa = dto.Gpa.Trim(), IssueDate = DateTime.UtcNow, IssuanceSystem = dto.IssuanceSystem,
            LegacyMaktoubNumber = dto.LegacyMaktoubNumber?.Trim() ?? "", Status = "PendingMinistry", SignatureVersion = 3,
            VerificationCode = await GenerateUniqueCodeAsync(university.Code, cancellationToken)
        };
        certificate.DigitalHash = _cryptography.SignDocument(student, certificate);
        _db.Students.Add(student);
        _db.Certificates.Add(certificate);
        _db.Grades.AddRange(grades);
        _db.VerificationRequests.Add(new VerificationRequest
        {
            Id = Guid.NewGuid(), CertificateId = certificate.Id, CreatedAt = DateTime.UtcNow, CurrentStep = "MinistryReview",
            Remarks = "Document issued by the university and submitted for ministry review."
        });
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Created($"/api/verify/{certificate.VerificationCode}", new
        { message = "Academic record issued successfully.", verificationCode = certificate.VerificationCode, digitalSignature = certificate.DigitalHash });
    }

    private async Task<string> GenerateUniqueCodeAsync(string universityCode, CancellationToken cancellationToken)
    {
        var prefix = new string(universityCode.Trim().ToUpperInvariant().Where(char.IsAsciiLetterOrDigit).ToArray());
        if (prefix.Length is < 2 or > 4) throw new InvalidOperationException("The university must have a valid two-to-four character code.");
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var numericSequence = RandomNumberGenerator.GetInt32(0, 1_000_000_000).ToString("D9", CultureInfo.InvariantCulture);
            var code = $"{prefix}-{numericSequence}";
            if (!await _db.Certificates.AnyAsync(c => c.VerificationCode == code, cancellationToken)) return code;
        }
        throw new InvalidOperationException("Unable to allocate a unique verification code.");
    }
}
