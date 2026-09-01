using System.Net;
using System.Net.Mail;
using AfghanVerify.WebApi.Configuration;
using Microsoft.Extensions.Options;

namespace AfghanVerify.WebApi.Services;

public interface IPasswordRecoveryEmailSender
{
    bool IsConfigured { get; }
    Task SendAsync(string recipient, string displayName, string resetUrl, TimeSpan tokenLifetime,
        CancellationToken cancellationToken);
}

public sealed class SmtpPasswordRecoveryEmailSender : IPasswordRecoveryEmailSender
{
    private readonly EmailOptions _options;

    public SmtpPasswordRecoveryEmailSender(IOptions<EmailOptions> options) => _options = options.Value;

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_options.Host)
        && _options.Port is > 0 and <= 65535
        && !string.IsNullOrWhiteSpace(_options.FromAddress)
        && (string.IsNullOrWhiteSpace(_options.Username) == string.IsNullOrWhiteSpace(_options.Password));

    public async Task SendAsync(string recipient, string displayName, string resetUrl, TimeSpan tokenLifetime,
        CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new InvalidOperationException("The SMTP email service is not configured.");

        using var message = new MailMessage
        {
            From = new MailAddress(_options.FromAddress, _options.FromName),
            Subject = "Reset your Afghan Verify password",
            Body = $"Hello {displayName},\n\n"
                + "A password recovery request was received for your Afghan Verify staff account.\n\n"
                + $"Open this secure link to choose a new password:\n{resetUrl}\n\n"
                + $"This link expires in {tokenLifetime.TotalMinutes:0} minutes and can be used only once. "
                + "If you did not request this change, ignore this email and your password will remain unchanged.\n\n"
                + "Afghan Verify — National Credential Registry",
            IsBodyHtml = false
        };
        message.To.Add(new MailAddress(recipient));

        using var client = new SmtpClient(_options.Host, _options.Port)
        {
            EnableSsl = _options.EnableSsl,
            DeliveryMethod = SmtpDeliveryMethod.Network,
            UseDefaultCredentials = string.IsNullOrWhiteSpace(_options.Username),
            Credentials = string.IsNullOrWhiteSpace(_options.Username)
                ? CredentialCache.DefaultNetworkCredentials
                : new NetworkCredential(_options.Username, _options.Password)
        };
        await client.SendMailAsync(message, cancellationToken);
    }
}
