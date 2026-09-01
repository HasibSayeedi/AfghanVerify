using System.Text;
using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Services;
using Microsoft.Extensions.Options;
using Xunit;

namespace AfghanVerify.Infrastructure.Tests;

public sealed class CryptographyServiceTests
{
    private static CryptographyService CreateService() => new(Options.Create(new CryptographyOptions
    {
        SigningKey = Convert.ToBase64String(Encoding.UTF8.GetBytes("a-production-key-must-be-random-32b"))
    }));

    [Fact]
    public void VerifyDocument_ReturnsTrue_ForUnchangedRecord()
    {
        var (student, certificate) = CreateRecord();
        var service = CreateService();
        certificate.DigitalHash = service.SignDocument(student, certificate);
        Assert.True(service.VerifyDocument(student, certificate));
    }

    [Fact]
    public void VerifyDocument_ReturnsFalse_WhenCredentialIsModified()
    {
        var (student, certificate) = CreateRecord();
        var service = CreateService();
        certificate.DigitalHash = service.SignDocument(student, certificate);
        certificate.Gpa = "4.00";
        Assert.False(service.VerifyDocument(student, certificate));
    }

    [Fact]
    public void CorrectedPendingRecord_IsTrustedOnlyAfterItIsResigned()
    {
        var (student, certificate) = CreateRecord();
        var service = CreateService();
        certificate.DigitalHash = service.SignDocument(student, certificate);
        var originalSignature = certificate.DigitalHash;

        student.FirstName = "Aminah";
        Assert.False(service.VerifyDocument(student, certificate));

        certificate.DigitalHash = service.SignDocument(student, certificate);
        Assert.NotEqual(originalSignature, certificate.DigitalHash);
        Assert.True(service.VerifyDocument(student, certificate));
    }

    [Fact]
    public void VerifyDocument_ReturnsTrue_AfterSqlServerDateTimeRoundTrip()
    {
        var (student, certificate) = CreateRecord();
        certificate.SignatureVersion = 2;
        certificate.VerificationCode = "KU-360059885";
        var service = CreateService();
        certificate.DigitalHash = service.SignDocument(student, certificate);

        certificate.IssueDate = DateTime.SpecifyKind(certificate.IssueDate, DateTimeKind.Unspecified);

        Assert.True(service.VerifyDocument(student, certificate));
    }

    [Fact]
    public void Version3Signature_CoversRelationalAcademicIdentifiers()
    {
        var (student, certificate) = CreateRecord();
        student.FacultyId = Guid.Parse("40000000-0000-0000-0000-000000000004");
        student.DepartmentId = Guid.Parse("50000000-0000-0000-0000-000000000005");
        certificate.SignatureVersion = 3;
        certificate.VerificationCode = "ku-360059885";
        var service = CreateService();
        certificate.DigitalHash = service.SignDocument(student, certificate);

        certificate.VerificationCode = "KU-360059885";
        certificate.IssueDate = DateTime.SpecifyKind(certificate.IssueDate, DateTimeKind.Unspecified);
        Assert.True(service.VerifyDocument(student, certificate));
        student.DepartmentId = Guid.Parse("60000000-0000-0000-0000-000000000006");
        Assert.False(service.VerifyDocument(student, certificate));
    }

    [Fact]
    public void Version4Signature_CoversReplacementChain()
    {
        var (student, certificate) = CreateRecord();
        certificate.SignatureVersion = 4;
        certificate.SupersedesCertificateId = Guid.Parse("70000000-0000-0000-0000-000000000007");
        var service = CreateService();
        certificate.DigitalHash = service.SignDocument(student, certificate);

        Assert.True(service.VerifyDocument(student, certificate));
        certificate.SupersedesCertificateId = Guid.Parse("80000000-0000-0000-0000-000000000008");
        Assert.False(service.VerifyDocument(student, certificate));
    }

    [Fact]
    public void Version5Signature_UsesAndCoversSigningKeyId()
    {
        var legacyKey = Convert.ToBase64String(Encoding.UTF8.GetBytes("a-different-legacy-random-key-32b"));
        var service = new CryptographyService(Options.Create(new CryptographyOptions
        {
            ActiveKeyId = "primary",
            SigningKey = Convert.ToBase64String(Encoding.UTF8.GetBytes("a-production-key-must-be-random-32b")),
            VerificationKeys = new Dictionary<string, string> { ["legacy"] = legacyKey }
        }));
        var (student, certificate) = CreateRecord();
        certificate.SignatureVersion = 5;
        certificate.SigningKeyId = "legacy";
        certificate.DigitalHash = service.SignDocument(student, certificate);

        Assert.True(service.VerifyDocument(student, certificate));
        certificate.SigningKeyId = "primary";
        Assert.False(service.VerifyDocument(student, certificate));
    }

    private static (Student Student, Certificate Certificate) CreateRecord()
    {
        var student = new Student
        {
            Id = Guid.Parse("10000000-0000-0000-0000-000000000001"), UniversityId = Guid.Parse("20000000-0000-0000-0000-000000000002"),
            FirstName = "Amina", LastName = "Ahmadi", FatherName = "Rahim", TazkiraNumber = "123456789",
            Faculty = "Computer Science", Department = "Software Engineering", GraduationYear = 2026
        };
        student.Grades.Add(new Grade { Id = Guid.NewGuid(), StudentId = student.Id, SubjectName = "Security", SemesterNumber = 8, Score = 91, CreditHours = "3" });
        return (student, new Certificate
        {
            Id = Guid.Parse("30000000-0000-0000-0000-000000000003"), StudentId = student.Id, VerificationCode = "A1B2C3D4",
            DocumentType = "Both", Gpa = "3.82", IssueDate = new DateTime(2026, 8, 29, 0, 0, 0, DateTimeKind.Utc),
            IssuanceSystem = "DigitalFirst", DiplomaFileUrl = "https://files.example/diploma.pdf"
        });
    }
}
