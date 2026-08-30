namespace AfghanVerify.Core.Entities;

public sealed class Faculty
{
    public Guid Id { get; set; }
    public Guid UniversityId { get; set; }
    public string Name { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public University? University { get; set; }
    public ICollection<Department> Departments { get; set; } = new List<Department>();
}
