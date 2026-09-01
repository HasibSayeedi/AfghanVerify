using System.Security.Cryptography;
using System.Data;
using System.Globalization;
using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.Infrastructure.Services;
using AfghanVerify.WebApi.Dtos;
using AfghanVerify.WebApi.Services;
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
    private readonly AuditService _audit;
    private readonly ILogger<CertificatesController> _logger;
    public CertificatesController(ApplicationDbContext db, CryptographyService cryptography, AuditService audit, ILogger<CertificatesController> logger)
    { _db = db; _cryptography = cryptography; _audit = audit; _logger = logger; }

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

        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, cancellationToken);
        Certificate? supersededCertificate = null;
        if (!string.IsNullOrWhiteSpace(dto.SupersedesVerificationCode))
        {
            var supersededCode = dto.SupersedesVerificationCode.Trim().ToUpperInvariant();
            supersededCertificate = await _db.Certificates.Include(c => c.Student)
                .SingleOrDefaultAsync(c => c.VerificationCode == supersededCode, cancellationToken);
            if (supersededCertificate?.Student is null || supersededCertificate.Student.UniversityId != dto.UniversityId)
                return NotFound(new { message = "The credential being replaced was not found for this university." });
            if (supersededCertificate.Status is not (CertificateStatuses.Verified or CertificateStatuses.Suspended))
                return Conflict(new { message = "Only a verified or suspended credential can be replaced." });
            if (await _db.Certificates.AnyAsync(c => c.SupersedesCertificateId == supersededCertificate.Id
                    && c.Status != CertificateStatuses.Rejected && c.Status != CertificateStatuses.Revoked, cancellationToken))
                return Conflict(new { message = "A replacement credential is already pending or active for this record." });
        }

        var duplicateExists = await _db.Certificates.AsNoTracking().AnyAsync(c =>
            c.Student != null && c.Student.UniversityId == dto.UniversityId
            && c.Student.TazkiraNumber == dto.TazkiraNumber.Trim()
            && c.Student.GraduationYear == dto.GraduationYear
            && c.DocumentType == dto.DocumentType
            && c.Id != (supersededCertificate == null ? Guid.Empty : supersededCertificate.Id)
            && c.Status != CertificateStatuses.Rejected
            && c.Status != CertificateStatuses.Revoked
            && c.Status != CertificateStatuses.Superseded
            && c.Status != CertificateStatuses.Cancelled, cancellationToken);
        if (duplicateExists)
            return Conflict(new { message = "An active or pending credential already exists for this student, university, document type, and graduation year." });

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

        var certificate = new Certificate
        {
            Id = Guid.NewGuid(), StudentId = student.Id, DocumentType = dto.DocumentType,
            DiplomaFileUrl = dto.DiplomaFileUrl?.Trim() ?? "", TranscriptFileUrl = dto.TranscriptFileUrl?.Trim() ?? "",
            Gpa = dto.Gpa.Trim(), IssueDate = DateTime.UtcNow, IssuanceSystem = dto.IssuanceSystem,
            LegacyMaktoubNumber = dto.LegacyMaktoubNumber?.Trim() ?? "", Status = CertificateStatuses.PendingMinistry, SignatureVersion = 5,
            SigningKeyId = _cryptography.ActiveKeyId,
            SupersedesCertificateId = supersededCertificate?.Id,
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
        _audit.Record("CredentialIssued", nameof(Certificate), certificate.Id.ToString(), new
        {
            certificate.VerificationCode, certificate.DocumentType, certificate.Status, certificate.SupersedesCertificateId,
            UniversityId = dto.UniversityId
        });
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Created($"/api/verify/{certificate.VerificationCode}", new
        { message = "Academic record issued successfully.", verificationCode = certificate.VerificationCode, digitalSignature = certificate.DigitalHash });
    }

    [HttpGet("issued")]
    public async Task<ActionResult<IReadOnlyList<UniversityIssuedCredentialDto>>> Issued(CancellationToken cancellationToken)
    {
        if (!TryGetAuthorizedUniversityId(out var universityId)) return Forbid();
        var records = await _db.Certificates.AsNoTracking()
            .Where(c => c.Student != null && c.Student.UniversityId == universityId)
            .OrderByDescending(c => c.IssueDate)
            .Take(250)
            .Select(c => new UniversityIssuedCredentialDto(
                c.VerificationCode, c.Status, c.IssueDate,
                c.Student!.FirstName, c.Student.LastName, c.Student.FatherName, c.Student.TazkiraNumber,
                c.Student.UniversityId, c.Student.FacultyId ?? Guid.Empty, c.Student.DepartmentId ?? Guid.Empty,
                c.Student.Faculty, c.Student.Department, c.Student.GraduationYear,
                c.DocumentType, c.Gpa, c.Student.ProfilePicture, c.IssuanceSystem, c.LegacyMaktoubNumber,
                c.DiplomaFileUrl, c.TranscriptFileUrl,
                c.SupersedesCertificate == null ? null : c.SupersedesCertificate.VerificationCode,
                c.Student.Grades.OrderBy(g => g.SemesterNumber).ThenBy(g => g.SubjectName)
                    .Select(g => new SubjectGradeDto(g.SubjectName, g.SemesterNumber, g.Score, g.CreditHours)).ToList()))
            .ToListAsync(cancellationToken);
        return Ok(records);
    }

    [HttpPut("{code}/pending")]
    public async Task<IActionResult> UpdatePending(string code, UpdatePendingCertificateDto dto, CancellationToken cancellationToken)
    {
        if (!TryGetAuthorizedUniversityId(out var universityId)) return Forbid();
        var normalizedCode = code.Trim().ToUpperInvariant();
        var certificate = await _db.Certificates
            .Include(c => c.Student)!.ThenInclude(s => s!.Grades)
            .SingleOrDefaultAsync(c => c.VerificationCode == normalizedCode
                && c.Student != null && c.Student.UniversityId == universityId, cancellationToken);
        if (certificate?.Student is null) return NotFound(new { message = "The credential was not found for your university." });
        if (certificate.Status != CertificateStatuses.PendingMinistry)
            return Conflict(new { message = "Only a credential awaiting Ministry review can be corrected. Verified and finalized records must use the replacement workflow." });

        var department = await _db.Departments.Include(d => d.Faculty)
            .SingleOrDefaultAsync(d => d.Id == dto.DepartmentId && d.FacultyId == dto.FacultyId && d.IsActive
                && d.Faculty != null && d.Faculty.UniversityId == universityId && d.Faculty.IsActive, cancellationToken);
        if (department?.Faculty is null)
            return BadRequest(new { message = "Select a valid faculty and department for your university." });
        if (!ValidatePendingRules(dto, department.Faculty.Name)) return ValidationProblem(ModelState);

        var duplicateExists = await _db.Certificates.AsNoTracking().AnyAsync(c => c.Id != certificate.Id
            && c.Student != null && c.Student.UniversityId == universityId
            && c.Student.TazkiraNumber == dto.TazkiraNumber.Trim()
            && c.Student.GraduationYear == dto.GraduationYear && c.DocumentType == dto.DocumentType
            && c.Status != CertificateStatuses.Rejected && c.Status != CertificateStatuses.Revoked
            && c.Status != CertificateStatuses.Superseded && c.Status != CertificateStatuses.Cancelled, cancellationToken);
        if (duplicateExists)
            return Conflict(new { message = "Another active or pending credential already exists for this student, document type, and graduation year." });

        var student = certificate.Student;
        var previous = new
        {
            StudentName = $"{student.FirstName} {student.LastName}", student.FatherName,
            student.Faculty, student.Department, student.GraduationYear, certificate.DocumentType, certificate.Gpa
        };
        student.FirstName = dto.FirstName.Trim();
        student.LastName = dto.LastName.Trim();
        student.FatherName = dto.FatherName.Trim();
        student.TazkiraNumber = dto.TazkiraNumber.Trim();
        student.FacultyId = department.FacultyId;
        student.DepartmentId = department.Id;
        student.Faculty = department.Faculty.Name;
        student.Department = department.Name;
        student.GraduationYear = dto.GraduationYear;
        student.ProfilePicture = dto.ProfilePicture?.Trim() ?? string.Empty;

        certificate.DocumentType = dto.DocumentType;
        certificate.Gpa = dto.Gpa.Trim();
        certificate.IssuanceSystem = dto.IssuanceSystem;
        certificate.LegacyMaktoubNumber = dto.LegacyMaktoubNumber?.Trim() ?? string.Empty;
        certificate.DiplomaFileUrl = dto.DiplomaFileUrl?.Trim() ?? string.Empty;
        certificate.TranscriptFileUrl = dto.TranscriptFileUrl?.Trim() ?? string.Empty;
        certificate.SignatureVersion = 5;
        certificate.SigningKeyId = _cryptography.ActiveKeyId;

        var existingGrades = student.Grades.OrderBy(g => g.SemesterNumber).ThenBy(g => g.SubjectName).ThenBy(g => g.Id).ToList();
        var incomingSubjects = (dto.Subjects ?? []).ToList();
        for (var index = 0; index < incomingSubjects.Count; index++)
        {
            var subject = incomingSubjects[index];
            if (index < existingGrades.Count)
            {
                existingGrades[index].SubjectName = subject.SubjectName.Trim();
                existingGrades[index].SemesterNumber = subject.SemesterNumber;
                existingGrades[index].Score = subject.Score;
                existingGrades[index].CreditHours = subject.CreditHours.Trim();
            }
            else
            {
                student.Grades.Add(new Grade
                {
                    Id = Guid.NewGuid(), StudentId = student.Id, SubjectName = subject.SubjectName.Trim(),
                    SemesterNumber = subject.SemesterNumber, Score = subject.Score, CreditHours = subject.CreditHours.Trim()
                });
            }
        }
        foreach (var obsoleteGrade in existingGrades.Skip(incomingSubjects.Count))
        {
            student.Grades.Remove(obsoleteGrade);
            _db.Grades.Remove(obsoleteGrade);
        }
        certificate.DigitalHash = _cryptography.SignDocument(student, certificate);
        _db.VerificationRequests.Add(new VerificationRequest
        {
            Id = Guid.NewGuid(), CertificateId = certificate.Id, CreatedAt = DateTime.UtcNow,
            CurrentStep = "MinistryReview", Remarks = "The university corrected this pending credential and resubmitted its signed data."
        });
        _audit.Record("PendingCredentialCorrected", nameof(Certificate), certificate.Id.ToString(), new
        {
            certificate.VerificationCode, Previous = previous,
            Current = new { StudentName = $"{student.FirstName} {student.LastName}", student.Faculty, student.Department, student.GraduationYear, certificate.DocumentType, certificate.Gpa }
        });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException exception)
        {
            if (!await RetryWhenCredentialIsStillPendingAsync(exception, certificate, cancellationToken))
                return Conflict(new { message = "This credential changed while it was being edited. Refresh the issued records before trying again." });
        }
        return Ok(new { message = "The pending credential was corrected, re-signed, and returned to the Ministry review queue.", verificationCode = certificate.VerificationCode, digitalSignature = certificate.DigitalHash });
    }

    [HttpPost("{code}/cancel")]
    public async Task<IActionResult> CancelPending(string code, CancelPendingCertificateDto dto, CancellationToken cancellationToken)
    {
        if (!TryGetAuthorizedUniversityId(out var universityId)) return Forbid();
        var normalizedCode = code.Trim().ToUpperInvariant();
        var certificate = await _db.Certificates.Include(c => c.Student)
            .SingleOrDefaultAsync(c => c.VerificationCode == normalizedCode
                && c.Student != null && c.Student.UniversityId == universityId, cancellationToken);
        if (certificate is null) return NotFound(new { message = "The credential was not found for your university." });
        if (certificate.Status != CertificateStatuses.PendingMinistry)
            return Conflict(new { message = "Only a credential awaiting Ministry review can be cancelled by the university." });

        var reason = dto.Reason.Trim();
        if (reason.Length < 10)
        {
            ModelState.AddModelError(nameof(dto.Reason), "Provide a clear cancellation reason of at least 10 characters.");
            return ValidationProblem(ModelState);
        }
        certificate.Status = CertificateStatuses.Cancelled;
        _db.VerificationRequests.Add(new VerificationRequest
        {
            Id = Guid.NewGuid(), CertificateId = certificate.Id, CreatedAt = DateTime.UtcNow,
            CurrentStep = CertificateStatuses.Cancelled, Remarks = reason,
            ApprovedByUserId = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value ?? string.Empty
        });
        _audit.Record("PendingCredentialCancelled", nameof(Certificate), certificate.Id.ToString(),
            new { certificate.VerificationCode, Reason = reason, UniversityId = universityId });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException exception)
        {
            if (!await RetryWhenCredentialIsStillPendingAsync(exception, certificate, cancellationToken))
                return Conflict(new { message = "This credential changed before it could be cancelled. Refresh the issued records." });
        }
        return Ok(new { message = "The pending credential was cancelled and removed from the Ministry review queue.", status = certificate.Status });
    }

    private bool ValidatePendingRules(UpdatePendingCertificateDto dto, string facultyName)
    {
        var semesterLimit = facultyName.Contains("Medicine", StringComparison.OrdinalIgnoreCase)
            || facultyName.Contains("Medical", StringComparison.OrdinalIgnoreCase)
            || facultyName.Contains("Stomatology", StringComparison.OrdinalIgnoreCase) ? 14 : 8;
        if ((dto.Subjects ?? []).Any(subject => subject.SemesterNumber > semesterLimit))
            ModelState.AddModelError(nameof(dto.Subjects), $"Semester must be between 1 and {semesterLimit} for the selected faculty.");
        var requiresDiplomaUrl = dto.DocumentType is "Both" or "Diploma" or "DiplomaOnly";
        var requiresTranscriptUrl = dto.DocumentType is "Both" or "Transcript" or "TranscriptOnly";
        if (requiresDiplomaUrl && string.IsNullOrWhiteSpace(dto.DiplomaFileUrl))
            ModelState.AddModelError(nameof(dto.DiplomaFileUrl), "Diploma URL is required for the selected document type.");
        if (requiresTranscriptUrl && string.IsNullOrWhiteSpace(dto.TranscriptFileUrl))
            ModelState.AddModelError(nameof(dto.TranscriptFileUrl), "Transcript URL is required for the selected document type.");
        if (dto.IssuanceSystem == "Legacy" && string.IsNullOrWhiteSpace(dto.LegacyMaktoubNumber))
            ModelState.AddModelError(nameof(dto.LegacyMaktoubNumber), "A Maktoub number is required for legacy records.");
        return ModelState.IsValid;
    }

    private bool TryGetAuthorizedUniversityId(out Guid universityId) =>
        Guid.TryParse(User.FindFirst("university_id")?.Value, out universityId);

    private async Task<bool> RetryWhenCredentialIsStillPendingAsync(DbUpdateConcurrencyException exception,
        Certificate certificate, CancellationToken cancellationToken)
    {
        _logger.LogWarning(exception, "Concurrency conflict while updating credential {VerificationCode}. Conflicting entities: {Entities}",
            certificate.VerificationCode, string.Join(", ", exception.Entries.Select(entry => entry.Metadata.ClrType.Name)));
        if (exception.Entries.Count != 1 || exception.Entries[0].Entity != certificate) return false;
        var entry = exception.Entries[0];
        var databaseValues = await entry.GetDatabaseValuesAsync(cancellationToken);
        if (databaseValues is null || !string.Equals(databaseValues[nameof(Certificate.Status)] as string,
                CertificateStatuses.PendingMinistry, StringComparison.Ordinal)) return false;
        entry.OriginalValues.SetValues(databaseValues);
        try
        {
            await _db.SaveChangesAsync(cancellationToken);
            return true;
        }
        catch (DbUpdateConcurrencyException retryException)
        {
            _logger.LogWarning(retryException, "Credential {VerificationCode} changed again during the controlled retry.", certificate.VerificationCode);
            return false;
        }
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
