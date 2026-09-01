namespace AfghanVerify.WebApi.Configuration;

public sealed class PasswordRecoveryOptions
{
    public const string SectionName = "PasswordRecovery";
    public string FrontendBaseUrl { get; init; } = string.Empty;
    public int TokenLifetimeMinutes { get; init; } = 30;
}
