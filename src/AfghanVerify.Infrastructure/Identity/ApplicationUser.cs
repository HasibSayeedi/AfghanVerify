using Microsoft.AspNetCore.Identity;
using AfghanVerify.Core.Entities;

namespace AfghanVerify.Infrastructure.Identity;

public sealed class ApplicationUser : IdentityUser<Guid>
{
    public string DisplayName { get; set; } = string.Empty;
    public Guid? UniversityId { get; set; }
    public University? University { get; set; }
    public bool IsDeleted { get; set; }
}
