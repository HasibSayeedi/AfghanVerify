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

    public void Record(string action, string entityType, string? entityId = null, object? details = null,
        string? actorUserId = null, string? actorUserName = null, string? actorRole = null,
        string outcome = "Succeeded")
    {
        var context = _httpContextAccessor.HttpContext;
        var user = context?.User;
        var serializedDetails = details is null ? string.Empty : JsonSerializer.Serialize(details);
        _db.AuditLogs.Add(new AuditLog
        {
            Id = Guid.NewGuid(),
            CreatedAt = DateTime.UtcNow,
            UserId = Limit(actorUserId ?? user?.FindFirstValue(ClaimTypes.NameIdentifier), 128),
            UserName = Limit(actorUserName ?? user?.Identity?.Name, 256),
            ActorRole = Limit(actorRole ?? string.Join(", ", user?.FindAll(ClaimTypes.Role).Select(claim => claim.Value)
                ?? []), 256),
            Action = Limit(action, 100),
            EntityType = Limit(entityType, 100),
            EntityId = Limit(entityId, 128),
            Details = Limit(serializedDetails, 4000),
            Outcome = Limit(outcome, 32),
            IpAddress = Limit(context?.Connection.RemoteIpAddress?.ToString(), 64),
            UserAgent = Limit(context?.Request.Headers.UserAgent.ToString(), 512)
        });
    }

    private static string Limit(string? value, int maximumLength) => string.IsNullOrEmpty(value)
        ? string.Empty
        : value.Length <= maximumLength ? value : value[..maximumLength];
}
