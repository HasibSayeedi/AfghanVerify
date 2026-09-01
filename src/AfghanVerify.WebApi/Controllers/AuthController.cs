using System.IdentityModel.Tokens.Jwt;
using System.Net.Mail;
using System.Security.Claims;
using System.Text;
using AfghanVerify.Infrastructure.Identity;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.WebApi.Configuration;
using AfghanVerify.WebApi.Dtos;
using AfghanVerify.WebApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.WebUtilities;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly SignInManager<ApplicationUser> _signInManager;
    private readonly JwtOptions _jwt;
    private readonly ApplicationDbContext _db;
    private readonly AuditService _audit;
    private readonly IPasswordRecoveryEmailSender _emailSender;
    private readonly PasswordRecoveryOptions _passwordRecovery;
    private readonly ILogger<AuthController> _logger;
    public AuthController(UserManager<ApplicationUser> userManager, SignInManager<ApplicationUser> signInManager,
        IOptions<JwtOptions> jwt, ApplicationDbContext db, AuditService audit,
        IPasswordRecoveryEmailSender emailSender, IOptions<PasswordRecoveryOptions> passwordRecovery,
        ILogger<AuthController> logger)
    {
        _userManager = userManager; _signInManager = signInManager; _jwt = jwt.Value; _db = db; _audit = audit;
        _emailSender = emailSender; _passwordRecovery = passwordRecovery.Value; _logger = logger;
    }

    [AllowAnonymous]
    [EnableRateLimiting("login")]
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequestDto request)
    {
        var user = await _userManager.FindByNameAsync(request.Username.Trim());
        if (user is null || user.IsDeleted) return Unauthorized(new { message = "Invalid email or password." });
        var passwordResult = await _signInManager.CheckPasswordSignInAsync(user, request.Password, lockoutOnFailure: true);
        if (!passwordResult.Succeeded)
            return Unauthorized(new { message = "Invalid email or password." });

        var roles = await _userManager.GetRolesAsync(user);
        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, user.Id.ToString()), new(JwtRegisteredClaimNames.UniqueName, user.UserName ?? ""),
            new(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString("N")), new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Name, user.UserName ?? "")
        };
        claims.AddRange(roles.Select(role => new Claim(ClaimTypes.Role, role)));
        if (user.UniversityId.HasValue) claims.Add(new Claim("university_id", user.UniversityId.Value.ToString()));
        var expiresAt = DateTime.UtcNow.AddMinutes(_jwt.ExpirationMinutes);
        var token = new JwtSecurityToken(_jwt.Issuer, _jwt.Audience, claims, expires: expiresAt,
            signingCredentials: new SigningCredentials(new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_jwt.Key)), SecurityAlgorithms.HmacSha256));
        _audit.Record("LoginSucceeded", nameof(ApplicationUser), user.Id.ToString(), new { Roles = roles });
        await _db.SaveChangesAsync();
        return Ok(new { token = new JwtSecurityTokenHandler().WriteToken(token), expiresAt, userId = user.Id, username = user.UserName, user.DisplayName,
            role = roles.FirstOrDefault(), universityId = user.UniversityId });
    }

    [AllowAnonymous]
    [EnableRateLimiting("password-recovery")]
    [HttpPost("forgot-password")]
    public async Task<IActionResult> ForgotPassword(ForgotPasswordRequestDto request, CancellationToken cancellationToken)
    {
        const string responseMessage = "Success! An institutional password recovery link has been sent to your email address. Please check your inbox.";
        if (!_emailSender.IsConfigured || string.IsNullOrWhiteSpace(_passwordRecovery.FrontendBaseUrl))
            return StatusCode(StatusCodes.Status503ServiceUnavailable,
                new { message = "Password recovery is temporarily unavailable. Please contact your institutional administrator." });

        var email = request.Email.Trim().ToLowerInvariant();
        var user = await _userManager.FindByEmailAsync(email);
        if (user is null || user.IsDeleted || IsPermanentlyDeactivated(user)) return Accepted(new { message = responseMessage });

        var token = await _userManager.GeneratePasswordResetTokenAsync(user);
        var encodedToken = WebEncoders.Base64UrlEncode(Encoding.UTF8.GetBytes(token));
        var resetUrl = $"{_passwordRecovery.FrontendBaseUrl.TrimEnd('/')}/reset-password?email={Uri.EscapeDataString(email)}&token={Uri.EscapeDataString(encodedToken)}";
        var lifetime = TimeSpan.FromMinutes(_passwordRecovery.TokenLifetimeMinutes);
        try
        {
            await _emailSender.SendAsync(email, user.DisplayName, resetUrl, lifetime, cancellationToken);
            _audit.Record("PasswordRecoveryRequested", nameof(ApplicationUser), user.Id.ToString());
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (Exception exception) when (exception is SmtpException or InvalidOperationException)
        {
            // Keep the public response indistinguishable to prevent account enumeration.
            _logger.LogError(exception, "Could not deliver a password recovery email for user {UserId}.", user.Id);
        }

        return Accepted(new { message = responseMessage });
    }

    [AllowAnonymous]
    [EnableRateLimiting("password-recovery")]
    [HttpPost("reset-password")]
    public async Task<IActionResult> ResetPassword(ResetPasswordRequestDto request, CancellationToken cancellationToken)
    {
        var user = await _userManager.FindByEmailAsync(request.Email.Trim().ToLowerInvariant());
        if (user is null || user.IsDeleted || IsPermanentlyDeactivated(user)) return InvalidRecoveryLink();

        string token;
        try { token = Encoding.UTF8.GetString(WebEncoders.Base64UrlDecode(request.Token)); }
        catch (FormatException) { return InvalidRecoveryLink(); }

        var result = await _userManager.ResetPasswordAsync(user, token, request.NewPassword);
        if (!result.Succeeded)
        {
            if (result.Errors.Any(error => error.Code.StartsWith("Password", StringComparison.Ordinal)))
            {
                foreach (var error in result.Errors) ModelState.AddModelError(nameof(request.NewPassword), error.Description);
                return ValidationProblem(ModelState);
            }
            return InvalidRecoveryLink();
        }

        await _userManager.SetLockoutEndDateAsync(user, null);
        await _userManager.ResetAccessFailedCountAsync(user);
        _audit.Record("PasswordRecoveryCompleted", nameof(ApplicationUser), user.Id.ToString());
        await _db.SaveChangesAsync(cancellationToken);
        return Ok(new { message = "Your password has been reset successfully. You can now sign in." });
    }

    private static bool IsPermanentlyDeactivated(ApplicationUser user) =>
        user.LockoutEnd.HasValue && user.LockoutEnd.Value > DateTimeOffset.UtcNow.AddYears(100);

    private ActionResult InvalidRecoveryLink() => BadRequest(new
    {
        message = "The password recovery link is invalid or has expired. Request a new link and try again."
    });
}
