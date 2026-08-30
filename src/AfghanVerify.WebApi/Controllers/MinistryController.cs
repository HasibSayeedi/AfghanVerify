using System.Security.Claims;
using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.Infrastructure.Services;
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
    public MinistryController(ApplicationDbContext db, IHubContext<NotificationHub> hub) { _db = db; _hub = hub; }

    [HttpGet("queue")]
    public async Task<IActionResult> Queue(CancellationToken cancellationToken) => Ok(await _db.Certificates.AsNoTracking()
        .Where(c => c.Status == "PendingMinistry").Include(c => c.Student)!.ThenInclude(s => s!.University).OrderBy(c => c.IssueDate)
        .Select(c => new { trackingCode = c.VerificationCode, studentName = c.Student!.FirstName + " " + c.Student.LastName,
            c.Student.FatherName, universityName = c.Student.University!.NameEnglish, c.Student.Faculty, c.Student.Department, c.DocumentType,
            gpa = c.Gpa, submittedAt = c.IssueDate, c.IssuanceSystem, c.LegacyMaktoubNumber }).ToListAsync(cancellationToken));

    public sealed record ReviewRequest(string Code, string Action, string? Remarks);

    [HttpPost("review")]
    public async Task<IActionResult> Review(ReviewRequest request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var certificate = await _db.Certificates.FirstOrDefaultAsync(c => c.VerificationCode == code, cancellationToken);
        if (certificate is null) return NotFound(new { message = "Certificate not found." });
        if (certificate.Status != "PendingMinistry") return Conflict(new { message = "This certificate has already received a final decision." });
        certificate.Status = request.Action.ToLowerInvariant() switch { "verify" => "Verified", "reject" => "Rejected", _ => "" };
        if (certificate.Status.Length == 0) return BadRequest(new { message = "Action must be 'verify' or 'reject'." });
        _db.VerificationRequests.Add(new VerificationRequest
        {
            Id = Guid.NewGuid(), CertificateId = certificate.Id, CreatedAt = DateTime.UtcNow, CurrentStep = certificate.Status,
            Remarks = request.Remarks?.Trim() ?? "", ApprovedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? ""
        });
        await _db.SaveChangesAsync(cancellationToken);
        await _hub.Clients.Group(code).SendAsync("ReceiveStatusUpdate",
            new { status = certificate.Status, remarks = request.Remarks?.Trim() ?? "" }, cancellationToken);
        return Ok(new { message = $"Certificate status updated to {certificate.Status}.", status = certificate.Status });
    }
}
