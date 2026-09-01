using AfghanVerify.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Route("api/admin/audit-logs")]
[Authorize(Roles = "SUPER_ADMIN")]
public sealed class AuditLogsController : ControllerBase
{
    private readonly ApplicationDbContext _db;
    public AuditLogsController(ApplicationDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> List([FromQuery] int page = 1, [FromQuery] int pageSize = 50,
        [FromQuery] string? query = null, [FromQuery] string? action = null, CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);
        var logs = _db.AuditLogs.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(action))
        {
            var normalizedAction = action.Trim();
            logs = logs.Where(log => log.Action == normalizedAction);
        }
        if (!string.IsNullOrWhiteSpace(query))
        {
            var normalizedQuery = query.Trim();
            logs = logs.Where(log => log.UserName.Contains(normalizedQuery) || log.EntityId.Contains(normalizedQuery)
                || log.Action.Contains(normalizedQuery) || log.Details.Contains(normalizedQuery));
        }
        var totalCount = await logs.CountAsync(cancellationToken);
        var items = await logs.OrderByDescending(log => log.CreatedAt).ThenByDescending(log => log.Id)
            .Skip((page - 1) * pageSize).Take(pageSize)
            .Select(log => new
            {
                log.Id, log.CreatedAt, log.UserId, log.UserName, log.Action, log.EntityType,
                log.EntityId, log.Details, log.IpAddress, log.UserAgent
            }).ToListAsync(cancellationToken);
        return Ok(new { items, totalCount, page, pageSize, totalPages = (int)Math.Ceiling(totalCount / (double)pageSize) });
    }
}
