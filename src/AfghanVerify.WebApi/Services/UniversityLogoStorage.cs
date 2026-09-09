using System.Text.RegularExpressions;

namespace AfghanVerify.WebApi.Services;

public sealed class UniversityLogoStorage
{
    public const long MaximumFileSize = 5 * 1024 * 1024;
    private const string PublicPrefix = "/api/university-logos/";
    private static readonly Regex SafeFileName = new("^[a-f0-9]{32}-[a-f0-9]{32}\\.(png|jpg|webp)$",
        RegexOptions.Compiled | RegexOptions.CultureInvariant | RegexOptions.IgnoreCase);
    private readonly string _root;

    public UniversityLogoStorage(IWebHostEnvironment environment, IConfiguration configuration)
        : this(string.IsNullOrWhiteSpace(configuration["FileStorage:UniversityLogosPath"])
            ? Path.Combine(environment.ContentRootPath, "Data", "UniversityLogos")
            : configuration["FileStorage:UniversityLogosPath"]!)
    {
    }

    public UniversityLogoStorage(string root)
    {
        _root = Path.GetFullPath(root);
        Directory.CreateDirectory(_root);
    }

    public async Task<string> SaveAsync(Guid universityId, IFormFile file, CancellationToken cancellationToken)
    {
        if (file.Length is <= 0 or > MaximumFileSize)
            throw new InvalidDataException("University logos must be non-empty and no larger than 5 MB.");

        var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
        var canonicalExtension = extension switch
        {
            ".png" when file.ContentType.Equals("image/png", StringComparison.OrdinalIgnoreCase) => "png",
            ".jpg" or ".jpeg" when file.ContentType.Equals("image/jpeg", StringComparison.OrdinalIgnoreCase) => "jpg",
            ".webp" when file.ContentType.Equals("image/webp", StringComparison.OrdinalIgnoreCase) => "webp",
            _ => throw new InvalidDataException("Only PNG, JPG/JPEG, and WebP university logos are accepted.")
        };

        await using var input = file.OpenReadStream();
        var header = new byte[12];
        var bytesRead = await input.ReadAsync(header.AsMemory(0, header.Length), cancellationToken);
        if (!HasValidSignature(canonicalExtension, header, bytesRead))
            throw new InvalidDataException("The selected file content does not match a supported image format.");
        input.Position = 0;

        var fileName = $"{universityId:N}-{Guid.NewGuid():N}.{canonicalExtension}";
        var destination = ResolveSafePath(fileName);
        await using var output = new FileStream(destination, FileMode.CreateNew, FileAccess.Write, FileShare.None,
            81920, FileOptions.Asynchronous | FileOptions.SequentialScan);
        await input.CopyToAsync(output, cancellationToken);
        return PublicPrefix + fileName;
    }

    public Task DeleteIfManagedAsync(string? publicPath)
    {
        if (!TryGetManagedFileName(publicPath, out var fileName)) return Task.CompletedTask;
        var path = ResolveSafePath(fileName);
        if (File.Exists(path)) File.Delete(path);
        return Task.CompletedTask;
    }

    public bool TryResolve(string fileName, out string path, out string contentType)
    {
        path = "";
        contentType = "";
        if (!SafeFileName.IsMatch(fileName) || Path.GetFileName(fileName) != fileName) return false;
        path = ResolveSafePath(fileName);
        contentType = Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" => "image/jpeg",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };
        return File.Exists(path);
    }

    private bool TryGetManagedFileName(string? publicPath, out string fileName)
    {
        fileName = "";
        if (string.IsNullOrWhiteSpace(publicPath) || !publicPath.StartsWith(PublicPrefix, StringComparison.Ordinal)) return false;
        fileName = publicPath[PublicPrefix.Length..];
        return SafeFileName.IsMatch(fileName) && Path.GetFileName(fileName) == fileName;
    }

    private string ResolveSafePath(string fileName)
    {
        var path = Path.GetFullPath(Path.Combine(_root, fileName));
        var prefix = _root.TrimEnd(Path.DirectorySeparatorChar) + Path.DirectorySeparatorChar;
        if (!path.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("The logo storage path is invalid.");
        return path;
    }

    private static bool HasValidSignature(string extension, byte[] bytes, int count) => extension switch
    {
        "png" => count >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }),
        "jpg" => count >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF,
        "webp" => count >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8),
        _ => false
    };
}
