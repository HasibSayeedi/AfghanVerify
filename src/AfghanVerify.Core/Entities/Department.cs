namespace AfghanVerify.Core.Entities;

public sealed class Department
{
    public Guid Id { get; set; }
    public Guid FacultyId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public Faculty? Faculty { get; set; }
}
