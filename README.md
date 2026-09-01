# Afghan Verify

## National Academic Credential Registry

Afghan Verify is a secure digital platform for issuing, reviewing, and verifying academic credentials in Afghanistan. It connects accredited universities, Ministry reviewers, graduates, employers, and verification organizations through a single trusted registry.

The platform uses an ASP.NET Core 10 backend, React and TypeScript frontend, SQL Server persistence, ASP.NET Core Identity, JWT authentication, university-scoped authorization, HMAC-SHA256 credential signatures, QR verification, SignalR notifications, and high-resolution PDF export.

> Afghan Verify is a production-oriented software project designed around national academic credential workflows. Deployment as an official government service requires the appropriate authorization, infrastructure, policies, and operational controls.

---

## Core capabilities

### University workspace

- Issue diploma, transcript, or combined academic credentials.
- Select an accredited university, faculty, and department.
- Validate Afghan student names in Latin and Arabic-derived scripts.
- Enforce 13-digit Afghanistan e-Tazkira validation.
- Validate GPA, graduation year, document URLs, semester, score, and credit hours.
- Import transcript courses from Excel or CSV.
- Download XLSX and CSV transcript templates.
- Generate a unique university-prefixed credential code such as `KU-491029481`.
- Display the verification code and QR code immediately after issuance.
- Review institution-scoped issued-record history.
- Open complete credential details from an interactive record card.
- Correct a credential while it is awaiting Ministry review.
- Cancel a pending credential with a required official reason.
- Issue a linked replacement for an already verified credential.

### Ministry workspace

- Review incoming credentials in a focused pending queue.
- Approve or reject credentials with official decision notes.
- Require a rejection reason before a credential can be rejected.
- Move processed records automatically into audit history.
- Search history by student, university, or archive code.
- View approved and rejected record details in a read-only panel.
- Filter operational statistics by week, month, or year.
- Suspend, reinstate, or revoke an approved credential with an official reason.
- Receive and publish status changes through SignalR.

### Public verification

- Verify a credential without signing in.
- Search by archive code or scan a QR code.
- Display trusted, pending, rejected, suspended, revoked, superseded, and cancelled states.
- Validate the stored HMAC-SHA256 signature.
- Mask sensitive Tazkira information in public responses.
- View responsive Overview, Diploma, and Transcript tabs.
- Open the uploaded diploma or transcript associated with the active tab.
- Download the visible credential as a high-resolution PDF.
- Export diplomas in A4 landscape and transcripts in A4 portrait orientation.

### User and account management

- National `SUPER_ADMIN` account management.
- Institution-scoped `UNIVERSITY_ADMIN` account management.
- Ministry reviewer and University Registrar accounts.
- Create, edit, activate, deactivate, and soft-delete staff accounts.
- Prevent university administrators from managing another institution.
- Prevent administrators from accidentally managing their own active account.
- Update staff passwords securely through ASP.NET Core Identity.
- Allow every authenticated user to update their own password.
- Recover forgotten passwords through expiring email reset links.

---

## Architecture

```text
React 19 + TypeScript + Tailwind CSS
                 |
                 | HTTPS / JWT / SignalR
                 v
         ASP.NET Core 10 Web API
                 |
       +---------+----------+
       |                    |
ASP.NET Core Identity   Application services
       |                    |
       +---------+----------+
                 |
        Entity Framework Core 10
                 |
              SQL Server
```

The backend is separated into the following projects:

- `AfghanVerify.Core`: domain entities and credential lifecycle constants.
- `AfghanVerify.Infrastructure`: Entity Framework Core, Identity, cryptography, migrations, and SignalR hub.
- `AfghanVerify.WebApi`: controllers, DTOs, authentication, authorization, rate limiting, audit services, and application configuration.
- `AfghanVerify.Infrastructure.Tests`: cryptographic integrity tests.

---

## Credential lifecycle

```text
University Registrar
        |
        | Issue signed credential
        v
Pending Ministry Review
        |
        +-- Correct --> Re-sign data --> Return to review queue
        |
        +-- Cancel  --> Cancelled + retained audit history
        |
        +-- Reject  --> Rejected with official notes
        |
        +-- Approve --> Verified public credential
                              |
                              +-- Suspend
                              +-- Reinstate
                              +-- Revoke
                              +-- Replace --> Original becomes Superseded
```

Approved credentials are immutable. Corrections after approval create a new linked credential instead of silently changing signed historical data.

---

## Security model

### Authentication

- ASP.NET Core Identity stores salted password hashes.
- JWT bearer tokens identify users, roles, and university scope.
- Account lockout limits repeated failed sign-in attempts.
- Private API routes require valid JWT authentication.
- Password-reset tokens are generated by ASP.NET Core Identity and expire automatically.
- Password-recovery requests use a generic response to reduce account enumeration.
- Recovery endpoints are rate limited.

### Role-based authorization

| Role | Scope | Capabilities |
| --- | --- | --- |
| `SUPER_ADMIN` | National | Manage staff across all institutions and inspect audit logs |
| `UNIVERSITY_ADMIN` | Assigned university | Manage registrar accounts belonging to the same university |
| `Ministry` | Ministry | Review credentials and manage verified credential lifecycle |
| `University` | Assigned university | Issue, correct, cancel, and replace university credentials |

University access is enforced by the signed `university_id` JWT claim on the server. Frontend filtering is not treated as a security boundary.

### Cryptographic integrity

- Credentials are signed with keyed HMAC-SHA256.
- Signing keys are loaded from configuration or deployment secrets.
- Versioned signing-key identifiers support cryptographic key rotation.
- Canonical length-prefixed payloads prevent ambiguous field concatenation.
- The signature covers student identity, institution, faculty, department, academic metadata, file URLs, issue time, verification code, replacement relationship, and transcript courses.
- Verification uses fixed-time signature comparison.
- Correcting pending data always generates a new signature.
- Modifying signed data without re-signing causes verification to fail.

### Data integrity and auditability

- Verification codes use cryptographically secure random generation.
- University prefixes contain two to four normalized characters.
- Credential codes have a unique database index.
- Serializable issuance transactions and collision retries protect code allocation.
- Optimistic concurrency protects Ministry decisions and university corrections.
- Staff deletion is implemented as soft deletion.
- Credential corrections, cancellations, Ministry decisions, lifecycle actions, and administrative changes are written to audit logs.

---

## Technology stack

| Area | Technology |
| --- | --- |
| Frontend | React 19, TypeScript, Vite 8, Tailwind CSS 4 |
| Backend | ASP.NET Core 10 Web API |
| Authentication | ASP.NET Core Identity and JWT Bearer |
| Database | SQL Server and Entity Framework Core 10 |
| Cryptography | HMAC-SHA256 and secure random number generation |
| Real-time updates | ASP.NET Core SignalR |
| PDF generation | html2pdf.js, html2canvas, and jsPDF |
| Transcript import | ExcelJS and CSV parsing |
| QR codes | qrcode.react and QR scanner support |
| Testing | xUnit, TypeScript compiler, ESLint, and Vite production build |
| Containers | Docker Compose, .NET runtime, Node.js build, and Nginx |

---

## Repository structure

```text
AfghanVerify/
|-- frontend/
|   |-- public/
|   `-- src/
|       |-- assets/
|       |-- features/
|       |   |-- account/
|       |   |-- admin/
|       |   |-- ministry-portal/
|       |   |-- university-portal/
|       |   `-- verification/
|       |-- App.tsx
|       |-- Login.tsx
|       |-- ForgotPassword.tsx
|       `-- ResetPassword.tsx
|-- src/
|   |-- AfghanVerify.Core/
|   |-- AfghanVerify.Infrastructure/
|   `-- AfghanVerify.WebApi/
|-- tests/
|   `-- AfghanVerify.Infrastructure.Tests/
|-- .env.example
|-- docker-compose.yml
|-- AfghanVerify.slnx
`-- README.md
```

---

## Prerequisites

- [.NET 10 SDK](https://dotnet.microsoft.com/)
- Node.js 20 or newer
- npm
- SQL Server 2022, SQL Server Express, or a compatible SQL Server instance
- Git

---

## Local development

### 1. Clone the repository

```powershell
git clone https://github.com/HasibSayeedi/AfghanVerify.git
Set-Location AfghanVerify
```

### 2. Restore dependencies

```powershell
dotnet restore AfghanVerify.slnx

Set-Location frontend
npm install
Set-Location ..
```

### 3. Configure local secrets

Create this ignored file:

```text
src/AfghanVerify.WebApi/appsettings.Local.json
```

Example configuration:

```json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=.\\SQLEXPRESS;Database=AfghanVerifyDb;Trusted_Connection=True;MultipleActiveResultSets=true;Encrypt=False;TrustServerCertificate=True"
  },
  "Jwt": {
    "Key": "replace-with-a-strong-random-secret-containing-at-least-32-characters"
  },
  "Cryptography": {
    "ActiveKeyId": "primary",
    "SigningKey": "replace-with-a-base64-encoded-random-key-containing-at-least-32-bytes"
  },
  "Email": {
    "Host": "smtp.example.gov.af",
    "Port": 587,
    "Username": "no-reply@example.gov.af",
    "Password": "replace-with-an-smtp-credential",
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

Never commit real JWT keys, HMAC keys, SMTP passwords, database credentials, bootstrap passwords, `.env` files, or `appsettings.Local.json`.

### 4. Generate local cryptographic secrets

Generate separate values for JWT and HMAC signing:

```powershell
$jwtBytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(64)
$hmacBytes = [Security.Cryptography.RandomNumberGenerator]::GetBytes(32)

[Convert]::ToBase64String($jwtBytes)
[Convert]::ToBase64String($hmacBytes)
```

Use the first output for `Jwt:Key` and the second output for `Cryptography:SigningKey`.

Environment-variable equivalents use double underscores:

```powershell
$env:Jwt__Key = "your-jwt-secret"
$env:Cryptography__SigningKey = "your-base64-hmac-key"
$env:ConnectionStrings__DefaultConnection = "your-sql-server-connection-string"
$env:Email__Host = "smtp.example.gov.af"
$env:Email__Port = "587"
$env:Email__Username = "no-reply@example.gov.af"
$env:Email__Password = "your-smtp-credential"
$env:Email__FromAddress = "no-reply@example.gov.af"
$env:Email__EnableSsl = "true"
$env:PasswordRecovery__FrontendBaseUrl = "http://localhost:5173"
```

### 5. Apply Entity Framework Core migrations

```powershell
dotnet ef database update `
  --project src/AfghanVerify.Infrastructure `
  --startup-project src/AfghanVerify.WebApi
```

The API also applies pending migrations during startup.

### 6. Run the backend

```powershell
dotnet run --project src/AfghanVerify.WebApi --launch-profile https
```

### 7. Run the frontend

Open another terminal:

```powershell
Set-Location frontend
npm run dev
```

Open:

```text
http://localhost:5173
```

For a separately hosted API, create `frontend/.env.local`:

```dotenv
VITE_API_BASE_URL=https://localhost:7267
VITE_PUBLIC_VERIFY_BASE_URL=http://localhost:5173
```

---

## Password recovery and SMTP

Password recovery requires a valid SMTP account. Configure only the SMTP hostname in `Email:Host`; do not include `https://`, `smtp://`, or another URL scheme.

Example:

```json
{
  "Email": {
    "Host": "smtp.gmail.com",
    "Port": 587,
    "EnableSsl": true
  }
}
```

For providers that support application-specific credentials, use a provider-issued app password rather than the normal account password. Restart the Web API after changing local email configuration.

---

## Docker Compose

The Compose deployment contains:

- `frontend`: multi-stage Vite build served by Nginx.
- `backend`: ASP.NET Core 10 Web API.
- `database`: SQL Server with persistent storage.

Create a local environment file:

```powershell
Copy-Item .env.example .env
```

Replace every placeholder with a unique secret, then run:

```powershell
docker compose up --build -d
docker compose ps
```

Open:

```text
http://localhost:8080
```

Useful commands:

```powershell
docker compose logs -f backend
docker compose restart backend
docker compose down
```

Database data remains in the named volume after `docker compose down`. Running `docker compose down --volumes` intentionally deletes the container database.

---

## Validation and tests

Run backend checks:

```powershell
dotnet build AfghanVerify.slnx --configuration Release
dotnet test AfghanVerify.slnx --configuration Release
```

Run frontend checks:

```powershell
Set-Location frontend
npm run lint
npm run build
```

The cryptography tests verify that unchanged records validate, modified records fail verification, SQL Server date round-trips remain stable, replacement relationships are signed, signing-key IDs are covered, and corrected records become trusted only after re-signing.

---

## Primary API routes

| Method | Route | Access |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Public |
| `POST` | `/api/auth/forgot-password` | Public and rate limited |
| `POST` | `/api/auth/reset-password` | Public with reset token |
| `PUT` | `/api/account/password` | Authenticated staff |
| `GET` | `/api/universities` | Public |
| `GET` | `/api/verify/{code}` | Public |
| `POST` | `/api/certificates/issue` | University Registrar |
| `GET` | `/api/certificates/issued` | University Registrar, institution scoped |
| `PUT` | `/api/certificates/{code}/pending` | University Registrar, pending only |
| `POST` | `/api/certificates/{code}/cancel` | University Registrar, pending only |
| `GET` | `/api/ministry/queue` | Ministry |
| `GET` | `/api/ministry/history` | Ministry |
| `GET` | `/api/ministry/history-page` | Ministry |
| `GET` | `/api/ministry/statistics` | Ministry |
| `POST` | `/api/ministry/review` | Ministry |
| `POST` | `/api/ministry/lifecycle` | Ministry |
| `GET/POST/PUT/PATCH` | `/api/admin/users` | Super Admin or scoped University Admin |
| `GET` | `/api/admin/audit-logs` | Super Admin |
| SignalR | `/notificationHub` | Application clients |

---

## Production deployment checklist

- Store JWT, HMAC, SMTP, database, and bootstrap secrets in a managed secret store.
- Use independent high-entropy values for JWT and HMAC signing.
- Persist ASP.NET Core Data Protection keys across restarts.
- Rotate cryptographic keys under a documented key-management procedure.
- Terminate TLS at a trusted reverse proxy and enforce HTTPS.
- Restrict CORS to deployed frontend origins.
- Apply a restrictive Content Security Policy.
- Use a least-privilege SQL Server account.
- Encrypt database backups and test restoration procedures.
- Store diploma and transcript files in durable private object storage.
- Use controlled or expiring attachment URLs where required.
- Configure institutional SMTP with monitored delivery and bounce handling.
- Remove or disable bootstrap accounts after initial provisioning.
- Centralize structured logs without recording passwords, tokens, full Tazkira numbers, or signing payloads.
- Monitor authentication failures, lifecycle actions, audit events, database health, and email delivery.
- Apply migrations through a controlled deployment process.
- Run backend tests, frontend lint, and production builds before release.

---

## Updating the GitHub repository

After validating local changes:

```powershell
git add .
git status
git commit -m "feat: update Afghan Verify platform"
git pull --rebase origin main
git push origin main
```

`appsettings.Local.json` and `.env` files are intentionally excluded through `.gitignore` and must never be force-added.

---

## Responsible data handling

Academic credentials and national identity information are sensitive. Production operators are responsible for access governance, data-retention rules, legal compliance, incident response, backup protection, key rotation, audit review, and secure document storage appropriate to their environment.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2026 Hasibullah Sayeedi. All rights reserved.
