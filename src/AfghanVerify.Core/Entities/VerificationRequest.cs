// AfghanVerify.Core/Entities/VerificationRequest.cs
namespace AfghanVerify.Core.Entities;

public class VerificationRequest
{
    public Guid Id { get; set; }
    public Guid CertificateId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public string CurrentStep { get; set; } = "MinistryReview"; // مرحله فعلی اداری
    public string Remarks { get; set; } = string.Empty; // ملاحظات یا دلیل رد شدن مکتوب
    public string ApprovedByUserId { get; set; } = string.Empty; // آی‌دی کارمند تاییدکننده
    
    public Certificate? Certificate { get; set; }
}
