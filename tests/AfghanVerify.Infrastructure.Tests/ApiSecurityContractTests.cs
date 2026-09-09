using System.ComponentModel.DataAnnotations;
using System.Reflection;
using System.Security.Claims;
using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.WebApi.Controllers;
using AfghanVerify.WebApi.Dtos;
using AfghanVerify.WebApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace AfghanVerify.Infrastructure.Tests;

public sealed class ApiSecurityContractTests
{
    [Theory]
    [InlineData(typeof(MinistryController), "Ministry")]
    [InlineData(typeof(CertificatesController), "University")]
    [InlineData(typeof(AdminUsersController), "SUPER_ADMIN,UNIVERSITY_ADMIN")]
    [InlineData(typeof(AdminUniversitiesController), "SUPER_ADMIN")]
    [InlineData(typeof(AuditLogsController), "SUPER_ADMIN")]
    public void PrivilegedControllers_RequireExpectedRoles(Type controllerType, string roles)
    {
        var authorize = controllerType.GetCustomAttribute<AuthorizeAttribute>();

        Assert.NotNull(authorize);
        Assert.Equal(roles, authorize.Roles);
    }

    [Fact]
    public void AuditLogController_IsReadOnly()
    {
        var actionMethods = typeof(AuditLogsController).GetMethods(BindingFlags.Instance | BindingFlags.Public | BindingFlags.DeclaredOnly);

        Assert.NotEmpty(actionMethods);
        Assert.All(actionMethods, method => Assert.NotNull(method.GetCustomAttribute<Microsoft.AspNetCore.Mvc.HttpGetAttribute>()));
    }

    [Fact]
    public void AuditService_StagesActorRoleOutcomeAndBoundedRequestMetadata()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=AuditModelInspection;Trusted_Connection=True")
            .Options;
        using var db = new ApplicationDbContext(options);
        var identity = new ClaimsIdentity([
            new Claim(ClaimTypes.NameIdentifier, "actor-123"),
            new Claim(ClaimTypes.Name, "admin@afghanverify.local"),
            new Claim(ClaimTypes.Role, "SUPER_ADMIN")
        ], "test");
        var httpContext = new Microsoft.AspNetCore.Http.DefaultHttpContext
        {
            User = new ClaimsPrincipal(identity)
        };
        httpContext.Request.Headers.UserAgent = new string('x', 600);
        var service = new AuditService(db, new Microsoft.AspNetCore.Http.HttpContextAccessor { HttpContext = httpContext });

        service.Record("UniversityUpdated", nameof(University), Guid.NewGuid().ToString(), new { Code = "KU" });

        var entry = Assert.Single(db.AuditLogs.Local);
        Assert.Equal("actor-123", entry.UserId);
        Assert.Equal("admin@afghanverify.local", entry.UserName);
        Assert.Equal("SUPER_ADMIN", entry.ActorRole);
        Assert.Equal("Succeeded", entry.Outcome);
        Assert.Equal(512, entry.UserAgent.Length);
        Assert.Contains("KU", entry.Details);
    }

    [Fact]
    public void PublicVerificationController_IsExplicitlyAnonymous()
    {
        Assert.NotNull(typeof(VerificationController).GetCustomAttribute<AllowAnonymousAttribute>());
    }

    [Fact]
    public void IssueContract_RequiresExactlyThirteenTazkiraDigits()
    {
        var parameter = typeof(IssueCertificateDto).GetConstructors().Single().GetParameters()
            .Single(item => item.Name == "TazkiraNumber");
        var required = parameter.GetCustomAttribute<RequiredAttribute>();
        var pattern = parameter.GetCustomAttribute<RegularExpressionAttribute>();

        Assert.Equal("Tazkira number is required.", required?.ErrorMessage);
        Assert.Equal("^[0-9]{13}$", pattern?.Pattern);
        Assert.False(pattern!.IsValid("120104030214"));
        Assert.True(pattern.IsValid("1201040302145"));
        Assert.False(pattern.IsValid("1201-0403-02145"));
    }

    [Theory]
    [InlineData("Amina Rahimi", true)]
    [InlineData("آمنه رحیمی", true)]
    [InlineData("Amina 2", false)]
    [InlineData("Amina!", false)]
    [InlineData("   ", false)]
    public void AfghanPersonNameValidation_AcceptsOnlySupportedLettersAndSpaces(string value, bool expected)
    {
        Assert.Equal(expected, new AfghanPersonNameAttribute().IsValid(value));
    }

    [Theory]
    [InlineData(null, true)]
    [InlineData("", true)]
    [InlineData("https://storage.example.edu/diploma.pdf", true)]
    [InlineData("http://storage.example.edu/transcript.png", true)]
    [InlineData("ftp://storage.example.edu/file.pdf", false)]
    [InlineData("not-a-url", false)]
    public void OptionalDocumentUrlValidation_AllowsOnlyAbsoluteHttpUrls(string? value, bool expected)
    {
        Assert.Equal(expected, new OptionalHttpUrlAttribute().IsValid(value));
    }

    [Theory]
    [InlineData("KU", true)]
    [InlineData("KPU", true)]
    [InlineData("abcd", true)]
    [InlineData("K", false)]
    [InlineData("KABUL", false)]
    [InlineData("KU-1", false)]
    public void UniversityCodeValidation_EnforcesCredentialPrefixFormat(string value, bool expected)
    {
        var parameter = typeof(CreateUniversityDto).GetConstructors().Single().GetParameters()
            .Single(item => item.Name == "Code");
        var pattern = parameter.GetCustomAttribute<RegularExpressionAttribute>();

        Assert.NotNull(pattern);
        Assert.Equal(expected, pattern.IsValid(value));
    }

    [Fact]
    public void UniversityWriteContracts_DoNotAcceptAClientControlledLogoPath()
    {
        Assert.Null(typeof(CreateUniversityDto).GetProperty("LogoUrl"));
        Assert.Null(typeof(UpdateUniversityDto).GetProperty("LogoUrl"));
    }

    [Fact]
    public void AcademicStructureModel_UsesScopedOneToManyRelationshipsAndUniqueNames()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer("Server=(localdb)\\MSSQLLocalDB;Database=ModelInspection;Trusted_Connection=True")
            .Options;
        using var db = new ApplicationDbContext(options);
        var faculty = db.Model.FindEntityType(typeof(Faculty))!;
        var department = db.Model.FindEntityType(typeof(Department))!;

        var facultyForeignKey = faculty.GetForeignKeys().Single(item => item.PrincipalEntityType.ClrType == typeof(University));
        var departmentForeignKey = department.GetForeignKeys().Single(item => item.PrincipalEntityType.ClrType == typeof(Faculty));
        Assert.False(facultyForeignKey.IsUnique);
        Assert.False(departmentForeignKey.IsUnique);

        Assert.Contains(faculty.GetIndexes(), index => index.IsUnique
            && index.Properties.Select(property => property.Name).SequenceEqual(["UniversityId", "Name"]));
        Assert.Contains(department.GetIndexes(), index => index.IsUnique
            && index.Properties.Select(property => property.Name).SequenceEqual(["FacultyId", "Name"]));
    }
}
