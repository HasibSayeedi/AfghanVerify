using AfghanVerify.Core.Entities;
using AfghanVerify.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AfghanVerify.Infrastructure.Data;

public sealed class ApplicationDbContext : IdentityDbContext<ApplicationUser, IdentityRole<Guid>, Guid>
{
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }
    public DbSet<University> Universities => Set<University>();
    public DbSet<Faculty> Faculties => Set<Faculty>();
    public DbSet<Department> Departments => Set<Department>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<Certificate> Certificates => Set<Certificate>();
    public DbSet<VerificationRequest> VerificationRequests => Set<VerificationRequest>();
    public DbSet<Grade> Grades => Set<Grade>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.Entity<Certificate>(entity =>
        {
            entity.HasIndex(c => c.VerificationCode).IsUnique();
            entity.Property(c => c.VerificationCode).HasMaxLength(16).IsRequired();
            entity.Property(c => c.DocumentType).HasMaxLength(32).IsRequired();
            entity.Property(c => c.IssuanceSystem).HasMaxLength(32).IsRequired();
            entity.Property(c => c.LegacyMaktoubNumber).HasMaxLength(128);
            entity.Property(c => c.Status).HasMaxLength(32).IsRequired();
            entity.Property(c => c.DigitalHash).HasMaxLength(64).IsRequired();
            entity.Property(c => c.SigningKeyId).HasMaxLength(64).IsRequired();
            entity.Property(c => c.RowVersion).IsRowVersion();
            entity.HasOne(c => c.Student).WithMany(s => s.Certificates).HasForeignKey(c => c.StudentId);
            entity.HasOne(c => c.SupersedesCertificate).WithMany(c => c.Replacements)
                .HasForeignKey(c => c.SupersedesCertificateId).OnDelete(DeleteBehavior.Restrict);
            entity.HasIndex(c => c.SupersedesCertificateId);
        });
        modelBuilder.Entity<Student>(entity =>
        {
            entity.Property(s => s.TazkiraNumber).HasMaxLength(64).IsRequired();
            entity.Property(s => s.Faculty).HasMaxLength(200).IsRequired();
            entity.Property(s => s.Department).HasMaxLength(200).IsRequired();
            entity.HasOne(s => s.University).WithMany(u => u.Students).HasForeignKey(s => s.UniversityId).OnDelete(DeleteBehavior.Restrict);
            entity.HasOne(s => s.FacultyRecord).WithMany().HasForeignKey(s => s.FacultyId).OnDelete(DeleteBehavior.NoAction);
            entity.HasOne(s => s.DepartmentRecord).WithMany().HasForeignKey(s => s.DepartmentId).OnDelete(DeleteBehavior.NoAction);
        });
        modelBuilder.Entity<Grade>().HasOne(g => g.Student).WithMany(s => s.Grades).HasForeignKey(g => g.StudentId);
        modelBuilder.Entity<University>(entity =>
        {
            entity.HasIndex(u => u.Code).IsUnique();
            // Legacy imports can contain repeated display names. The API normalizes and
            // rejects new duplicates; this lookup index must remain non-unique so migrations
            // never discard or rename historical institutions.
            entity.HasIndex(u => u.NameEnglish);
            entity.Property(u => u.Code).HasMaxLength(16).IsRequired();
            entity.Property(u => u.NameEnglish).HasMaxLength(200).IsRequired();
            entity.Property(u => u.NameDari).HasMaxLength(200);
            entity.Property(u => u.NamePashto).HasMaxLength(200);
            entity.Property(u => u.ShortName).HasMaxLength(80).IsRequired();
            entity.Property(u => u.UniversityType).HasMaxLength(16).IsRequired();
            entity.Property(u => u.Province).HasMaxLength(100).IsRequired();
            entity.Property(u => u.City).HasMaxLength(100).IsRequired();
            entity.Property(u => u.CampusBranch).HasMaxLength(150);
            entity.Property(u => u.OfficialAddress).HasMaxLength(500).IsRequired();
            entity.Property(u => u.OfficialEmail).HasMaxLength(256).IsRequired();
            entity.Property(u => u.OfficialPhoneNumber).HasMaxLength(32).IsRequired();
            entity.Property(u => u.Website).HasMaxLength(2048);
            entity.Property(u => u.Location).HasMaxLength(200).IsRequired();
            entity.Property(u => u.LogoUrl).HasMaxLength(2048);
            entity.Property(u => u.PrimaryColor).HasMaxLength(16).IsRequired();
            entity.Property(u => u.RowVersion).IsRowVersion();
        });
        modelBuilder.Entity<ApplicationUser>(entity =>
        {
            entity.HasIndex(user => user.UniversityId);
            entity.HasOne(user => user.University).WithMany().HasForeignKey(user => user.UniversityId)
                .OnDelete(DeleteBehavior.Restrict);
        });
        modelBuilder.Entity<Faculty>(entity =>
        {
            entity.Property(f => f.Name).HasMaxLength(200).IsRequired();
            entity.HasIndex(f => new { f.UniversityId, f.Name }).IsUnique();
            entity.HasOne(f => f.University).WithMany(u => u.Faculties).HasForeignKey(f => f.UniversityId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<Department>(entity =>
        {
            entity.Property(d => d.Name).HasMaxLength(200).IsRequired();
            entity.HasIndex(d => new { d.FacultyId, d.Name }).IsUnique();
            entity.HasOne(d => d.Faculty).WithMany(f => f.Departments).HasForeignKey(d => d.FacultyId).OnDelete(DeleteBehavior.Cascade);
        });
        modelBuilder.Entity<AuditLog>(entity =>
        {
            entity.Property(a => a.Action).HasMaxLength(100).IsRequired();
            entity.Property(a => a.EntityType).HasMaxLength(100).IsRequired();
            entity.Property(a => a.EntityId).HasMaxLength(128);
            entity.Property(a => a.UserId).HasMaxLength(128);
            entity.Property(a => a.UserName).HasMaxLength(256);
            entity.Property(a => a.ActorRole).HasMaxLength(256);
            entity.Property(a => a.Outcome).HasMaxLength(32).IsRequired();
            entity.Property(a => a.IpAddress).HasMaxLength(64);
            entity.Property(a => a.UserAgent).HasMaxLength(512);
            entity.Property(a => a.Details).HasMaxLength(4000);
            entity.HasIndex(a => a.CreatedAt);
            entity.HasIndex(a => new { a.EntityType, a.EntityId });
        });
    }
}
