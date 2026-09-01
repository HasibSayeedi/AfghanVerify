namespace AfghanVerify.WebApi.Configuration;

public sealed class EmailOptions
{
    public const string SectionName = "Email";
    public string Host { get; init; } = string.Empty;
    public int Port { get; init; } = 587;
    public string Username { get; init; } = string.Empty;
    public string Password { get; init; } = string.Empty;
    public string FromAddress { get; init; } = string.Empty;
    public string FromName { get; init; } = "Afghan Verify";
    public bool EnableSsl { get; init; } = true;
}
