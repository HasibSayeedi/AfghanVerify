using System.Security.Claims;
using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.Infrastructure.Services;
using AfghanVerify.WebApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Route("api/ministry")]
[Authorize(Roles = "Ministry")]
public sealed class MinistryController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    private readonly IHubContext<NotificationHub> _hub;
    private readonly AuditService _audit;
    public MinistryController(ApplicationDbContext db, IHubContext<NotificationHub> hub, AuditService audit)
    { _db = db; _hub = hub; _audit = audit; }

    [HttpGet("queue")]
    public async Task<IActionResult> Queue(CancellationToken cancellationToken) => Ok(await _db.Certificates.AsNoTracking()
        .Where(c => c.Status == CertificateStatuses.PendingMinistry).Include(c => c.Student)!.ThenInclude(s => s!.University).OrderBy(c => c.IssueDate)
        .Select(c => new { trackingCode = c.VerificationCode, studentName = c.Student!.FirstName + " " + c.Student.LastName,
            c.Student.FatherName, universityName = c.Student.University!.NameEnglish, c.Student.Faculty, c.Student.Department, c.DocumentType,
            gpa = c.Gpa, submittedAt = c.IssueDate, c.IssuanceSystem, c.LegacyMaktoubNumber }).ToListAsync(cancellationToken));

    [HttpGet("history")]
    public async Task<IActionResult> History(CancellationToken cancellationToken)
    {
        var records = await _db.Certificates.AsNoTracking()
            .Where(c => c.Status == CertificateStatuses.Verified || c.Status == CertificateStatuses.Rejected
                || c.Status == CertificateStatuses.Suspended || c.Status == CertificateStatuses.Revoked || c.Status == CertificateStatuses.Superseded)
            .Select(c => new
            {
                trackingCode = c.VerificationCode,
                studentName = c.Student!.FirstName + " " + c.Student.LastName,
                c.Student.FatherName,
                universityName = c.Student.University!.NameEnglish,
                c.Student.Faculty,
                c.Student.Department,
                c.DocumentType,
                gpa = c.Gpa,
                submittedAt = c.IssueDate,
                c.IssuanceSystem,
                c.LegacyMaktoubNumber,
                status = c.Status == CertificateStatuses.Verified ? "Approved" : c.Status,
                reviewedAt = _db.VerificationRequests
                    .Where(r => r.CertificateId == c.Id && r.CurrentStep != "MinistryReview")
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => (DateTime?)r.CreatedAt)
                    .FirstOrDefault(),
                remarks = _db.VerificationRequests
                    .Where(r => r.CertificateId == c.Id && r.CurrentStep != "MinistryReview")
                    .OrderByDescending(r => r.CreatedAt)
                    .Select(r => r.Remarks)
                    .FirstOrDefault()
            })
            .OrderByDescending(record => record.reviewedAt ?? record.submittedAt)
            .Take(500)
            .ToListAsync(cancellationToken);

        return Ok(records);
    }

    [HttpGet("history-page")]
    public async Task<IActionResult> HistoryPage([FromQuery] int page = 1, [FromQuery] int pageSize = 25,
        [FromQuery] string? query = null, [FromQuery] string? status = null, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var certificates = _db.Certificates.AsNoTracking().Where(c =>
            c.Status == CertificateStatuses.Verified || c.Status == CertificateStatuses.Rejected
            || c.Status == CertificateStatuses.Suspended || c.Status == CertificateStatuses.Revoked
            || c.Status == CertificateStatuses.Superseded);
        if (!string.IsNullOrWhiteSpace(status))
        {
            var normalizedStatus = status.Trim();
            if (normalizedStatus.Equals("Approved", StringComparison.OrdinalIgnoreCase)) normalizedStatus = CertificateStatuses.Verified;
            certificates = certificates.Where(c => c.Status == normalizedStatus);
        }
        if (!string.IsNullOrWhiteSpace(query))
        {
            var normalizedQuery = query.Trim();
            certificates = certificates.Where(c => c.VerificationCode.Contains(normalizedQuery)
                || (c.Student != null && (c.Student.FirstName.Contains(normalizedQuery)
                    || c.Student.LastName.Contains(normalizedQuery)
                    || (c.Student.University != null && c.Student.University.NameEnglish.Contains(normalizedQuery)))));
        }
        var totalCount = await certificates.CountAsync(cancellationToken);
        var items = await certificates
            .Select(c => new
            {
                trackingCode = c.VerificationCode,
                studentName = c.Student!.FirstName + " " + c.Student.LastName,
                c.Student.FatherName,
                universityName = c.Student.University!.NameEnglish,
                c.Student.Faculty, c.Student.Department, c.DocumentType, gpa = c.Gpa, submittedAt = c.IssueDate,
                c.IssuanceSystem, c.LegacyMaktoubNumber,
                status = c.Status == CertificateStatuses.Verified ? "Approved" : c.Status,
                reviewedAt = _db.VerificationRequests.Where(r => r.CertificateId == c.Id && r.CurrentStep != "MinistryReview")
                    .OrderByDescending(r => r.CreatedAt).Select(r => (DateTime?)r.CreatedAt).FirstOrDefault(),
                remarks = _db.VerificationRequests.Where(r => r.CertificateId == c.Id && r.CurrentStep != "MinistryReview")
                    .OrderByDescending(r => r.CreatedAt).Select(r => r.Remarks).FirstOrDefault()
            })
            .OrderByDescending(record => record.reviewedAt ?? record.submittedAt)
            .Skip((page - 1) * pageSize).Take(pageSize).ToListAsync(cancellationToken);
        return Ok(new { items, totalCount, page, pageSize, totalPages = (int)Math.Ceiling(totalCount / (double)pageSize) });
    }

    [HttpGet("statistics")]
    public async Task<IActionResult> Statistics([FromQuery] string period = "week", CancellationToken cancellationToken = default)
    {
        var normalizedPeriod = period.Trim().ToLowerInvariant();
        var now = DateTime.UtcNow;
        var today = now.Date;
        var startsAt = normalizedPeriod switch
        {
            "week" => today.AddDays(-(((int)today.DayOfWeek + 6) % 7)),
            "month" => new DateTime(today.Year, today.Month, 1, 0, 0, 0, DateTimeKind.Utc),
            "year" => new DateTime(today.Year, 1, 1, 0, 0, 0, DateTimeKind.Utc),
            _ => default
        };

        if (startsAt == default)
            return BadRequest(new { message = "Period must be 'week', 'month', or 'year'." });

        var awaitingReview = await _db.Certificates.AsNoTracking()
            .CountAsync(c => c.Status == CertificateStatuses.PendingMinistry && c.IssueDate >= startsAt && c.IssueDate <= now, cancellationToken);
        var rejected = await _db.VerificationRequests.AsNoTracking()
            .CountAsync(r => r.CurrentStep == "Rejected" && r.CreatedAt >= startsAt && r.CreatedAt <= now, cancellationToken);
        var approved = await _db.VerificationRequests.AsNoTracking()
            .CountAsync(r => r.CurrentStep == "Verified" && r.CreatedAt >= startsAt && r.CreatedAt <= now, cancellationToken);

        return Ok(new { period = normalizedPeriod, startsAt, generatedAt = now, awaitingReview, approved, rejected });
    }

    public sealed record ReviewRequest(string Code, string Action, string? Remarks);

    [HttpPost("review")]
    public async Task<IActionResult> Review(ReviewRequest request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var certificate = await _db.Certificates.Include(c => c.SupersedesCertificate)
            .FirstOrDefaultAsync(c => c.VerificationCode == code, cancellationToken);
        if (certificate is null) return NotFound(new { message = "Certificate not found." });
        if (certificate.Status != CertificateStatuses.PendingMinistry) return Conflict(new { message = "This certificate has already received a final decision." });
        var action = request.Action.Trim().ToLowerInvariant();
        if (action is not ("verify" or "reject")) return BadRequest(new { message = "Action must be 'verify' or 'reject'." });
        var remarks = request.Remarks?.Trim() ?? "";
        if (action == "reject" && remarks.Length == 0)
            return BadRequest(new { message = "An official decision note is required when rejecting a credential." });
        certificate.Status = action == "verify" ? CertificateStatuses.Verified : CertificateStatuses.Rejected;
        _db.VerificationRequests.Add(new VerificationRequest
        {
            Id = Guid.NewGuid(), CertificateId = certificate.Id, CreatedAt = DateTime.UtcNow, CurrentStep = certificate.Status,
            Remarks = remarks, ApprovedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? ""
        });
        if (action == "verify" && certificate.SupersedesCertificate is not null)
        {
            certificate.SupersedesCertificate.Status = CertificateStatuses.Superseded;
            _db.VerificationRequests.Add(new VerificationRequest
            {
                Id = Guid.NewGuid(), CertificateId = certificate.SupersedesCertificate.Id, CreatedAt = DateTime.UtcNow,
                CurrentStep = CertificateStatuses.Superseded,
                Remarks = $"Superseded by credential {certificate.VerificationCode}.",
                ApprovedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? ""
            });
        }
        _audit.Record(action == "verify" ? "CredentialApproved" : "CredentialRejected", nameof(Certificate), certificate.Id.ToString(),
            new { certificate.VerificationCode, certificate.Status, Remarks = remarks });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "This credential was changed by another reviewer. Refresh the queue before trying again." });
        }
        await _hub.Clients.Group(code).SendAsync("ReceiveStatusUpdate",
            new { status = certificate.Status, remarks }, cancellationToken);
        if (action == "verify" && certificate.SupersedesCertificate is not null)
            await _hub.Clients.Group(certificate.SupersedesCertificate.VerificationCode).SendAsync("ReceiveStatusUpdate",
                new { status = CertificateStatuses.Superseded, remarks = $"Replaced by {certificate.VerificationCode}." }, cancellationToken);
        return Ok(new { message = $"Certificate status updated to {certificate.Status}.", status = certificate.Status });
    }

    public sealed record LifecycleRequest(string Code, string Action, string Reason);

    [HttpPost("lifecycle")]
    public async Task<IActionResult> UpdateLifecycle(LifecycleRequest request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var action = request.Action.Trim().ToLowerInvariant();
        var reason = request.Reason.Trim();
        if (reason.Length < 10) return BadRequest(new { message = "A lifecycle decision reason of at least 10 characters is required." });
        var certificate = await _db.Certificates.SingleOrDefaultAsync(c => c.VerificationCode == code, cancellationToken);
        if (certificate is null) return NotFound(new { message = "Certificate not found." });

        var nextStatus = (certificate.Status, action) switch
        {
            (CertificateStatuses.Verified, "suspend") => CertificateStatuses.Suspended,
            (CertificateStatuses.Verified, "revoke") => CertificateStatuses.Revoked,
            (CertificateStatuses.Suspended, "reinstate") => CertificateStatuses.Verified,
            (CertificateStatuses.Suspended, "revoke") => CertificateStatuses.Revoked,
            _ => null
        };
        if (nextStatus is null)
            return Conflict(new { message = $"Action '{action}' is not allowed while the credential is {certificate.Status}." });

        certificate.Status = nextStatus;
        _db.VerificationRequests.Add(new VerificationRequest
        {
            Id = Guid.NewGuid(), CertificateId = certificate.Id, CreatedAt = DateTime.UtcNow, CurrentStep = nextStatus,
            Remarks = reason, ApprovedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty
        });
        _audit.Record($"Credential{nextStatus}", nameof(Certificate), certificate.Id.ToString(),
            new { certificate.VerificationCode, Status = nextStatus, Reason = reason });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "This credential was changed by another reviewer. Refresh before trying again." });
        }
        await _hub.Clients.Group(code).SendAsync("ReceiveStatusUpdate", new { status = nextStatus, remarks = reason }, cancellationToken);
        return Ok(new { message = $"Credential status updated to {nextStatus}.", status = nextStatus });
    }
}
