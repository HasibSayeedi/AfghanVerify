namespace AfghanVerify.Core.Entities;

public static class CertificateStatuses
{
    public const string PendingMinistry = "PendingMinistry";
    public const string Verified = "Verified";
    public const string Rejected = "Rejected";
    public const string Suspended = "Suspended";
    public const string Revoked = "Revoked";
    public const string Superseded = "Superseded";
    public const string Cancelled = "Cancelled";

    public static bool IsPubliclyTrusted(string status) => status == Verified;
    public static bool IsTerminal(string status) => status is Rejected or Revoked or Superseded or Cancelled;
}
