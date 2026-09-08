namespace AfghanVerify.Core.Entities;

public sealed class University
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameDari { get; set; } = string.Empty;
    public string NamePashto { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string ShortName { get; set; } = string.Empty;
    public string UniversityType { get; set; } = "Public";
    public string Province { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string CampusBranch { get; set; } = string.Empty;
    public string OfficialAddress { get; set; } = string.Empty;
    public string OfficialEmail { get; set; } = string.Empty;
    public string OfficialPhoneNumber { get; set; } = string.Empty;
    public string Website { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string LogoUrl { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = "#065f46";
    public long CurrentDiplomaSequence { get; set; }
    public long CurrentTranscriptSequence { get; set; }
    public byte[] RowVersion { get; set; } = [];
    public ICollection<Faculty> Faculties { get; set; } = new List<Faculty>();
    public ICollection<Student> Students { get; set; } = new List<Student>();
}
