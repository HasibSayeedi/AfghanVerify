using System.Text;
using System.Threading.RateLimiting;
using System.Security.Claims;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.Infrastructure.Identity;
using AfghanVerify.Infrastructure.Services;
using AfghanVerify.WebApi.Configuration;
using AfghanVerify.WebApi.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);
// Console-first logging is portable across Windows services and Linux containers.
// The Windows Event Log provider can throw when the process is intentionally non-administrative.
builder.Logging.ClearProviders();
builder.Logging.AddConfiguration(builder.Configuration.GetSection("Logging"));
builder.Logging.AddConsole();
if (builder.Environment.IsDevelopment()) builder.Logging.AddDebug();
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true, reloadOnChange: true);
// Local developer settings are convenient defaults, but deployment environment
// variables and command-line arguments must always remain authoritative.
builder.Configuration.AddEnvironmentVariables();
builder.Configuration.AddCommandLine(args);
builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<ApiExceptionHandler>();
builder.Services.AddControllers();
builder.Services.AddSignalR();
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    if (builder.Configuration.GetValue<bool>("ReverseProxy:TrustForwardedHeaders"))
    {
        // The production container is reachable only through the trusted frontend proxy.
        options.KnownIPNetworks.Clear();
        options.KnownProxies.Clear();
    }
});
var dataProtection = builder.Services.AddDataProtection().SetApplicationName("AfghanVerify");
var dataProtectionKeysPath = builder.Configuration["DataProtection:KeysPath"];
if (!string.IsNullOrWhiteSpace(dataProtectionKeysPath))
    dataProtection.PersistKeysToFileSystem(new DirectoryInfo(dataProtectionKeysPath));
builder.Services.AddDbContext<ApplicationDbContext>(options => options.UseSqlServer(
    builder.Configuration.GetConnectionString("DefaultConnection"),
    sqlServer => sqlServer.EnableRetryOnFailure(3, TimeSpan.FromSeconds(2), null)));
builder.Services.AddIdentityCore<ApplicationUser>(options =>
    {
        options.Password.RequiredLength = 8; options.Password.RequireDigit = true; options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = true; options.Password.RequireNonAlphanumeric = true;
        options.Lockout.MaxFailedAccessAttempts = 5; options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15);
    }).AddRoles<IdentityRole<Guid>>().AddEntityFrameworkStores<ApplicationDbContext>().AddSignInManager().AddDefaultTokenProviders();
builder.Services.Configure<DataProtectionTokenProviderOptions>(options =>
    options.TokenLifespan = TimeSpan.FromMinutes(builder.Configuration.GetValue("PasswordRecovery:TokenLifetimeMinutes", 30)));

builder.Services.AddOptions<JwtOptions>().Bind(builder.Configuration.GetSection(JwtOptions.SectionName))
    .Validate(o => o.Key.Length >= 32, "Jwt:Key must contain at least 32 characters.")
    .Validate(o => !string.IsNullOrWhiteSpace(o.Issuer) && !string.IsNullOrWhiteSpace(o.Audience), "JWT issuer and audience are required.")
    .Validate(o => o.ExpirationMinutes is >= 5 and <= 1440, "Jwt:ExpirationMinutes must be between 5 and 1440 minutes.")
    .ValidateOnStart();
builder.Services.AddOptions<CryptographyOptions>().Bind(builder.Configuration.GetSection(CryptographyOptions.SectionName))
    .Validate(o => IsStrongBase64Key(o.SigningKey), "Cryptography:SigningKey must be Base64-encoded and contain at least 256 bits.")
    .Validate(o => !string.IsNullOrWhiteSpace(o.ActiveKeyId), "Cryptography:ActiveKeyId is required.")
    .Validate(o => o.VerificationKeys.All(item => !string.IsNullOrWhiteSpace(item.Key) && IsStrongBase64Key(item.Value)),
        "Every cryptographic verification key must have an ID and contain at least 256 Base64-encoded bits.")
    .ValidateOnStart();
builder.Services.AddScoped<CryptographyService>();
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<AuditService>();
builder.Services.AddSingleton<UniversityLogoStorage>();
builder.Services.AddOptions<EmailOptions>().Bind(builder.Configuration.GetSection(EmailOptions.SectionName));
builder.Services.AddOptions<PasswordRecoveryOptions>().Bind(builder.Configuration.GetSection(PasswordRecoveryOptions.SectionName))
    .Validate(options => options.TokenLifetimeMinutes is >= 5 and <= 1440,
        "PasswordRecovery:TokenLifetimeMinutes must be between 5 and 1440 minutes.")
    .Validate(options => string.IsNullOrWhiteSpace(options.FrontendBaseUrl)
        || Uri.TryCreate(options.FrontendBaseUrl, UriKind.Absolute, out var uri)
            && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps),
        "PasswordRecovery:FrontendBaseUrl must be an absolute HTTP or HTTPS URL.")
    .ValidateOnStart();
builder.Services.AddSingleton<IPasswordRecoveryEmailSender, SmtpPasswordRecoveryEmailSender>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/problem+json";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            type = "https://httpstatuses.com/429",
            title = "Too many requests",
            status = StatusCodes.Status429TooManyRequests,
            detail = "Too many attempts were received. Please wait before trying again."
        }, cancellationToken);
    };
    options.AddPolicy("login", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10, Window = TimeSpan.FromMinutes(1), QueueLimit = 0,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst, AutoReplenishment = true
        }));
    options.AddPolicy("public-verification", context => RateLimitPartition.GetSlidingWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new SlidingWindowRateLimiterOptions
        {
            PermitLimit = 60, Window = TimeSpan.FromMinutes(1), SegmentsPerWindow = 6, QueueLimit = 0,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst, AutoReplenishment = true
        }));
    options.AddPolicy("password-recovery", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 5, Window = TimeSpan.FromMinutes(15), QueueLimit = 0,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst, AutoReplenishment = true
        }));
});

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
        ValidIssuer = jwt.Issuer, ValidAudience = jwt.Audience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)), ClockSkew = TimeSpan.FromMinutes(1)
    };
    options.Events = new JwtBearerEvents
    {
        OnTokenValidated = async context =>
        {
            var userId = context.Principal?.FindFirstValue(ClaimTypes.NameIdentifier);
            var tokenSecurityStamp = context.Principal?.FindFirstValue("security_stamp");
            if (!Guid.TryParse(userId, out _) || string.IsNullOrWhiteSpace(tokenSecurityStamp))
            {
                context.Fail("The authentication token is missing required account claims.");
                return;
            }

            var userManager = context.HttpContext.RequestServices.GetRequiredService<UserManager<ApplicationUser>>();
            var user = await userManager.FindByIdAsync(userId);
            var accountLocked = user?.LockoutEnd is { } lockoutEnd && lockoutEnd > DateTimeOffset.UtcNow;
            if (user is null || user.IsDeleted || accountLocked
                || !string.Equals(user.SecurityStamp, tokenSecurityStamp, StringComparison.Ordinal))
            {
                context.Fail("The account or authentication session is no longer active.");
                return;
            }

            if (user.UniversityId.HasValue)
            {
                var db = context.HttpContext.RequestServices.GetRequiredService<ApplicationDbContext>();
                var universityIsActive = await db.Universities.AsNoTracking()
                    .AnyAsync(item => item.Id == user.UniversityId.Value && item.IsActive, context.HttpContext.RequestAborted);
                if (!universityIsActive)
                    context.Fail("The assigned university is no longer active.");
            }
        }
    };
});
builder.Services.AddAuthorization();
var origins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() ?? ["http://localhost:5173"];
builder.Services.AddCors(options => options.AddPolicy("Frontend", policy => policy.WithOrigins(origins).AllowAnyHeader().AllowAnyMethod().AllowCredentials()));

var app = builder.Build();
app.UseExceptionHandler();
if (builder.Configuration.GetValue<bool>("ReverseProxy:TrustForwardedHeaders")) app.UseForwardedHeaders();
if (!app.Environment.IsDevelopment()) app.UseHsts();
if (builder.Configuration.GetValue<bool>("HttpsRedirection:Enabled")) app.UseHttpsRedirection();
app.UseRouting();
app.UseCors("Frontend");
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapHub<NotificationHub>("/notificationHub");
app.MapGet("/", () => Results.Ok(new { service = "AfghanVerify API", status = "healthy" })).AllowAnonymous();
app.MapGet("/health/live", () => Results.Ok(new { status = "healthy" })).AllowAnonymous();
app.MapGet("/health/ready", async (ApplicationDbContext db, CancellationToken cancellationToken) =>
{
    try
    {
        return await db.Database.CanConnectAsync(cancellationToken)
            ? Results.Ok(new { status = "ready" })
            : Results.Json(new { status = "unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
    catch
    {
        return Results.Json(new { status = "unavailable" }, statusCode: StatusCodes.Status503ServiceUnavailable);
    }
}).AllowAnonymous();

if (builder.Configuration.GetValue<bool>("Database:InitializeOnStartup"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<ApplicationDbContext>();
    await db.Database.MigrateAsync();
    await DbContextSeed.SeedAsync(db);
    await IdentitySeeder.SeedAsync(scope.ServiceProvider, builder.Configuration);
}
app.Run();

static bool IsStrongBase64Key(string value)
{
    try { return Convert.FromBase64String(value).Length >= 32; }
    catch (FormatException) { return false; }
}

public partial class Program;
