# Afghan Verify 🇦🇫

## National Academic Credential Registry

**AfghanVerify** is a secure digital platform designed to address a real-world problem in Afghanistan: **the difficulty of issuing, managing, and independently verifying academic credentials in a trusted and structured way.**

The platform provides a centralized workflow connecting **universities, Ministry reviewers, graduates, employers, and verification organizations**.

Instead of relying only on physical documents, manual verification, phone calls, or disconnected institutional records, AfghanVerify provides a digital process where an academic credential can be issued, reviewed, cryptographically signed, tracked, and publicly verified through a unique verification code or QR code.

> **Important:** AfghanVerify is an independent software project and is not an official government service. Production deployment as a national or government system would require appropriate authorization, institutional agreements, infrastructure, policies, legal compliance, and operational controls.

---

## 🎯 The Problem

Academic credential verification can become difficult when organizations need to determine whether a diploma or transcript is authentic and whether the information has been altered.

A verification process may involve:

* Physical documents
* Manual communication between institutions
* Delayed verification
* Difficulty tracking credential status
* Lack of a centralized verification workflow
* Risk of altered or outdated documents
* Difficulty maintaining an auditable history of decisions
* Challenges for employers and organizations that need to verify academic records

These challenges become more significant when credentials need to be verified by organizations outside the issuing university.

---

## 💡 The Solution

AfghanVerify introduces a digital credential lifecycle:

```text
University
    │
    │ Issue Credential
    ▼
Ministry Review
    │
    ├── Reject
    │
    ├── Correct
    │
    └── Approve
           │
           ▼
     Verified Credential
           │
           ├── QR Verification
           ├── Public Verification
           ├── Suspend
           ├── Reinstate
           ├── Revoke
           └── Replace
```

Each credential receives a unique verification code and QR code.

Public users can verify a credential without creating an account.

---

# 🚀 Core Capabilities

## University Workspace

Universities can:

* Issue diploma, transcript, or combined academic credentials
* Select accredited university, faculty, and department
* Validate Afghan student names
* Validate 13-digit Afghanistan e-Tazkira format
* Validate GPA, graduation year, semester, score, and credit hours
* Import transcript courses from Excel or CSV
* Download XLSX and CSV templates
* Generate university-prefixed credential codes
* Generate QR codes
* Review issued credentials
* Correct credentials while awaiting Ministry review
* Cancel pending credentials with an official reason
* Create linked replacement credentials after approval

---

## Ministry Workspace

Authorized Ministry reviewers can:

* Review incoming credentials
* Approve or reject credentials
* Require official rejection reasons
* Maintain decision history
* Search credential history
* View institutional records
* Monitor statistics
* Suspend approved credentials
* Reinstate suspended credentials
* Revoke credentials
* Track credential lifecycle changes
* Receive real-time status updates

---

## 🔎 Public Verification

Credential verification does not require authentication.

Users can:

* Search using a credential/archive code
* Scan a QR code
* View credential status
* Verify cryptographic integrity
* View academic information
* Access the associated diploma or transcript
* Download a high-resolution PDF
* View responsive diploma and transcript layouts

Supported credential states include:

```text
Pending
Verified
Rejected
Suspended
Revoked
Superseded
Cancelled
```

Sensitive identity information is masked in public verification responses.

---

# 🔐 Security & Integrity

Security is a core part of the platform rather than an afterthought.

### Authentication

* ASP.NET Core Identity
* JWT Bearer authentication
* Password hashing
* Account lockout
* Password recovery
* Expiring password-reset tokens
* Rate-limited recovery endpoints

### Authorization

The system uses role-based and institution-scoped authorization.

Example roles:

| Role               | Scope               |
| ------------------ | ------------------- |
| `SUPER_ADMIN`      | National            |
| `UNIVERSITY_ADMIN` | Assigned university |
| `Ministry`         | Ministry            |
| `University`       | Assigned university |

University access is enforced on the backend using the signed university scope contained in the JWT. Frontend filtering is **not** treated as a security boundary.

---

# 🔏 Cryptographic Credential Integrity

Academic credentials are signed using **HMAC-SHA256**.

The signature covers important credential information including:

* Student identity
* Institution
* Faculty
* Department
* Academic information
* File references
* Issue time
* Verification code
* Replacement relationships
* Transcript courses

The platform also supports:

* Cryptographically secure verification-code generation
* Versioned signing-key identifiers
* Key rotation
* Canonical payload construction
* Fixed-time signature comparison
* Re-signing after permitted corrections
* Detection of unauthorized modification

If signed credential data is modified without a valid re-signing operation, verification fails.

---

# 🧾 Immutable Credential History

Approved credentials are treated as immutable records.

If a verified credential needs correction, the original credential is not silently modified.

Instead:

```text
Original Credential
       │
       ▼
   Superseded
       │
       └──────► New Linked Credential
```

This preserves historical integrity and provides a clear audit trail.

---

# 🏗️ Architecture

```text
React 19 + TypeScript + Tailwind CSS
                 │
                 │ HTTPS / JWT / SignalR
                 ▼
        ASP.NET Core 10 Web API
                 │
        ┌────────┴────────┐
        │                 │
 ASP.NET Core         Application
    Identity            Services
        │                 │
        └────────┬────────┘
                 ▼
          Entity Framework Core 10
                 │
                 ▼
              SQL Server
```

### Backend Structure

```text
AfghanVerify.Core
    └── Domain entities
    └── Credential lifecycle constants

AfghanVerify.Infrastructure
    └── Entity Framework Core
    └── Identity
    └── Cryptography
    └── Database migrations
    └── SignalR

AfghanVerify.WebApi
    └── Controllers
    └── DTOs
    └── Authentication
    └── Authorization
    └── Rate limiting
    └── Audit services
    └── Application configuration

AfghanVerify.Infrastructure.Tests
    └── Cryptographic integrity tests
```

---

# 🛠️ Technology Stack

| Area              | Technology                            |
| ----------------- | ------------------------------------- |
| Frontend          | React 19, TypeScript, Vite 8          |
| Styling           | Tailwind CSS 4                        |
| Backend           | ASP.NET Core 10 Web API               |
| Authentication    | ASP.NET Core Identity + JWT           |
| Database          | SQL Server                            |
| ORM               | Entity Framework Core 10              |
| Cryptography      | HMAC-SHA256                           |
| Real-time         | ASP.NET Core SignalR                  |
| PDF               | html2pdf.js, html2canvas, jsPDF       |
| Transcript Import | ExcelJS + CSV                         |
| QR                | qrcode.react + QR scanner             |
| Testing           | xUnit, TypeScript, ESLint, Vite build |
| Containers        | Docker Compose                        |
| Web Server        | Nginx                                 |

---

# 📊 Why This Project Matters

AfghanVerify is intentionally designed around a **real-world workflow rather than a simple CRUD demonstration**.

The project combines:

* Multi-institution authorization
* Academic credential lifecycle management
* Public verification
* Cryptographic integrity
* QR-based verification
* Auditability
* Secure authentication
* Real-time notifications
* Document management
* Transcript processing
* Dockerized deployment

This makes the project a practical demonstration of building a **security-sensitive, multi-tenant, workflow-driven business application**.

---

# 🧪 Testing & Validation

Backend:

```bash
dotnet build AfghanVerify.slnx --configuration Release
dotnet test AfghanVerify.slnx --configuration Release
```

Frontend:

```bash
cd frontend
npm run lint
npm run build
```

Cryptographic tests cover scenarios including:

* Valid unchanged credentials
* Modified credential data
* Date serialization stability
* Replacement relationships
* Signing-key identifiers
* Re-signing after corrections

---

# 🐳 Docker

The project includes Docker Compose configuration for:

```text
Frontend
    ↓
Nginx

Backend
    ↓
ASP.NET Core 10

Database
    ↓
SQL Server
```

Start the application with:

```bash
docker compose up --build -d
```

---

# 🔌 Primary API Routes

| Method               | Route                       | Access              |
| -------------------- | --------------------------- | ------------------- |
| `POST`               | `/api/auth/login`           | Public              |
| `POST`               | `/api/auth/forgot-password` | Public              |
| `POST`               | `/api/auth/reset-password`  | Public              |
| `GET`                | `/api/universities`         | Public              |
| `GET`                | `/api/verify/{code}`        | Public              |
| `POST`               | `/api/certificates/issue`   | University          |
| `GET`                | `/api/certificates/issued`  | University          |
| `GET`                | `/api/ministry/queue`       | Ministry            |
| `GET`                | `/api/ministry/history`     | Ministry            |
| `POST`               | `/api/ministry/review`      | Ministry            |
| `POST`               | `/api/ministry/lifecycle`   | Ministry            |
| `GET/POST/PUT/PATCH` | `/api/admin/users`          | Admin               |
| `GET`                | `/api/admin/audit-logs`     | Super Admin         |
| `SignalR`            | `/notificationHub`          | Application clients |

---

# ⚙️ Local Development

## Prerequisites

* .NET 10 SDK
* Node.js 20+
* npm
* SQL Server 2022 / SQL Server Express
* Git
* Docker Desktop (optional)

## Clone

```bash
git clone https://github.com/HasibSayeedi/AfghanVerify.git
cd AfghanVerify
```

## Backend

```bash
dotnet restore AfghanVerify.slnx
dotnet run --project src/AfghanVerify.WebApi
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

---

# 🔒 Production Security Considerations

A production deployment should additionally provide:

* Managed secret storage
* Strong independent JWT and HMAC keys
* Cryptographic key rotation
* Persistent ASP.NET Core Data Protection keys
* HTTPS/TLS
* Restrictive CORS
* Content Security Policy
* Least-privilege database access
* Encrypted database backups
* Secure private object storage for documents
* Controlled or expiring document URLs
* Secure institutional email infrastructure
* Centralized structured logging
* Monitoring and alerting
* Incident-response procedures
* Data-retention policies
* Appropriate legal and regulatory compliance

---

# ⚠️ Responsible Data Handling

Academic credentials and national identity information are sensitive data.

Any real-world deployment must establish appropriate:

* Access-control policies
* Data-retention policies
* Privacy protections
* Backup procedures
* Incident-response procedures
* Key-management procedures
* Audit processes
* Legal and institutional approvals

This repository is a software project and does not by itself constitute authorization to operate a national academic credential registry.

---

# 📌 Project Status

AfghanVerify is currently a **production-oriented software project / prototype** developed to demonstrate how a secure digital academic credential verification platform could be designed and implemented.

The project is not currently presented as an officially deployed national registry.

---

# 📄 License

This project is licensed under the MIT License.

Copyright © 2026 Hasibullah Sayeedi.
