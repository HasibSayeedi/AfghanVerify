using System.Security.Cryptography;
using System.Text;
using AfghanVerify.Core.Entities;
using Microsoft.EntityFrameworkCore;

namespace AfghanVerify.Infrastructure.Data;

public static class DbContextSeed
{
    public static async Task SeedAsync(ApplicationDbContext context)
    {
        foreach (var item in AcademicInstitutions.All)
        {
            var university = await context.Universities.AsSplitQuery().Include(u => u.Faculties).ThenInclude(f => f.Departments)
                .SingleOrDefaultAsync(u => u.Code == item.Code);
            if (university is null)
            {
                university = new University { Id = StableId($"university:{item.Code}"), Code = item.Code };
                context.Universities.Add(university);
            }
            university.NameEnglish = item.Name; university.NameDari = item.Name; university.NamePashto = item.Name;
            university.Location = item.Location; university.LogoUrl = $"/api/universities/{item.Code}/logo";
            university.PrimaryColor = "#065f46"; university.IsActive = true;
            foreach (var facultyItem in item.Faculties)
            {
                var faculty = university.Faculties.SingleOrDefault(f => f.Name == facultyItem.Name);
                if (faculty is null)
                {
                    faculty = new Faculty { Id = StableId($"faculty:{item.Code}:{facultyItem.Name}"), Name = facultyItem.Name, IsActive = true };
                    university.Faculties.Add(faculty);
                    context.Faculties.Add(faculty);
                }
                foreach (var departmentName in facultyItem.Departments)
                    if (faculty.Departments.All(d => d.Name != departmentName))
                    {
                        var department = new Department { Id = StableId($"department:{item.Code}:{facultyItem.Name}:{departmentName}"), Name = departmentName, IsActive = true };
                        faculty.Departments.Add(department);
                        context.Departments.Add(department);
                    }
            }
        }
        await context.SaveChangesAsync();
    }

    private static Guid StableId(string value) => new(SHA256.HashData(Encoding.UTF8.GetBytes(value))[..16]);
}

internal sealed record FacultySeed(string Name, params string[] Departments);
internal sealed record UniversitySeed(string Name, string Code, string Location, params FacultySeed[] Faculties);

internal static class AcademicInstitutions
{
    private static FacultySeed F(string name, params string[] departments) => new(name, departments);
    public static readonly UniversitySeed[] All =
    [
        new("Kabul University", "KU", "Kabul", F("Computer Science", "Software Engineering", "Information Technology", "Information Systems"), F("Engineering", "Civil", "Mechanical", "Electrical", "Architecture"), F("Science", "Mathematics", "Physics", "Chemistry", "Biology"), F("Law and Political Science", "Law", "Political Science"), F("Economics", "Finance and Banking", "National Economy", "Business Administration"), F("Sharia", "Islamic Jurisprudence", "Islamic Studies"), F("Literature", "Pashto", "Dari", "English")),
        new("Kabul Polytechnic University", "KPU", "Kabul", F("Computer Science and Informatics", "Computer Engineering", "Information Technology", "Automation Control Systems"), F("Construction", "Civil and Industrial Construction", "Hydraulic Structures"), F("Geology and Mining", "Mining Engineering", "Geology Exploration"), F("Transportation", "Highway Engineering", "Railway Engineering")),
        new("Kabul University of Medical Sciences / Abu Ali Ibn Sina", "KMS", "Kabul", F("Medicine", "General Medicine", "Pediatrics", "Surgery"), F("Stomatology", "Therapeutic Stomatology", "Oral and Maxillofacial Surgery"), F("Public Health", "Environmental Health", "Epidemiology"), F("Nursing and Allied Health", "Nursing", "Medical Technology")),
        new("Shaheed Rabbani Education University", "KEU", "Kabul", F("Natural Sciences", "Mathematics Education", "Physics Education", "Chemistry Education"), F("Social Sciences", "History Education", "Geography Education"), F("Physical Education", "Sports Management", "Physical Training")),
        new("Balkh University", "BU", "Balkh", F("Engineering", "Civil", "Petroleum and Gas", "Architecture"), F("Economics", "Finance and Banking", "Business Administration"), F("Computer Science", "Software Engineering", "Information Technology"), F("Medicine", "General Medicine", "Pediatrics"), F("Agriculture", "Agronomy", "Animal Science"), F("Law", "General Law", "Political Science")),
        new("Herat University", "HU", "Herat", F("Computer Science", "Software Engineering", "Database Systems", "Networking"), F("Engineering", "Civil", "Mechanical"), F("Economics", "Commerce", "Management"), F("Medicine", "General Medicine"), F("Agriculture", "Agronomy", "Horticulture", "Plant Protection"), F("Fine Arts", "Painting", "Graphic Design")),
        new("Nangarhar University", "NU", "Nangarhar", F("Medicine", "General Medicine", "Public Health"), F("Engineering", "Civil", "Water Resources", "Electrical"), F("Computer Science", "Software Engineering", "Information Technology"), F("Agriculture", "Agronomy", "Plant Protection", "Horticulture"), F("Law & Sharia", "Sharia Law", "Judiciary and Law")),
        new("Kandahar University", "KD", "Kandahar", F("Engineering", "Civil", "Energy Engineering"), F("Computer Science", "Software Engineering", "Networking", "Information Technology"), F("Medicine", "General Medicine"), F("Agriculture", "Agronomy", "Animal Science"), F("Economics", "Business Administration", "Finance")),
        new("Shaikh Zayed University - Khost", "SZU", "Khost", F("Medicine", "General Medicine"), F("Engineering", "Civil"), F("Computer Science", "Information Technology"), F("Agriculture", "Agronomy")),
        new("Takhar University", "TU", "Takhar", F("Agriculture", "Agronomy"), F("Engineering", "Civil"), F("Education", "Mathematics", "Pashto")),
        new("Badakhshan University", "BDU", "Badakhshan", F("Agriculture", "Agronomy", "Animal Science"), F("Education", "Dari", "Pashto", "Chemistry"), F("Computer Science", "Information Technology")),
        new("Bamyan University", "BYU", "Bamyan", F("Agriculture", "Agronomy", "Animal Science"), F("Natural Sciences", "Biology", "Mathematics", "Physics"), F("Tourism & Social Sciences", "Tourism Management", "Sociology")),
        new("Faryab University", "FU", "Faryab", F("Engineering", "Civil"), F("Agriculture", "Agronomy"), F("Computer Science", "Information Technology")),
        new("Jowzjan University", "JU", "Jowzjan", F("Chemical Technology & Mining", "Petroleum Engineering", "Gas Exploration", "Chemical Technology"), F("Engineering", "Civil"), F("Computer Science", "Software Engineering")),
        new("Kunduz University", "KDU", "Kunduz", F("Agriculture", "Agronomy", "Animal Science"), F("Computer Science", "Information Technology"), F("Education", "Dari", "Pashto", "Mathematics")),
        new("Paktia University", "PU", "Paktia", F("Engineering", "Civil"), F("Agriculture", "Agronomy"), F("Medicine", "General Medicine")),
        new("Ghazni University", "GU", "Ghazni", F("Agriculture", "Agronomy"), F("Education", "Dari", "Pashto", "Physics"), F("Computer Science", "Software Engineering")),
        new("Baghlan University", "BHL", "Baghlan", F("Agriculture", "Agronomy"), F("Education", "Dari", "Pashto", "Mathematics")),
        new("Parwan University", "PRW", "Parwan", F("Agriculture", "Agronomy"), F("Education", "Dari", "Pashto", "Physics"), F("Computer Science", "Software Engineering")),
        new("Alberoni University - Kapisa", "ABU", "Kapisa", F("Medicine", "General Medicine"), F("Engineering", "Civil"), F("Law & Political Science", "Law")),
        new("Sayed Jamaluddin Afghani University - Kunar", "SJA", "Kunar", F("Agriculture", "Agronomy"), F("Education", "Pashto", "Mathematics")),
        new("Laghman University", "LGU", "Laghman", F("Agriculture", "Agronomy"), F("Engineering", "Civil")),
        new("Helmand University / Institute of Higher Education", "HMD", "Helmand", F("Agriculture", "Agronomy"), F("Engineering", "Civil")),
        new("Farah University / Institute of Higher Education", "FRH", "Farah", F("Agriculture", "Agronomy"), F("Education", "Dari", "Pashto")),
        new("Nimruz Institute of Higher Education", "NMR", "Nimruz", F("Agriculture", "Agronomy"), F("Education", "Dari")),
        new("Ghor University / Institute of Higher Education", "GHR", "Ghor", F("Agriculture", "Agronomy"), F("Education", "Dari", "Pashto")),
        new("Samangan University / Institute of Higher Education", "SMN", "Samangan", F("Agriculture", "Agronomy"), F("Education", "Dari")),
        new("Badghis Institute of Higher Education", "BDG", "Badghis", F("Agriculture", "Agronomy"), F("Education", "Dari")),
        new("Panjshir Institute of Higher Education", "PNJ", "Panjshir", F("Education", "Dari", "Mathematics"), F("Geology & Mining", "Mining Engineering")),
        new("Paktika Institute of Higher Education", "PKT", "Paktika", F("Education", "Pashto", "Mathematics")),
        new("Uruzgan Institute of Higher Education", "UZN", "Uruzgan", F("Education", "Pashto", "Dari")),
        new("Sar-e Pol Institute of Higher Education", "SRP", "Sar-e Pol", F("Education", "Dari", "Pashto")),
        new("Logar Institute of Higher Education", "LGR", "Logar", F("Education", "Dari", "Pashto")),
        new("Maidan Wardak Institute of Higher Education", "MWD", "Maidan Wardak", F("Education", "Pashto", "Dari")),
        new("Daikundi Institute of Higher Education", "DKD", "Daikundi", F("Education", "Dari"), F("Agriculture", "Agronomy")),
        new("Zabul Mirwais Khan Nika Institute of Higher Education", "ZBL", "Zabul", F("Education", "Pashto")),
        new("Nuristan Institute of Higher Education", "NRS", "Nuristan", F("Education", "Pashto")),
        new("Ghazni Technical Engineering University", "GTE", "Ghazni", F("Technical Engineering", "Civil", "Electrical", "Mechanical")),
        new("ANASTU - Kandahar", "ANA", "Kandahar", F("Agricultural Sciences", "Agronomy", "Biotechnology", "Plant Protection"))
    ];
}
