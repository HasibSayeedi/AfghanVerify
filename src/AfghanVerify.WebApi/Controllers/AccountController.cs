using System.Security.Claims;
using AfghanVerify.Infrastructure.Identity;
using AfghanVerify.WebApi.Dtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Authorize]
[Route("api/account")]
public sealed class AccountController : ControllerBase
{
    private readonly UserManager<ApplicationUser> _userManager;

    public AccountController(UserManager<ApplicationUser> userManager) => _userManager = userManager;

    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword(ChangeOwnPasswordDto request)
    {
        var userId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        if (string.IsNullOrWhiteSpace(userId)) return Unauthorized();
        var user = await _userManager.FindByIdAsync(userId);
        if (user is null || user.IsDeleted) return Unauthorized();

        var result = await _userManager.ChangePasswordAsync(user, request.CurrentPassword, request.NewPassword);
        if (!result.Succeeded)
        {
            foreach (var identityError in result.Errors)
            {
                var message = identityError.Code == "PasswordMismatch"
                    ? "The current password is incorrect."
                    : identityError.Description;
                ModelState.AddModelError(identityError.Code, message);
            }
            return ValidationProblem(ModelState);
        }

        return Ok(new { message = "Your password has been updated successfully." });
    }
}
