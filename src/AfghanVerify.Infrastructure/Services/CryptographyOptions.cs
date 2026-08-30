namespace AfghanVerify.Infrastructure.Services;

public sealed class CryptographyOptions
{
    public const string SectionName = "Cryptography";
    public string SigningKey { get; init; } = string.Empty;
}
