namespace AfghanVerify.Core.Entities;

public sealed class University
{
    public Guid Id { get; set; }
    public string NameEnglish { get; set; } = string.Empty;
    public string NameDari { get; set; } = string.Empty;
    public string NamePashto { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Location { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public string LogoUrl { get; set; } = string.Empty;
    public string PrimaryColor { get; set; } = "#065f46";
    public long CurrentDiplomaSequence { get; set; }
    public long CurrentTranscriptSequence { get; set; }
    public ICollection<Faculty> Faculties { get; set; } = new List<Faculty>();
}
