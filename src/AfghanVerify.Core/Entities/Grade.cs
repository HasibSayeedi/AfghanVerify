// AfghanVerify.Core/Entities/Grade.cs
namespace AfghanVerify.Core.Entities;

public class Grade
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public string SubjectName { get; set; } = string.Empty; // e.g., Software Engineering
    public int SemesterNumber { get; set; } // e.g., 1, 2, 3... 8
    public int Score { get; set; } // Score out of 100
    public string CreditHours { get; set; } = "3";

    public Student? Student { get; set; }
}
