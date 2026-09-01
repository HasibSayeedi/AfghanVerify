namespace AfghanVerify.Infrastructure.Services;

public sealed class CryptographyOptions
{
    public const string SectionName = "Cryptography";
    public string SigningKey { get; init; } = string.Empty;
    public string ActiveKeyId { get; init; } = "primary";
    public Dictionary<string, string> VerificationKeys { get; init; } = new(StringComparer.Ordinal);
}
