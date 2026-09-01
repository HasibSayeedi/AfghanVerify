# Afghan Verify - National Credential Registry

> A secure, national-scale platform for issuing, attesting, and verifying Afghan academic credentials.

Afghan Verify connects accredited universities, the Ministry of Higher Education, graduates, employers, and verification organizations through one trustworthy digital credential registry. The platform combines a clean-architecture ASP.NET Core backend with a responsive React interface, cryptographically authenticated records, tenant-aware administration, live review updates, QR verification, and high-quality credential exports.

## Highlights

- Secure university issuance and Ministry review workflow
- Public verification through university-prefixed serial codes and QR scanning
- HMAC-SHA256 authentication of credential and transcript data
- Dynamic Diploma, Transcript, and Overview verification tabs
- Multi-tier, university-scoped role-based access control
- Excel and CSV transcript-course import
- Responsive Dari, Pashto, Arabic-script, and Latin-script input support
- High-resolution A4 PDF generation matching the visible credential layout
- Real-time status notifications through SignalR
- Soft-deleted staff accounts and self-service password management

## Security architecture

Afghan Verify applies defense in depth across authentication, authorization, data validation, cryptography, and persistence.

### Identity and authentication

- ASP.NET Core Identity stores salted password hashes and enforces password complexity.
- JWT bearer tokens include role, user identity, and university-scope claims.
- Account lockout limits repeated failed login attempts.
- Authenticated staff can securely change their own passwords by confirming the current password.
- Administrators can reset staff passwords through Identity's tokenized reset workflow; plaintext passwords are never stored.

### Multi-tier RBAC

| Platform role | Scope | Primary capabilities |
| --- | --- | --- |
| `SUPER_ADMIN` | National | Manage Ministry, University Admin, and Registrar accounts across all institutions |
| `UNIVERSITY_ADMIN` | Assigned university | Manage sub-staff belonging only to the administrator's own institution |
| `Ministry` | Ministry review | Review, approve, and reject submitted credentials |
| `University` | Assigned university | Issue credentials and submit academic records for review |

University tenancy is enforced by the signed `university_id` JWT claim on the API, not merely by hidden frontend controls. University administrators cannot query or manipulate accounts from another institution, and their own account is excluded from the sub-staff table to prevent accidental self-lockout.

### Credential integrity

- Each issued credential is authenticated with keyed HMAC-SHA256.
- The signing payload covers student identity, university, faculty and department IDs, document metadata, issue time, URLs, GPA, verification code, and every transcript course.
- Versioned canonical payloads prevent ambiguous field concatenation.
- Verification uses fixed-time comparison to reduce timing side channels.
- Signing keys are loaded from configuration or a deployment secret store.
- Cryptographically random nine-digit serials are prefixed by university code, such as `KU-491029481`.
- A unique database index and serializable issuance transaction protect against verification-code collisions.

### Validation and privacy controls

- Afghan e-Tazkira numbers must contain exactly 13 numeric digits.
- Student names accept Latin and Arabic-derived Dari/Pashto scripts while rejecting numbers and unsafe punctuation.
- GPA, graduation year, semester, score, credit-hour, URL, document-type, and institutional relationships are validated server-side.
- University identity claims must match the university included in issuance requests.
- Invalid or inactive universities, faculties, and departments are rejected instead of silently falling back.
- Staff deletion is implemented as soft deletion and permanent lockout to preserve referential integrity and audit history.

## Credential lifecycle

```text
University Registrar
       |
       | Issues student record, transcript, and file links
       v
Pending Ministry Review
       |
       +-- Approve --> Verified public credential
       |
       +-- Reject  --> Returned with review remarks
                         |
                         +-- SignalR status notification
```

1. A university registrar selects the institution, faculty, and department and enters the student record.
2. Transcript courses can be entered manually or imported from Excel/CSV.
3. The API validates the university scope and academic relationships.
4. A unique university-prefixed verification code is generated.
5. The canonical credential payload is signed with HMAC-SHA256.
6. The record enters the Ministry review queue.
7. Status changes are broadcast through SignalR.
8. Approved credentials become available through public code or QR verification.

## Verification experience

The public interface is mobile-first and does not require an account. A verifier can enter a credential code or scan its QR code and inspect:

- Verification and Ministry approval status
- Cryptographic signature validation status
- Student and institutional academic details
- Diploma view with official branding and seals
- Transcript view grouped into responsive semester cards
- Verifiable uploaded diploma or transcript attachment for the active tab
- Print-quality credential PDF for the active Diploma or Transcript view

PDF export captures the same visible DOM credential instead of a separate template. Diplomas use A4 landscape orientation, transcripts use A4 portrait orientation, and high-resolution canvas rendering preserves typography, logos, borders, and colors.

## Administration features

### University portal

- Institution-scoped credential issuance
- Separate Faculty and Department selection
- Strict student and academic validation
- Dynamic medical-faculty semester limits
- Excel/CSV bulk transcript import with a sample template
- Immediate verification-code and QR display after successful issuance
- Diploma and transcript file-link configuration
- Automatic scroll-to-success feedback

### Ministry portal

- Central review queue
- Approve and reject workflows with remarks
- Safe Cancel action in the review dialog
- Live status updates through SignalR
- Automatic return to the top of the review list after processing

### User management

- National and university-scoped administrative views
- Create, edit, activate, deactivate, and soft-delete staff accounts
- Institution assignment and role management
- Tenant-locked university selection for University Admins
- Secure administrative password reset
- Professional confirmation and success dialogs

### Account settings

- Read-only identity summary
- Human-readable role and assigned institution
- Current-password ownership verification
- Independent password visibility controls
- Self-service password updates for every authenticated role

## Technology stack

| Layer | Technologies |
| --- | --- |
| Frontend | React 19, TypeScript 6, Vite 8, Tailwind CSS 4 |
| API | ASP.NET Core 10 Web API, JWT Bearer Authentication, SignalR |
| Architecture | Core, Infrastructure, WebApi, and test projects |
| Identity | ASP.NET Core Identity with role and tenant claims |
| Persistence | Entity Framework Core 10, SQL Server, code-first migrations |
| Cryptography | HMAC-SHA256, cryptographically secure random codes, fixed-time verification |
| Documents | jsPDF, html2canvas, ExcelJS, QRCode |
| Testing | xUnit and frontend TypeScript/ESLint production checks |

## Repository structure

```text
AfghanVerify/
|-- frontend/                         React, TypeScript, Tailwind, Vite
|   |-- public/                       Static public assets
|   `-- src/
|       |-- assets/                   Credential and institutional logos
|       |-- features/account/         Personal profile and password settings
|       |-- features/admin/           Multi-tier staff management
|       |-- features/ministry-portal/ Ministry review workflow
|       |-- features/university-portal/ Credential issuance
|       `-- features/verification/    Public verification and PDF views
|-- src/
|   |-- AfghanVerify.Core/            Domain entities
|   |-- AfghanVerify.Infrastructure/  EF Core, Identity, cryptography, migrations
|   `-- AfghanVerify.WebApi/          Controllers, DTOs, JWT, SignalR
|-- tests/
|   `-- AfghanVerify.Infrastructure.Tests/
|-- AfghanVerify.slnx
`-- README.md
```

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/)
- SQL Server or SQL Server Express
- Node.js 20 or newer
- npm

## Docker Compose

The containerized deployment runs three services on an isolated Docker network:

- `frontend`: a multi-stage Node.js build served by Nginx
- `backend`: the ASP.NET Core Web API on the .NET 10 runtime
- `database`: SQL Server 2022 Express with a persistent named volume

Create the local Compose environment file and replace every placeholder with a strong, unique secret:

```powershell
Copy-Item .env.example .env
```

Then build and start the complete platform:

```powershell
docker compose up --build -d
docker compose ps
```

Open `http://localhost:8080`. Nginx serves the React application and securely proxies `/api` and `/notificationHub` to the backend. EF Core applies pending migrations when the API starts. To inspect service logs or stop the platform:

```powershell
docker compose logs -f backend
docker compose down
```

Database data remains in the `sqlserver-data` volume after `docker compose down`. Only use `docker compose down --volumes` when intentionally deleting the local container database.

## Local development

### 1. Clone and install

```powershell
git clone <your-repository-url>
Set-Location AfghanVerify
dotnet restore AfghanVerify.slnx
Set-Location frontend
npm install
Set-Location ..
```

### 2. Configure local secrets

Create `src/AfghanVerify.WebApi/appsettings.Local.json`. This file is intentionally ignored by Git.

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.\\SQLEXPRESS;Database=AfghanVerifyDb;Trusted_Connection=True;MultipleActiveResultSets=true;Encrypt=False;TrustServerCertificate=True"
  },
  "Jwt": {
    "Key": "replace-with-a-cryptographically-random-secret-of-at-least-32-characters"
  },
  "Cryptography": {
    "SigningKey": "replace-with-a-base64-encoded-random-key-containing-at-least-32-bytes"
  },
  "Email": {
    "Host": "smtp.example.gov.af",
    "Port": 587,
    "Username": "no-reply@example.gov.af",
    "Password": "replace-with-the-smtp-account-password",
    "FromAddress": "no-reply@example.gov.af",
    "FromName": "Afghan Verify",
    "EnableSsl": true
  },
  "PasswordRecovery": {
    "FrontendBaseUrl": "http://localhost:5173",
    "TokenLifetimeMinutes": 30
  }
}
```

Environment variables can be used instead:

```powershell
$env:Jwt__Key = "your-random-jwt-key"
$env:Cryptography__SigningKey = "your-base64-hmac-key"
$env:ConnectionStrings__DefaultConnection = "your-sql-server-connection-string"
$env:Email__Host = "smtp.example.gov.af"
$env:Email__Port = "587"
$env:Email__Username = "no-reply@example.gov.af"
$env:Email__Password = "your-smtp-password"
$env:Email__FromAddress = "no-reply@example.gov.af"
$env:Email__EnableSsl = "true"
$env:PasswordRecovery__FrontendBaseUrl = "http://localhost:5173"
```

Never commit real JWT keys, HMAC keys, bootstrap passwords, database credentials, `.env` files, certificates, or `appsettings.Local.json`.

### 3. Apply the database schema

The Web API applies pending EF Core migrations during startup. To apply them explicitly:

```powershell
dotnet ef database update `
  --project src/AfghanVerify.Infrastructure `
  --startup-project src/AfghanVerify.WebApi
```

### 4. Start the API

```powershell
dotnet run --project src/AfghanVerify.WebApi --launch-profile https
```

Development endpoints are configured by `launchSettings.json`. The HTTP API proxy target used by Vite is `http://localhost:5081`.

### 5. Start the frontend

```powershell
Set-Location frontend
npm run dev
```

Open `http://localhost:5173`.

For a separately hosted API, create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=https://localhost:7267
VITE_PUBLIC_VERIFY_BASE_URL=http://localhost:5173
```

## Validation commands

```powershell
dotnet build AfghanVerify.slnx --configuration Release
dotnet test AfghanVerify.slnx --configuration Release

Set-Location frontend
npm run lint
npm run build
```

## Core API routes

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Public |
| `PUT` | `/api/account/password` | Authenticated staff |
| `GET` | `/api/universities` | Public |
| `GET` | `/api/verify/{code}` | Public |
| `POST` | `/api/certificates/issue` | University Registrar |
| `GET` | `/api/ministry/queue` | Ministry |
| `POST` | `/api/ministry/review` | Ministry |
| `GET/POST/PUT/PATCH` | `/api/admin/users` | Super Admin or scoped University Admin |
| SignalR | `/notificationHub` | Application clients |

## Production deployment checklist

- Supply JWT, HMAC, database, and bootstrap secrets through a managed secret store.
- Remove bootstrap-user configuration after initial account provisioning.
- Terminate TLS at a trusted reverse proxy and enforce HTTPS.
- Restrict `Cors:AllowedOrigins` to deployed frontend origins.
- Use a least-privilege SQL Server login and automated encrypted backups.
- Store uploaded diploma and transcript files in durable private object storage with controlled access URLs.
- Run EF Core migrations as a deliberate deployment step.
- Centralize structured logs without recording tokens, passwords, Tazkira numbers, or signing payloads.
- Configure CSP, HSTS, rate limiting, health checks, monitoring, and alerting at the hosting layer.
- Rotate JWT and HMAC keys according to an established key-management procedure.
- Run release builds and automated tests before deployment.

## Responsible handling

Academic credentials and identity information are sensitive. Deployers are responsible for access governance, retention policies, legal compliance, incident response, key rotation, audit review, and secure file storage appropriate to their environment.

## License

No open-source license is currently included. Add an appropriate license before distributing or accepting external contributions.
