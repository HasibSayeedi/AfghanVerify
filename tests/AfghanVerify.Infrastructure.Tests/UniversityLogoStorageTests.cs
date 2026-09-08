using AfghanVerify.WebApi.Services;
using Microsoft.AspNetCore.Http;
using Xunit;

namespace AfghanVerify.Infrastructure.Tests;

public sealed class UniversityLogoStorageTests : IDisposable
{
    private readonly string _root = Path.Combine(Path.GetTempPath(), $"afghanverify-logo-tests-{Guid.NewGuid():N}");

    [Theory]
    [InlineData("logo.png", "image/png", "89504E470D0A1A0A00000000", ".png")]
    [InlineData("logo.jpeg", "image/jpeg", "FFD8FF000000000000000000", ".jpg")]
    [InlineData("logo.webp", "image/webp", "524946460000000057454250", ".webp")]
    public async Task SaveAsync_AcceptsSupportedImageSignatures(string fileName, string contentType,
        string hex, string expectedExtension)
    {
        var storage = new UniversityLogoStorage(_root);
        var file = CreateFile(fileName, contentType, Convert.FromHexString(hex));

        var publicPath = await storage.SaveAsync(Guid.NewGuid(), file, CancellationToken.None);

        Assert.StartsWith("/api/university-logos/", publicPath);
        Assert.EndsWith(expectedExtension, publicPath);
        Assert.True(storage.TryResolve(Path.GetFileName(publicPath), out var diskPath, out var storedType));
        Assert.True(File.Exists(diskPath));
        Assert.Equal(contentType == "image/jpeg" ? "image/jpeg" : contentType, storedType);
    }

    [Fact]
    public async Task SaveAsync_RejectsSpoofedImageContent()
    {
        var storage = new UniversityLogoStorage(_root);
        var file = CreateFile("malware.png", "image/png", "not an image"u8.ToArray());

        var exception = await Assert.ThrowsAsync<InvalidDataException>(() =>
            storage.SaveAsync(Guid.NewGuid(), file, CancellationToken.None));

        Assert.Contains("does not match", exception.Message);
    }

    [Fact]
    public async Task SaveAsync_RejectsUnsupportedMimeAndExtension()
    {
        var storage = new UniversityLogoStorage(_root);
        var file = CreateFile("payload.svg", "image/svg+xml", "<svg/>"u8.ToArray());

        await Assert.ThrowsAsync<InvalidDataException>(() =>
            storage.SaveAsync(Guid.NewGuid(), file, CancellationToken.None));
    }

    private static FormFile CreateFile(string name, string contentType, byte[] bytes)
    {
        var stream = new MemoryStream(bytes);
        return new FormFile(stream, 0, bytes.Length, "logo", name)
        {
            Headers = new HeaderDictionary(),
            ContentType = contentType
        };
    }

    public void Dispose()
    {
        if (Directory.Exists(_root)) Directory.Delete(_root, recursive: true);
    }
}
