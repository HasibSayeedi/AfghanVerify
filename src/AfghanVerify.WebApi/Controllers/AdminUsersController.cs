using System.Security.Claims;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.Infrastructure.Identity;
using AfghanVerify.WebApi.Dtos;
using AfghanVerify.WebApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Route("api/admin/users")]
[Authorize(Roles = "SUPER_ADMIN,UNIVERSITY_ADMIN")]
public sealed class AdminUsersController : ControllerBase
{
    private const string MinistryRole = "Ministry";
    private const string UniversityRole = "University";
    private const string SuperAdminRole = "SUPER_ADMIN";
    private const string UniversityAdminRole = "UNIVERSITY_ADMIN";
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;

    public AdminUsersController(UserManager<ApplicationUser> userManager, ApplicationDbContext db, AuditService audit)
    {
        _userManager = userManager;
        _db = db;
        _audit = audit;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<StaffUserDto>>> List(CancellationToken cancellationToken)
    {
        var universities = await _db.Universities.AsNoTracking()
            .ToDictionaryAsync(university => university.Id, university => university.NameEnglish, cancellationToken);
        var usersQuery = _userManager.Users.AsNoTracking().Where(user => !user.IsDeleted);
        if (!User.IsInRole(SuperAdminRole))
        {
            if (!TryGetUniversityScope(out var universityId)) return Forbid();
            if (!Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var currentUserId)) return Forbid();
            usersQuery = usersQuery.Where(user => user.UniversityId == universityId && user.Id != currentUserId);
        }
        var users = await usersQuery.OrderBy(user => user.DisplayName).ToListAsync(cancellationToken);
        var response = new List<StaffUserDto>();
        foreach (var user in users)
        {
            var roles = await _userManager.GetRolesAsync(user);
            var managedRole = roles.FirstOrDefault(IsManagedRole);
            if (managedRole is null) continue;
            response.Add(ToDto(user, managedRole, universities));
        }
        return Ok(response);
    }

    [HttpPost]
    public async Task<ActionResult<StaffUserDto>> Create(CreateStaffUserDto request, CancellationToken cancellationToken)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await _userManager.FindByEmailAsync(email) is not null)
        {
            ModelState.AddModelError(nameof(request.Email), "A user with this email address already exists.");
            return ValidationProblem(ModelState);
        }

        var identityRole = ToIdentityRole(request.Role);
        Guid? universityId = null;
        string? universityName = null;
        if (!User.IsInRole(SuperAdminRole))
        {
            if (!TryGetUniversityScope(out var scopedUniversityId)) return Forbid();
            if (identityRole != UniversityRole)
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "University administrators can create registrar accounts only." });
            universityId = scopedUniversityId;
        }
        else if (identityRole is UniversityRole or UniversityAdminRole)
        {
            if (!request.UniversityId.HasValue)
            {
                ModelState.AddModelError(nameof(request.UniversityId), "Select a university for this account.");
                return ValidationProblem(ModelState);
            }
            universityId = request.UniversityId.Value;
        }
        if (universityId.HasValue)
        {
            var university = await _db.Universities.AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == universityId && item.IsActive, cancellationToken);
            if (university is null)
            {
                ModelState.AddModelError(nameof(request.UniversityId), "The selected university does not exist or is inactive.");
                return ValidationProblem(ModelState);
            }
            universityName = university.NameEnglish;
        }

        var user = new ApplicationUser
        {
            Id = Guid.NewGuid(), UserName = email, Email = email, DisplayName = request.FullName.Trim(),
            UniversityId = universityId, EmailConfirmed = true, LockoutEnabled = true
        };
        var createResult = await _userManager.CreateAsync(user, request.Password);
        if (!createResult.Succeeded) return IdentityValidationProblem(createResult);
        var roleResult = await _userManager.AddToRoleAsync(user, identityRole);
        if (!roleResult.Succeeded)
        {
            await _userManager.DeleteAsync(user);
            return IdentityValidationProblem(roleResult);
        }

        _audit.Record("StaffAccountCreated", nameof(ApplicationUser), user.Id.ToString(),
            new { user.Email, Role = identityRole, user.UniversityId });
        await _db.SaveChangesAsync(cancellationToken);

        return Created($"/api/admin/users/{user.Id}", ToDto(user, identityRole,
            universityName is null || !universityId.HasValue ? [] : new Dictionary<Guid, string> { [universityId.Value] = universityName }));
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<StaffUserDto>> UpdateStatus(Guid id, UpdateStaffUserStatusDto request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null || user.IsDeleted) return NotFound(new { message = "The selected staff account was not found." });
        if (!CanManage(user)) return Forbid();
        if (!User.IsInRole(SuperAdminRole) && IsCurrentUser(id))
            return BadRequest(new { message = "You cannot change the status of your own administrator account." });
        var roles = await _userManager.GetRolesAsync(user);
        var managedRole = roles.FirstOrDefault(IsManagedRole);
        if (managedRole is null) return BadRequest(new { message = "Only Ministry and university staff accounts can be managed here." });

        var lockoutEnabledResult = await _userManager.SetLockoutEnabledAsync(user, true);
        if (!lockoutEnabledResult.Succeeded) return IdentityValidationProblem(lockoutEnabledResult);
        var lockoutResult = await _userManager.SetLockoutEndDateAsync(user, request.IsActive ? null : DateTimeOffset.MaxValue);
        if (!lockoutResult.Succeeded) return IdentityValidationProblem(lockoutResult);
        if (request.IsActive)
        {
            var resetResult = await _userManager.ResetAccessFailedCountAsync(user);
            if (!resetResult.Succeeded) return IdentityValidationProblem(resetResult);
        }

        _audit.Record(request.IsActive ? "StaffAccountActivated" : "StaffAccountDeactivated", nameof(ApplicationUser), user.Id.ToString(),
            new { user.Email, IsActive = request.IsActive });
        await _db.SaveChangesAsync(cancellationToken);

        var universities = user.UniversityId.HasValue
            ? await _db.Universities.AsNoTracking().Where(item => item.Id == user.UniversityId)
                .ToDictionaryAsync(item => item.Id, item => item.NameEnglish, cancellationToken)
            : [];
        return Ok(ToDto(user, managedRole, universities));
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<StaffUserDto>> Update(Guid id, UpdateStaffUserDto request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null || user.IsDeleted) return NotFound(new { message = "The selected staff account was not found." });
        if (!CanManage(user)) return Forbid();
        var roles = await _userManager.GetRolesAsync(user);
        var currentRole = roles.FirstOrDefault(IsManagedRole);
        if (currentRole is null) return BadRequest(new { message = "Only Ministry and university staff accounts can be managed here." });

        var email = request.Email.Trim().ToLowerInvariant();
        var duplicate = await _userManager.FindByEmailAsync(email);
        if (duplicate is not null && duplicate.Id != user.Id)
        {
            ModelState.AddModelError(nameof(request.Email), "A user with this email address already exists.");
            return ValidationProblem(ModelState);
        }

        var requestedRole = ToIdentityRole(request.Role);
        Guid? universityId = null;
        string? universityName = null;
        if (!User.IsInRole(SuperAdminRole))
        {
            if (!TryGetUniversityScope(out var scopedUniversityId)) return Forbid();
            if (!string.Equals(currentRole, requestedRole, StringComparison.OrdinalIgnoreCase))
                return StatusCode(StatusCodes.Status403Forbidden, new { message = "University administrators cannot change account roles." });
            universityId = scopedUniversityId;
        }
        else if (requestedRole is UniversityRole or UniversityAdminRole)
        {
            if (!request.UniversityId.HasValue)
            {
                ModelState.AddModelError(nameof(request.UniversityId), "Select a university for this account.");
                return ValidationProblem(ModelState);
            }
            universityId = request.UniversityId.Value;
        }
        if (universityId.HasValue)
        {
            var university = await _db.Universities.AsNoTracking()
                .SingleOrDefaultAsync(item => item.Id == universityId && item.IsActive, cancellationToken);
            if (university is null)
            {
                ModelState.AddModelError(nameof(request.UniversityId), "The selected university does not exist or is inactive.");
                return ValidationProblem(ModelState);
            }
            universityName = university.NameEnglish;
        }

        await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
        user.DisplayName = request.FullName.Trim();
        user.Email = email;
        user.UserName = email;
        user.UniversityId = universityId;
        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded) return IdentityValidationProblem(updateResult);
        if (!string.Equals(currentRole, requestedRole, StringComparison.OrdinalIgnoreCase))
        {
            var removeResult = await _userManager.RemoveFromRoleAsync(user, currentRole);
            if (!removeResult.Succeeded) return IdentityValidationProblem(removeResult);
            var addResult = await _userManager.AddToRoleAsync(user, requestedRole);
            if (!addResult.Succeeded) return IdentityValidationProblem(addResult);
        }
        if (!string.IsNullOrEmpty(request.Password))
        {
            var resetToken = await _userManager.GeneratePasswordResetTokenAsync(user);
            var passwordResult = await _userManager.ResetPasswordAsync(user, resetToken, request.Password);
            if (!passwordResult.Succeeded) return IdentityValidationProblem(passwordResult);
        }
        _audit.Record("StaffAccountUpdated", nameof(ApplicationUser), user.Id.ToString(),
            new { user.Email, Role = requestedRole, user.UniversityId, PasswordChanged = !string.IsNullOrEmpty(request.Password) });
        await _db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(ToDto(user, requestedRole,
            universityName is null || !universityId.HasValue ? [] : new Dictionary<Guid, string> { [universityId.Value] = universityName }));
    }

    [HttpPatch("{id:guid}/delete")]
    public async Task<IActionResult> SoftDelete(Guid id)
    {
        var user = await _userManager.FindByIdAsync(id.ToString());
        if (user is null || user.IsDeleted) return NotFound(new { message = "The selected staff account was not found." });
        if (!CanManage(user)) return Forbid();
        if (!User.IsInRole(SuperAdminRole) && IsCurrentUser(id))
            return BadRequest(new { message = "You cannot delete your own administrator account." });
        var roles = await _userManager.GetRolesAsync(user);
        if (!roles.Any(IsManagedRole))
            return BadRequest(new { message = "Only Ministry and university staff accounts can be managed here." });

        user.IsDeleted = true;
        user.LockoutEnabled = true;
        user.LockoutEnd = DateTimeOffset.MaxValue;
        var updateResult = await _userManager.UpdateAsync(user);
        if (!updateResult.Succeeded) return IdentityValidationProblem(updateResult);
        _audit.Record("StaffAccountSoftDeleted", nameof(ApplicationUser), user.Id.ToString(), new { user.Email });
        await _db.SaveChangesAsync();
        return NoContent();
    }

    private static StaffUserDto ToDto(ApplicationUser user, string identityRole, IReadOnlyDictionary<Guid, string> universities)
    {
        var role = identityRole switch
        {
            MinistryRole => "MINISTRY_ADMIN",
            UniversityAdminRole => "UNIVERSITY_ADMIN",
            _ => "UNIVERSITY_REGISTRAR"
        };
        var isInactive = user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow.AddYears(100);
        var universityName = user.UniversityId.HasValue && universities.TryGetValue(user.UniversityId.Value, out var name) ? name : null;
        return new StaffUserDto(user.Id, user.DisplayName, user.Email ?? user.UserName ?? "", role,
            user.UniversityId, universityName, !isInactive);
    }

    private ActionResult IdentityValidationProblem(IdentityResult result)
    {
        foreach (var error in result.Errors) ModelState.AddModelError(error.Code, error.Description);
        return ValidationProblem(ModelState);
    }

    private bool CanManage(ApplicationUser user)
    {
        if (User.IsInRole(SuperAdminRole)) return true;
        return TryGetUniversityScope(out var universityId) && user.UniversityId == universityId;
    }

    private bool TryGetUniversityScope(out Guid universityId) =>
        Guid.TryParse(User.FindFirstValue("university_id"), out universityId);

    private bool IsCurrentUser(Guid userId) =>
        Guid.TryParse(User.FindFirstValue(ClaimTypes.NameIdentifier), out var currentUserId) && currentUserId == userId;

    private static bool IsManagedRole(string role) =>
        role is MinistryRole or UniversityRole or UniversityAdminRole;

    private static string ToIdentityRole(string role) => role switch
    {
        "MINISTRY_ADMIN" => MinistryRole,
        "UNIVERSITY_ADMIN" => UniversityAdminRole,
        _ => UniversityRole
    };
}
