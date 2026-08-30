using Microsoft.AspNetCore.SignalR;

namespace AfghanVerify.Infrastructure.Services;

public sealed class NotificationHub : Hub
{
    public Task SubscribeToCertificate(string verificationCode)
    {
        var code = verificationCode.Trim().ToUpperInvariant();
        var parts = code.Split('-');
        var valid = (code.Length == 8 && code.All(char.IsAsciiHexDigit))
            || (parts.Length == 2 && parts[0].Length is >= 2 and <= 4 && parts[0].All(char.IsAsciiLetterOrDigit)
                && ((parts[1].Length == 9 && parts[1].All(char.IsAsciiDigit))
                    || (parts[1].Length == 5 && parts[1].All(char.IsAsciiHexDigit))));
        if (!valid) throw new HubException("A valid prefixed verification code is required.");
        return Groups.AddToGroupAsync(Context.ConnectionId, code);
    }
}
