using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace AfghanVerify.Infrastructure.Identity;

public static class IdentitySeeder
{
    private static readonly string[] Roles = ["Ministry", "University", "SUPER_ADMIN", "UNIVERSITY_ADMIN"];

    public static async Task SeedAsync(IServiceProvider services, IConfiguration configuration)
    {
        var roleManager = services.GetRequiredService<RoleManager<IdentityRole<Guid>>>();
        var userManager = services.GetRequiredService<UserManager<ApplicationUser>>();
        var logger = services.GetRequiredService<ILogger<ApplicationUser>>();

        foreach (var role in Roles)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                EnsureSucceeded(await roleManager.CreateAsync(new IdentityRole<Guid>(role)), $"create role '{role}'");
            }
        }

        foreach (var entry in configuration.GetSection("BootstrapUsers").GetChildren())
        {
            var username = entry["Username"]?.Trim();
            var password = entry["Password"];
            var role = entry["Role"]?.Trim();
            if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(role)) continue;
            if (!Roles.Contains(role, StringComparer.OrdinalIgnoreCase)) throw new InvalidOperationException($"Unsupported bootstrap role '{role}'.");
            Guid? universityId = Guid.TryParse(entry["UniversityId"], out var parsedId) ? parsedId : null;
            if ((role.Equals("University", StringComparison.OrdinalIgnoreCase) || role.Equals("UNIVERSITY_ADMIN", StringComparison.OrdinalIgnoreCase)) && universityId is null)
                throw new InvalidOperationException($"University user '{username}' requires a UniversityId.");

            var user = await userManager.FindByNameAsync(username);
            if (user is null)
            {
                user = new ApplicationUser
                {
                    Id = Guid.NewGuid(), UserName = username, Email = entry["Email"],
                    DisplayName = entry["DisplayName"] ?? username, UniversityId = universityId, EmailConfirmed = true,
                    LockoutEnabled = true
                };
                EnsureSucceeded(await userManager.CreateAsync(user, password), $"create user '{username}'");
                logger.LogInformation("Provisioned configured bootstrap user {Username}.", username);
            }
            else
            {
                user.Email = entry["Email"] ?? user.Email;
                user.DisplayName = entry["DisplayName"] ?? user.DisplayName;
                user.UniversityId = universityId;
                user.EmailConfirmed = true;
                user.LockoutEnabled = true;
                // A user that remains explicitly configured as a bootstrap account is
                // authoritative and must be recoverable after an accidental soft delete.
                user.IsDeleted = false;
                EnsureSucceeded(await userManager.UpdateAsync(user), $"update user '{username}'");
            }

            if (!await userManager.IsInRoleAsync(user, role))
                EnsureSucceeded(await userManager.AddToRoleAsync(user, role), $"assign role '{role}'");

            if (bool.TryParse(entry["SynchronizePassword"], out var synchronizePassword) && synchronizePassword)
            {
                if (!await userManager.CheckPasswordAsync(user, password))
                {
                    var token = await userManager.GeneratePasswordResetTokenAsync(user);
                    EnsureSucceeded(await userManager.ResetPasswordAsync(user, token, password), $"synchronize password for '{username}'");
                }
                EnsureSucceeded(await userManager.SetLockoutEndDateAsync(user, null), $"clear lockout for '{username}'");
                EnsureSucceeded(await userManager.ResetAccessFailedCountAsync(user), $"reset failed access count for '{username}'");
            }
        }
    }

    private static void EnsureSucceeded(IdentityResult result, string operation)
    {
        if (!result.Succeeded) throw new InvalidOperationException($"Could not {operation}: {string.Join("; ", result.Errors.Select(e => e.Description))}");
    }
}
