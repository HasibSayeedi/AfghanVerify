namespace AfghanVerify.Core.Entities;

public sealed class Student
{
    public Guid Id { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FatherName { get; set; } = string.Empty;
    public string TazkiraNumber { get; set; } = string.Empty;
    public Guid UniversityId { get; set; }
    public Guid? FacultyId { get; set; }
    public Guid? DepartmentId { get; set; }
    public string Faculty { get; set; } = string.Empty;
    public string Department { get; set; } = string.Empty;
    public int GraduationYear { get; set; }
    public University? University { get; set; }
    public Faculty? FacultyRecord { get; set; }
    public Department? DepartmentRecord { get; set; }
    public string ProfilePicture { get; set; } = string.Empty;
    public ICollection<Certificate> Certificates { get; set; } = new List<Certificate>();
    public ICollection<Grade> Grades { get; set; } = new List<Grade>();
}
