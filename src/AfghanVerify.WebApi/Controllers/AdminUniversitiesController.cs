using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Data;
using AfghanVerify.Infrastructure.Identity;
using AfghanVerify.WebApi.Dtos;
using AfghanVerify.WebApi.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace AfghanVerify.WebApi.Controllers;

[ApiController]
[Route("api/admin/universities")]
[Authorize(Roles = SuperAdminRole)]
public sealed class AdminUniversitiesController : ControllerBase
{
    private const string SuperAdminRole = "SUPER_ADMIN";
    private const string UniversityAdminRole = "UNIVERSITY_ADMIN";
    private readonly ApplicationDbContext _db;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly AuditService _audit;
    private readonly UniversityLogoStorage _logoStorage;

    public AdminUniversitiesController(ApplicationDbContext db, UserManager<ApplicationUser> userManager, AuditService audit,
        UniversityLogoStorage logoStorage)
    {
        _db = db;
        _userManager = userManager;
        _audit = audit;
        _logoStorage = logoStorage;
    }

    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<UniversityManagementDto>>> List(CancellationToken cancellationToken)
    {
        var universities = await _db.Universities.AsNoTracking().OrderBy(item => item.NameEnglish)
            .ToListAsync(cancellationToken);
        return Ok(await BuildDtosAsync(universities, cancellationToken));
    }

    [HttpGet("options")]
    public async Task<ActionResult<IReadOnlyList<UniversityDto>>> Options(CancellationToken cancellationToken)
    {
        var items = await _db.Universities.AsNoTracking().Where(item => item.IsActive)
            .OrderBy(item => item.NameEnglish)
            .Select(item => new UniversityDto(item.Id, item.NameEnglish, item.NameDari, item.NamePashto,
                item.Code, item.LogoUrl, item.PrimaryColor, Array.Empty<FacultyDto>()))
            .ToListAsync(cancellationToken);
        return Ok(items);
    }

    [HttpGet("administrator-options")]
    public async Task<ActionResult<IReadOnlyList<UniversityAdminOptionDto>>> AdministratorOptions(CancellationToken cancellationToken)
    {
        var roleId = await _db.Roles.AsNoTracking().Where(role => role.NormalizedName == UniversityAdminRole)
            .Select(role => (Guid?)role.Id).SingleOrDefaultAsync(cancellationToken);
        if (!roleId.HasValue) return Ok(Array.Empty<UniversityAdminOptionDto>());

        var admins = await (from user in _db.Users.AsNoTracking()
                            join userRole in _db.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
                            join university in _db.Universities.AsNoTracking() on user.UniversityId equals university.Id into universityJoin
                            from university in universityJoin.DefaultIfEmpty()
                            where userRole.RoleId == roleId.Value && !user.IsDeleted
                            orderby user.DisplayName
                            select new UniversityAdminOptionDto(user.Id, user.DisplayName, user.Email ?? user.UserName ?? "",
                                user.UniversityId, university == null ? null : university.NameEnglish,
                                !user.LockoutEnd.HasValue || user.LockoutEnd <= DateTimeOffset.UtcNow))
            .ToListAsync(cancellationToken);
        return Ok(admins);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UniversityManagementDto>> Get(Guid id, CancellationToken cancellationToken)
    {
        var university = await _db.Universities.AsNoTracking().SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (university is null) return NotFound(new { message = "The university was not found." });
        return Ok((await BuildDtosAsync([university], cancellationToken))[0]);
    }

    [HttpPost]
    public async Task<ActionResult<UniversityManagementDto>> Create(CreateUniversityDto request, CancellationToken cancellationToken)
    {
        var name = NormalizeWords(request.OfficialName);
        var code = request.Code.Trim().ToUpperInvariant();
        if (!ValidateRequiredText(request, name, request.ShortName, request.Province, request.City,
                request.OfficialAddress))
            return ValidationProblem(ModelState);
        if (await _db.Universities.AnyAsync(item => item.Code == code, cancellationToken))
            return Conflict(new { message = "A university with this code already exists." });
        if (await _db.Universities.AnyAsync(item => item.NameEnglish == name, cancellationToken))
            return Conflict(new { message = "A university with this official name already exists." });

        var admin = await ResolveAdministratorAsync(request.UniversityAdminUserId, cancellationToken);
        if (request.UniversityAdminUserId.HasValue && admin is null) return ValidationProblem(ModelState);

        var university = new University { Id = Guid.NewGuid() };
        Apply(university, request.OfficialName, request.NameDari, request.NamePashto, request.Code,
            request.ShortName, request.UniversityType, request.Province, request.City, request.CampusBranch,
            request.OfficialAddress, request.OfficialEmail, request.OfficialPhoneNumber, request.Website,
            request.IsActive);
        try
        {
            var strategy = _db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                _db.Universities.Add(university);
                await _db.SaveChangesAsync(cancellationToken);
                if (admin is not null) await AssignAdministratorAsync(admin, university.Id);
                _audit.Record("UniversityCreated", nameof(University), university.Id.ToString(),
                    new { university.Code, university.NameEnglish, university.IsActive, AdministratorId = admin?.Id });
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The university code or official name conflicts with an existing record." });
        }

        var response = (await BuildDtosAsync([university], cancellationToken))[0];
        return CreatedAtAction(nameof(Get), new { id = university.Id }, response);
    }

    [HttpPut("{id:guid}")]
    public async Task<ActionResult<UniversityManagementDto>> Update(Guid id, UpdateUniversityDto request,
        CancellationToken cancellationToken)
    {
        var university = await _db.Universities.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (university is null) return NotFound(new { message = "The university was not found." });
        if (!TrySetConcurrencyToken(university, request.RowVersion)) return ValidationProblem(ModelState);

        var name = NormalizeWords(request.OfficialName);
        var code = request.Code.Trim().ToUpperInvariant();
        if (!ValidateRequiredText(request, name, request.ShortName, request.Province, request.City, request.OfficialAddress))
            return ValidationProblem(ModelState);
        if (await _db.Universities.AnyAsync(item => item.Id != id && item.Code == code, cancellationToken))
            return Conflict(new { message = "A university with this code already exists." });
        if (await _db.Universities.AnyAsync(item => item.Id != id && item.NameEnglish == name, cancellationToken))
            return Conflict(new { message = "A university with this official name already exists." });

        var admin = await ResolveAdministratorAsync(request.UniversityAdminUserId, cancellationToken);
        if (request.UniversityAdminUserId.HasValue && admin is null) return ValidationProblem(ModelState);
        Apply(university, request.OfficialName, request.NameDari, request.NamePashto, request.Code,
            request.ShortName, request.UniversityType, request.Province, request.City, request.CampusBranch,
            request.OfficialAddress, request.OfficialEmail, request.OfficialPhoneNumber, request.Website,
            request.IsActive);

        try
        {
            var strategy = _db.Database.CreateExecutionStrategy();
            await strategy.ExecuteAsync(async () =>
            {
                await using var transaction = await _db.Database.BeginTransactionAsync(cancellationToken);
                await _db.SaveChangesAsync(cancellationToken);
                if (admin is not null && admin.UniversityId != university.Id) await AssignAdministratorAsync(admin, university.Id);
                _audit.Record("UniversityUpdated", nameof(University), university.Id.ToString(),
                    new { university.Code, university.NameEnglish, university.IsActive, AdministratorId = admin?.Id });
                await _db.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "This university changed while it was being edited. Refresh and try again." });
        }
        catch (DbUpdateException)
        {
            return Conflict(new { message = "The university code or official name conflicts with an existing record." });
        }

        return Ok((await BuildDtosAsync([university], cancellationToken))[0]);
    }

    [HttpPost("{id:guid}/logo")]
    [Consumes("multipart/form-data")]
    [RequestSizeLimit(UniversityLogoStorage.MaximumFileSize + 64 * 1024)]
    public async Task<ActionResult<UniversityManagementDto>> UploadLogo(Guid id, IFormFile? logo,
        CancellationToken cancellationToken)
    {
        if (logo is null) return BadRequest(new { message = "Choose a university logo to upload." });
        var university = await _db.Universities.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (university is null) return NotFound(new { message = "The university was not found." });

        string newPath;
        try { newPath = await _logoStorage.SaveAsync(university.Id, logo, cancellationToken); }
        catch (InvalidDataException exception) { return BadRequest(new { message = exception.Message }); }

        var oldPath = university.LogoUrl;
        university.LogoUrl = newPath;
        _audit.Record("UniversityLogoReplaced", nameof(University), university.Id.ToString(), new { university.Code });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch
        {
            await _logoStorage.DeleteIfManagedAsync(newPath);
            throw;
        }
        await _logoStorage.DeleteIfManagedAsync(oldPath);
        return Ok((await BuildDtosAsync([university], cancellationToken))[0]);
    }

    [HttpDelete("{id:guid}/logo")]
    public async Task<ActionResult<UniversityManagementDto>> RemoveLogo(Guid id, CancellationToken cancellationToken)
    {
        var university = await _db.Universities.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (university is null) return NotFound(new { message = "The university was not found." });
        var oldPath = university.LogoUrl;
        university.LogoUrl = "";
        _audit.Record("UniversityLogoRemoved", nameof(University), university.Id.ToString(), new { university.Code });
        await _db.SaveChangesAsync(cancellationToken);
        await _logoStorage.DeleteIfManagedAsync(oldPath);
        return Ok((await BuildDtosAsync([university], cancellationToken))[0]);
    }

    [HttpPut("{id:guid}/status")]
    public async Task<ActionResult<UniversityManagementDto>> UpdateStatus(Guid id, UpdateUniversityStatusDto request,
        CancellationToken cancellationToken)
    {
        var university = await _db.Universities.SingleOrDefaultAsync(item => item.Id == id, cancellationToken);
        if (university is null) return NotFound(new { message = "The university was not found." });
        if (!TrySetConcurrencyToken(university, request.RowVersion)) return ValidationProblem(ModelState);
        university.IsActive = request.IsActive;
        try
        {
            _audit.Record(request.IsActive ? "UniversityActivated" : "UniversityDeactivated",
                nameof(University), university.Id.ToString(), new { university.Code });
            await _db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateConcurrencyException)
        {
            return Conflict(new { message = "This university changed while its status was being updated. Refresh and try again." });
        }
        return Ok((await BuildDtosAsync([university], cancellationToken))[0]);
    }

    [HttpGet("{universityId:guid}/academic-structure")]
    public async Task<ActionResult<AcademicStructureDto>> AcademicStructure(Guid universityId,
        CancellationToken cancellationToken)
    {
        var university = await _db.Universities.AsNoTracking().AsSplitQuery()
            .Include(item => item.Faculties).ThenInclude(faculty => faculty.Departments)
            .SingleOrDefaultAsync(item => item.Id == universityId, cancellationToken);
        if (university is null) return NotFound(new { message = "The university was not found." });
        return Ok(await BuildAcademicStructureAsync(university, cancellationToken));
    }

    [HttpPost("{universityId:guid}/faculties")]
    public async Task<ActionResult<ManagedFacultyDto>> CreateFaculty(Guid universityId,
        CreateAcademicUnitDto request, CancellationToken cancellationToken)
    {
        var name = NormalizeWords(request.Name);
        if (!ValidateAcademicUnitName(name)) return ValidationProblem(ModelState);
        if (!await _db.Universities.AnyAsync(item => item.Id == universityId, cancellationToken))
            return NotFound(new { message = "The university was not found." });
        if (await _db.Faculties.AnyAsync(item => item.UniversityId == universityId && item.Name == name, cancellationToken))
            return Conflict(new { message = "A faculty with this name already exists in the university." });

        var faculty = new Faculty { Id = Guid.NewGuid(), UniversityId = universityId, Name = name, IsActive = true };
        _db.Faculties.Add(faculty);
        _audit.Record("FacultyCreated", nameof(Faculty), faculty.Id.ToString(), new { universityId, faculty.Name });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "A faculty with this name already exists in the university." }); }
        return Created($"/api/admin/universities/{universityId}/faculties/{faculty.Id}",
            new ManagedFacultyDto(faculty.Id, faculty.Name, faculty.IsActive, 0, []));
    }

    [HttpPut("{universityId:guid}/faculties/{facultyId:guid}")]
    public async Task<ActionResult<ManagedFacultyDto>> UpdateFaculty(Guid universityId, Guid facultyId,
        UpdateAcademicUnitDto request, CancellationToken cancellationToken)
    {
        var faculty = await _db.Faculties.Include(item => item.Departments)
            .SingleOrDefaultAsync(item => item.Id == facultyId && item.UniversityId == universityId, cancellationToken);
        if (faculty is null) return NotFound(new { message = "The faculty was not found in this university." });
        var name = NormalizeWords(request.Name);
        if (!ValidateAcademicUnitName(name)) return ValidationProblem(ModelState);
        if (await _db.Faculties.AnyAsync(item => item.UniversityId == universityId && item.Id != facultyId && item.Name == name, cancellationToken))
            return Conflict(new { message = "A faculty with this name already exists in the university." });
        faculty.Name = name;
        _audit.Record("FacultyUpdated", nameof(Faculty), faculty.Id.ToString(), new { universityId, faculty.Name });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "A faculty with this name already exists in the university." }); }
        return Ok(await BuildManagedFacultyAsync(faculty, cancellationToken));
    }

    [HttpPut("{universityId:guid}/faculties/{facultyId:guid}/status")]
    public async Task<ActionResult<ManagedFacultyDto>> UpdateFacultyStatus(Guid universityId, Guid facultyId,
        UpdateAcademicUnitStatusDto request, CancellationToken cancellationToken)
    {
        var faculty = await _db.Faculties.Include(item => item.Departments)
            .SingleOrDefaultAsync(item => item.Id == facultyId && item.UniversityId == universityId, cancellationToken);
        if (faculty is null) return NotFound(new { message = "The faculty was not found in this university." });
        faculty.IsActive = request.IsActive;
        _audit.Record(request.IsActive ? "FacultyActivated" : "FacultyDeactivated", nameof(Faculty),
            faculty.Id.ToString(), new { universityId, faculty.Name });
        await _db.SaveChangesAsync(cancellationToken);
        return Ok(await BuildManagedFacultyAsync(faculty, cancellationToken));
    }

    [HttpPost("{universityId:guid}/faculties/{facultyId:guid}/departments")]
    public async Task<ActionResult<ManagedDepartmentDto>> CreateDepartment(Guid universityId, Guid facultyId,
        CreateAcademicUnitDto request, CancellationToken cancellationToken)
    {
        var facultyExists = await _db.Faculties.AnyAsync(
            item => item.Id == facultyId && item.UniversityId == universityId, cancellationToken);
        if (!facultyExists) return NotFound(new { message = "The faculty was not found in this university." });
        var name = NormalizeWords(request.Name);
        if (!ValidateAcademicUnitName(name)) return ValidationProblem(ModelState);
        if (await _db.Departments.AnyAsync(item => item.FacultyId == facultyId && item.Name == name, cancellationToken))
            return Conflict(new { message = "A department with this name already exists in the faculty." });

        // FacultyId is derived from the scoped route and verified above; it is never accepted from the payload.
        var department = new Department { Id = Guid.NewGuid(), FacultyId = facultyId, Name = name, IsActive = true };
        _db.Departments.Add(department);
        _audit.Record("DepartmentCreated", nameof(Department), department.Id.ToString(),
            new { universityId, facultyId, department.Name });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "A department with this name already exists in the faculty." }); }
        return Created($"/api/admin/universities/{universityId}/faculties/{facultyId}/departments/{department.Id}",
            new ManagedDepartmentDto(department.Id, department.Name, department.IsActive, 0));
    }

    [HttpPut("{universityId:guid}/faculties/{facultyId:guid}/departments/{departmentId:guid}")]
    public async Task<ActionResult<ManagedDepartmentDto>> UpdateDepartment(Guid universityId, Guid facultyId,
        Guid departmentId, UpdateAcademicUnitDto request, CancellationToken cancellationToken)
    {
        var department = await _db.Departments.Include(item => item.Faculty)
            .SingleOrDefaultAsync(item => item.Id == departmentId && item.FacultyId == facultyId
                && item.Faculty != null && item.Faculty.UniversityId == universityId, cancellationToken);
        if (department is null) return NotFound(new { message = "The department was not found in this faculty." });
        var name = NormalizeWords(request.Name);
        if (!ValidateAcademicUnitName(name)) return ValidationProblem(ModelState);
        if (await _db.Departments.AnyAsync(item => item.FacultyId == facultyId && item.Id != departmentId && item.Name == name, cancellationToken))
            return Conflict(new { message = "A department with this name already exists in the faculty." });
        department.Name = name;
        _audit.Record("DepartmentUpdated", nameof(Department), department.Id.ToString(),
            new { universityId, facultyId, department.Name });
        try { await _db.SaveChangesAsync(cancellationToken); }
        catch (DbUpdateException) { return Conflict(new { message = "A department with this name already exists in the faculty." }); }
        var studentCount = await _db.Students.CountAsync(student => student.DepartmentId == department.Id, cancellationToken);
        return Ok(new ManagedDepartmentDto(department.Id, department.Name, department.IsActive, studentCount));
    }

    [HttpPut("{universityId:guid}/faculties/{facultyId:guid}/departments/{departmentId:guid}/status")]
    public async Task<ActionResult<ManagedDepartmentDto>> UpdateDepartmentStatus(Guid universityId, Guid facultyId,
        Guid departmentId, UpdateAcademicUnitStatusDto request, CancellationToken cancellationToken)
    {
        var department = await _db.Departments.Include(item => item.Faculty)
            .SingleOrDefaultAsync(item => item.Id == departmentId && item.FacultyId == facultyId
                && item.Faculty != null && item.Faculty.UniversityId == universityId, cancellationToken);
        if (department is null) return NotFound(new { message = "The department was not found in this faculty." });
        department.IsActive = request.IsActive;
        _audit.Record(request.IsActive ? "DepartmentActivated" : "DepartmentDeactivated", nameof(Department),
            department.Id.ToString(), new { universityId, facultyId, department.Name });
        await _db.SaveChangesAsync(cancellationToken);
        var studentCount = await _db.Students.CountAsync(student => student.DepartmentId == department.Id, cancellationToken);
        return Ok(new ManagedDepartmentDto(department.Id, department.Name, department.IsActive, studentCount));
    }

    private async Task<ApplicationUser?> ResolveAdministratorAsync(Guid? userId, CancellationToken cancellationToken)
    {
        if (!userId.HasValue) return null;
        var user = await _userManager.FindByIdAsync(userId.Value.ToString());
        if (user is null || user.IsDeleted || !await _userManager.IsInRoleAsync(user, UniversityAdminRole))
        {
            ModelState.AddModelError("UniversityAdminUserId", "Select a valid University Admin account.");
            return null;
        }
        cancellationToken.ThrowIfCancellationRequested();
        return user;
    }

    private bool ValidateAcademicUnitName(string name)
    {
        if (!string.IsNullOrWhiteSpace(name)) return true;
        ModelState.AddModelError("Name", "Name is required and cannot contain only spaces.");
        return false;
    }

    private async Task<AcademicStructureDto> BuildAcademicStructureAsync(University university,
        CancellationToken cancellationToken)
    {
        var facultyIds = university.Faculties.Select(item => item.Id).ToArray();
        var departmentIds = university.Faculties.SelectMany(item => item.Departments).Select(item => item.Id).ToArray();
        var facultyStudentCounts = facultyIds.Length == 0 ? [] : await _db.Students.AsNoTracking()
            .Where(student => student.FacultyId.HasValue && facultyIds.Contains(student.FacultyId.Value))
            .GroupBy(student => student.FacultyId!.Value).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Id, item => item.Count, cancellationToken);
        var departmentStudentCounts = departmentIds.Length == 0 ? [] : await _db.Students.AsNoTracking()
            .Where(student => student.DepartmentId.HasValue && departmentIds.Contains(student.DepartmentId.Value))
            .GroupBy(student => student.DepartmentId!.Value).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Id, item => item.Count, cancellationToken);

        var faculties = university.Faculties.OrderBy(item => item.Name).Select(faculty =>
            new ManagedFacultyDto(faculty.Id, faculty.Name, faculty.IsActive,
                facultyStudentCounts.GetValueOrDefault(faculty.Id),
                faculty.Departments.OrderBy(item => item.Name).Select(department =>
                    new ManagedDepartmentDto(department.Id, department.Name, department.IsActive,
                        departmentStudentCounts.GetValueOrDefault(department.Id))).ToList())).ToList();
        return new AcademicStructureDto(university.Id, university.NameEnglish, faculties);
    }

    private async Task<ManagedFacultyDto> BuildManagedFacultyAsync(Faculty faculty,
        CancellationToken cancellationToken)
    {
        var departmentIds = faculty.Departments.Select(item => item.Id).ToArray();
        var departmentCounts = departmentIds.Length == 0 ? [] : await _db.Students.AsNoTracking()
            .Where(student => student.DepartmentId.HasValue && departmentIds.Contains(student.DepartmentId.Value))
            .GroupBy(student => student.DepartmentId!.Value).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Id, item => item.Count, cancellationToken);
        var studentCount = await _db.Students.CountAsync(student => student.FacultyId == faculty.Id, cancellationToken);
        return new ManagedFacultyDto(faculty.Id, faculty.Name, faculty.IsActive, studentCount,
            faculty.Departments.OrderBy(item => item.Name).Select(item =>
                new ManagedDepartmentDto(item.Id, item.Name, item.IsActive,
                    departmentCounts.GetValueOrDefault(item.Id))).ToList());
    }

    private async Task AssignAdministratorAsync(ApplicationUser admin, Guid universityId)
    {
        admin.UniversityId = universityId;
        var update = await _userManager.UpdateAsync(admin);
        if (!update.Succeeded) throw new InvalidOperationException(string.Join(" ", update.Errors.Select(error => error.Description)));
        // Scope changes invalidate existing JWTs; the administrator must sign in again under the new university.
        var stamp = await _userManager.UpdateSecurityStampAsync(admin);
        if (!stamp.Succeeded) throw new InvalidOperationException(string.Join(" ", stamp.Errors.Select(error => error.Description)));
    }

    private bool TrySetConcurrencyToken(University university, string rowVersion)
    {
        try
        {
            var original = Convert.FromBase64String(rowVersion);
            if (original.Length == 0) throw new FormatException();
            _db.Entry(university).Property(item => item.RowVersion).OriginalValue = original;
            return true;
        }
        catch (FormatException)
        {
            ModelState.AddModelError("RowVersion", "The university version is invalid. Refresh and try again.");
            return false;
        }
    }

    private bool ValidateRequiredText(object request, params string[] values)
    {
        if (values.All(value => !string.IsNullOrWhiteSpace(value))) return true;
        ModelState.AddModelError(request.GetType().Name, "Required text fields cannot contain only spaces.");
        return false;
    }

    private static void Apply(University university, string officialName, string? nameDari, string? namePashto,
        string code, string shortName, string universityType, string province, string city, string? campusBranch,
        string officialAddress, string officialEmail, string officialPhone, string? website, bool isActive)
    {
        university.NameEnglish = NormalizeWords(officialName);
        university.NameDari = NormalizeWords(nameDari ?? "");
        university.NamePashto = NormalizeWords(namePashto ?? "");
        university.Code = code.Trim().ToUpperInvariant();
        university.ShortName = NormalizeWords(shortName);
        university.UniversityType = universityType;
        university.Province = NormalizeWords(province);
        university.City = NormalizeWords(city);
        university.CampusBranch = NormalizeWords(campusBranch ?? "");
        university.OfficialAddress = NormalizeWords(officialAddress);
        university.OfficialEmail = officialEmail.Trim().ToLowerInvariant();
        university.OfficialPhoneNumber = officialPhone.Trim();
        university.Website = website?.Trim() ?? "";
        university.Location = string.Equals(university.Province, university.City, StringComparison.OrdinalIgnoreCase)
            ? university.City : $"{university.City}, {university.Province}";
        university.PrimaryColor = string.IsNullOrWhiteSpace(university.PrimaryColor) ? "#065f46" : university.PrimaryColor;
        university.IsActive = isActive;
    }

    private async Task<IReadOnlyList<UniversityManagementDto>> BuildDtosAsync(
        IReadOnlyCollection<University> universities, CancellationToken cancellationToken)
    {
        if (universities.Count == 0) return [];
        var ids = universities.Select(item => item.Id).ToArray();
        var userCounts = await _db.Users.AsNoTracking().Where(user => !user.IsDeleted && user.UniversityId.HasValue && ids.Contains(user.UniversityId.Value))
            .GroupBy(user => user.UniversityId!.Value).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Id, item => item.Count, cancellationToken);
        var studentCounts = await _db.Students.AsNoTracking().Where(student => ids.Contains(student.UniversityId))
            .GroupBy(student => student.UniversityId).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Id, item => item.Count, cancellationToken);
        var credentialCounts = await _db.Certificates.AsNoTracking().Where(certificate => certificate.Student != null && ids.Contains(certificate.Student.UniversityId))
            .GroupBy(certificate => certificate.Student!.UniversityId).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Id, item => item.Count, cancellationToken);
        var facultyCounts = await _db.Faculties.AsNoTracking().Where(faculty => ids.Contains(faculty.UniversityId))
            .GroupBy(faculty => faculty.UniversityId).Select(group => new { Id = group.Key, Count = group.Count() })
            .ToDictionaryAsync(item => item.Id, item => item.Count, cancellationToken);

        var adminRoleId = await _db.Roles.AsNoTracking().Where(role => role.NormalizedName == UniversityAdminRole)
            .Select(role => (Guid?)role.Id).SingleOrDefaultAsync(cancellationToken);
        var admins = adminRoleId.HasValue
            ? await (from user in _db.Users.AsNoTracking()
                     join userRole in _db.UserRoles.AsNoTracking() on user.Id equals userRole.UserId
                     where userRole.RoleId == adminRoleId.Value && !user.IsDeleted && user.UniversityId.HasValue && ids.Contains(user.UniversityId.Value)
                     orderby user.DisplayName
                     select new { user.Id, user.DisplayName, UniversityId = user.UniversityId!.Value }).ToListAsync(cancellationToken)
            : [];

        return universities.Select(university =>
        {
            var admin = admins.FirstOrDefault(item => item.UniversityId == university.Id);
            return new UniversityManagementDto(university.Id, university.NameEnglish, university.NameDari,
                university.NamePashto, university.Code, university.ShortName, university.UniversityType,
                university.Province, university.City, university.CampusBranch, university.OfficialAddress,
                university.OfficialEmail, university.OfficialPhoneNumber, university.Website, university.LogoUrl,
                university.IsActive, userCounts.GetValueOrDefault(university.Id), studentCounts.GetValueOrDefault(university.Id),
                credentialCounts.GetValueOrDefault(university.Id), facultyCounts.GetValueOrDefault(university.Id),
                admin?.Id, admin?.DisplayName, Convert.ToBase64String(university.RowVersion));
        }).ToList();
    }

    private static string NormalizeWords(string value) =>
        string.Join(' ', value.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));
}
