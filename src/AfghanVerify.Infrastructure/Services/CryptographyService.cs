using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using AfghanVerify.Core.Entities;
using Microsoft.Extensions.Options;

namespace AfghanVerify.Infrastructure.Services;

public sealed class CryptographyService
{
    private readonly IReadOnlyDictionary<string, byte[]> _keys;
    public string ActiveKeyId { get; }

    public CryptographyService(IOptions<CryptographyOptions> options)
    {
        ActiveKeyId = options.Value.ActiveKeyId.Trim();
        if (string.IsNullOrWhiteSpace(ActiveKeyId)) throw new InvalidOperationException("Cryptography:ActiveKeyId is required.");
        var keys = new Dictionary<string, byte[]>(StringComparer.Ordinal);
        keys[ActiveKeyId] = DecodeKey(options.Value.SigningKey, "Cryptography:SigningKey");
        foreach (var (keyId, encodedKey) in options.Value.VerificationKeys)
        {
            var normalizedKeyId = keyId.Trim();
            if (normalizedKeyId.Length == 0 || normalizedKeyId == ActiveKeyId) continue;
            keys[normalizedKeyId] = DecodeKey(encodedKey, $"Cryptography:VerificationKeys:{normalizedKeyId}");
        }
        _keys = keys;
    }

    public string SignDocument(Student student, Certificate certificate)
    {
        var keyId = string.IsNullOrWhiteSpace(certificate.SigningKeyId) ? ActiveKeyId : certificate.SigningKeyId;
        if (!_keys.TryGetValue(keyId, out var signingKey))
            throw new InvalidOperationException($"No cryptographic verification key is configured for key ID '{keyId}'.");
        using var hmac = new HMACSHA256(signingKey);
        var payload = certificate.SignatureVersion >= 3
            ? CreateVersion3Payload(student, certificate)
            : CreateLegacyPayload(student, certificate);
        return Convert.ToHexString(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload))).ToLowerInvariant();
    }

    public bool VerifyDocument(Student student, Certificate certificate)
    {
        if (certificate.DigitalHash.Length != 64) return false;
        string expectedSignature;
        try { expectedSignature = SignDocument(student, certificate); }
        catch (InvalidOperationException) { return false; }
        var expected = Encoding.ASCII.GetBytes(expectedSignature);
        var actual = Encoding.ASCII.GetBytes(certificate.DigitalHash.ToLowerInvariant());
        return CryptographicOperations.FixedTimeEquals(expected, actual);
    }

    private static string CreateLegacyPayload(Student student, Certificate certificate)
    {
        var fields = new List<string>
        {
            certificate.Id.ToString("N"), student.Id.ToString("N"), student.UniversityId.ToString("N"), student.TazkiraNumber.Trim(),
            student.FirstName.Trim(), student.LastName.Trim(), student.FatherName.Trim()
        };
        if (certificate.SignatureVersion >= 2) fields.Add(student.Faculty.Trim());
        fields.AddRange([
            student.Department.Trim(), student.GraduationYear.ToString(CultureInfo.InvariantCulture), NormalizeVerificationCode(certificate.VerificationCode),
            certificate.DocumentType, certificate.Gpa, certificate.IssuanceSystem, certificate.LegacyMaktoubNumber,
            certificate.DiplomaFileUrl, certificate.TranscriptFileUrl,
            FormatUtc(certificate.IssueDate),
            string.Join(';', student.Grades.OrderBy(g => g.SemesterNumber).ThenBy(g => g.SubjectName)
                .Select(g => $"{g.SemesterNumber}:{g.SubjectName.Trim()}:{g.Score}:{g.CreditHours.Trim()}"))
        ]);
        return string.Join('|', fields);
    }

    private static string CreateVersion3Payload(Student student, Certificate certificate)
    {
        var payload = new StringBuilder();
        static void Append(StringBuilder builder, string? value)
        {
            value ??= string.Empty;
            builder.Append(value.Length.ToString(CultureInfo.InvariantCulture)).Append(':').Append(value);
        }

        Append(payload, "AfghanVerify-HMAC-v3");
        if (certificate.SignatureVersion >= 5) Append(payload, certificate.SigningKeyId.Trim());
        Append(payload, certificate.Id.ToString("N"));
        Append(payload, certificate.StudentId.ToString("N"));
        if (certificate.SignatureVersion >= 4) Append(payload, certificate.SupersedesCertificateId?.ToString("N"));
        Append(payload, student.Id.ToString("N"));
        Append(payload, student.UniversityId.ToString("N"));
        Append(payload, student.FacultyId?.ToString("N"));
        Append(payload, student.DepartmentId?.ToString("N"));
        Append(payload, student.TazkiraNumber.Trim());
        Append(payload, student.FirstName.Trim());
        Append(payload, student.LastName.Trim());
        Append(payload, student.FatherName.Trim());
        Append(payload, student.ProfilePicture.Trim());
        Append(payload, student.Faculty.Trim());
        Append(payload, student.Department.Trim());
        Append(payload, student.GraduationYear.ToString(CultureInfo.InvariantCulture));
        Append(payload, NormalizeVerificationCode(certificate.VerificationCode));
        Append(payload, certificate.DocumentType.Trim());
        Append(payload, certificate.Gpa.Trim());
        Append(payload, certificate.IssuanceSystem.Trim());
        Append(payload, certificate.LegacyMaktoubNumber.Trim());
        Append(payload, certificate.DiplomaFileUrl.Trim());
        Append(payload, certificate.TranscriptFileUrl.Trim());
        Append(payload, FormatUtc(certificate.IssueDate));

        var grades = student.Grades.OrderBy(g => g.SemesterNumber).ThenBy(g => g.SubjectName, StringComparer.Ordinal).ThenBy(g => g.Id).ToList();
        Append(payload, grades.Count.ToString(CultureInfo.InvariantCulture));
        foreach (var grade in grades)
        {
            Append(payload, grade.Id.ToString("N"));
            Append(payload, grade.StudentId.ToString("N"));
            Append(payload, grade.SemesterNumber.ToString(CultureInfo.InvariantCulture));
            Append(payload, grade.SubjectName.Trim());
            Append(payload, grade.Score.ToString(CultureInfo.InvariantCulture));
            Append(payload, grade.CreditHours.Trim());
        }
        return payload.ToString();
    }

    private static string NormalizeVerificationCode(string value) => value.Trim().ToUpperInvariant();

    private static string FormatUtc(DateTime value)
    {
        var utc = value.Kind == DateTimeKind.Local ? value.ToUniversalTime() : DateTime.SpecifyKind(value, DateTimeKind.Utc);
        return utc.ToString("O", CultureInfo.InvariantCulture);
    }

    private static byte[] DecodeKey(string encodedKey, string settingName)
    {
        byte[] key;
        try { key = Convert.FromBase64String(encodedKey); }
        catch (FormatException ex) { throw new InvalidOperationException($"{settingName} must be a Base64 value.", ex); }
        if (key.Length < 32) throw new InvalidOperationException($"{settingName} must contain at least 256 bits.");
        return key;
    }
}
