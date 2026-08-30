using Microsoft.AspNetCore.Identity;

namespace AfghanVerify.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
    public Guid? UniversityId { get; set; }
    public bool IsDeleted { get; set; }
}
