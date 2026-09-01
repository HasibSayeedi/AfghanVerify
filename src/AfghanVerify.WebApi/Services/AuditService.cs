using System.Security.Claims;
using System.Text.Json;
using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Data;

namespace AfghanVerify.WebApi.Services;

public sealed class AuditService
{
    private readonly ApplicationDbContext _db;
    private readonly IHttpContextAccessor _httpContextAccessor;

    public AuditService(ApplicationDbContext db, IHttpContextAccessor httpContextAccessor)
    {
        _db = db;
        _httpContextAccessor = httpContextAccessor;
    }

    public void Record(string action, string entityType, string? entityId = null, object? details = null)
    {
        var context = _httpContextAccessor.HttpContext;
        var user = context?.User;
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UserId = user?.FindFirstValue(ClaimTypes.NameIdentifier) ?? string.Empty,
            UserName = user?.Identity?.Name ?? string.Empty,
            Action = action,
            EntityType = entityType,
            EntityId = entityId ?? string.Empty,
            Details = details is null ? string.Empty : JsonSerializer.Serialize(details),
            IpAddress = context?.Connection.RemoteIpAddress?.ToString() ?? string.Empty,
            UserAgent = context?.Request.Headers.UserAgent.ToString() ?? string.Empty
        });
    }
}
