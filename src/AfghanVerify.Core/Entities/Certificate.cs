namespace AfghanVerify.Core.Entities;

public sealed class Certificate
{
    public Guid Id { get; set; }
    public Guid StudentId { get; set; }
    public string DocumentType { get; set; } = "Both";
    public string DiplomaFileUrl { get; set; } = string.Empty;
    public string TranscriptFileUrl { get; set; } = string.Empty;
    public string Gpa { get; set; } = string.Empty;
    public DateTime IssueDate { get; set; }
    public string IssuanceSystem { get; set; } = "DigitalFirst";
    public string LegacyMaktoubNumber { get; set; } = string.Empty;
    public string VerificationCode { get; set; } = string.Empty;
    public string DigitalHash { get; set; } = string.Empty;
    public int SignatureVersion { get; set; } = 3;
    public string SigningKeyId { get; set; } = "primary";
    public string Status { get; set; } = CertificateStatuses.PendingMinistry;
    public Guid? SupersedesCertificateId { get; set; }
    public Certificate? SupersedesCertificate { get; set; }
    public ICollection<Certificate> Replacements { get; set; } = new List<Certificate>();
    public byte[] RowVersion { get; set; } = [];
    public Student? Student { get; set; }
}
