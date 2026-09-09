using AfghanVerify.WebApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Route("api/university-logos")]
public sealed class UniversityLogosController(UniversityLogoStorage storage) : ControllerBase
{
    [AllowAnonymous]
    [HttpGet("{fileName}")]
    [ResponseCache(Duration = 86400, Location = ResponseCacheLocation.Any)]
    public IActionResult Get(string fileName)
    {
        if (!storage.TryResolve(fileName, out var path, out var contentType)) return NotFound();
        return PhysicalFile(path, contentType, enableRangeProcessing: true);
    }
}
