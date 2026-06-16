# Docker Self-Hosted Distribution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and verify a production-ready Docker self-hosted distribution for AlertyBlurty, including Docker Hub image publishing to `ericallenpaul/alertyblurty`.

**Architecture:** Publish one app image containing the ASP.NET Core API and built React frontend. Use Docker Compose as the default install path with a separate official PostgreSQL container, persistent app config, and persistent database data. Keep environment variables authoritative so operators can bypass the first-run wizard when they want fully declarative startup.

**Tech Stack:** .NET 10, ASP.NET Core static files, React/Vite, PostgreSQL, Docker, Docker Compose, PowerShell verification scripts.

---

## File Structure

- Create: `Dockerfile` - multi-stage production app image that builds React and publishes the API.
- Create: `.dockerignore` - excludes local artifacts, secrets, build outputs, and git metadata from Docker build context.
- Create: `docker-compose.yml` - recommended bundled PostgreSQL deployment.
- Create: `docker-compose.external-db.yml` - app-only compose overlay for external PostgreSQL users.
- Create: `.env.example` - documented install-time variables with safe defaults and placeholders.
- Create: `docs/docker.md` - Docker installation, upgrade, external DB, and publishing guide.
- Modify: `src/alertblurty.Api/alertblurty.Api.csproj` - include frontend build output in API publish output.
- Modify: `src/alertblurty.Api/Program.cs` - serve static frontend files and support SPA fallback.
- Modify: `src/alertblurty.Api/Configuration/BootstrapConfiguration.cs` - add database mode and SSL mode to bootstrap options and generated connection strings.
- Modify: `src/alertblurty.Api/Endpoints/SetupEndpoints.cs` - accept and validate database mode and SSL mode.
- Modify: `src/alertblurty.Web/src/types/api.ts` - match setup request types.
- Modify: `src/alertblurty.Web/src/pages/SetupPage.tsx` - add bundled vs external PostgreSQL choice and SSL mode field.
- Modify: `README.md` - make Docker Compose the primary quick start and link detailed Docker docs.
- Test: `tests/alertblurty.Tests/BootstrapConfigurationTests.cs` - verify setup connection-string generation and SSL mode handling without needing Docker.

---

### Task 1: Backend Setup Model

**Files:**
- Modify: `src/alertblurty.Api/Configuration/BootstrapConfiguration.cs`
- Modify: `src/alertblurty.Api/Endpoints/SetupEndpoints.cs`
- Test: `tests/alertblurty.Tests/BootstrapConfigurationTests.cs`

- [ ] **Step 1: Add failing tests for SSL mode and bundled defaults**

Create `tests/alertblurty.Tests/BootstrapConfigurationTests.cs` with tests that call `BootstrapConfigurationBuilder.BuildPostgresConnectionString` using:

```csharp
new DatabaseBootstrapOptions
{
    Mode = "BundledDocker",
    Server = "postgres",
    Port = 5432,
    DatabaseName = "alertyblurty",
    Username = "alerty_app",
    Password = "secret",
    SslMode = "Disable"
}
```

Expected assertions:

- connection string contains `Host=postgres`
- connection string contains `Database=alertyblurty`
- connection string contains `Username=alerty_app`
- connection string contains `SSL Mode=Disable`

Add a second test with `SslMode = "Prefer"` for external database mode.

- [ ] **Step 2: Run backend tests and verify the new tests fail**

Run:

```powershell
dotnet test alertblurty.sln
```

Expected: compile failure because `Mode` and `SslMode` do not exist yet.

- [ ] **Step 3: Add database mode and SSL mode to bootstrap options**

Update `DatabaseBootstrapOptions`:

```csharp
public string Mode { get; set; } = "BundledDocker";
public string SslMode { get; set; } = "Prefer";
```

Update `BuildPostgresConnectionString` to set:

```csharp
SslMode = Enum.TryParse<SslMode>(options.SslMode, ignoreCase: true, out var sslMode)
    ? sslMode
    : Npgsql.SslMode.Prefer
```

- [ ] **Step 4: Validate setup request values**

In `ValidateBootstrapRequest`, reject modes other than `BundledDocker` and `ExternalPostgres`. Reject SSL mode values that do not parse as `Npgsql.SslMode`.

- [ ] **Step 5: Run tests**

Run:

```powershell
dotnet test alertblurty.sln
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```powershell
git add src/alertblurty.Api/Configuration/BootstrapConfiguration.cs src/alertblurty.Api/Endpoints/SetupEndpoints.cs tests/alertblurty.Tests/BootstrapConfigurationTests.cs
git commit -m "feat: support docker database setup modes"
```

---

### Task 2: First-Run Wizard Database Choice

**Files:**
- Modify: `src/alertblurty.Web/src/types/api.ts`
- Modify: `src/alertblurty.Web/src/pages/SetupPage.tsx`

- [ ] **Step 1: Update TypeScript setup types**

Add:

```ts
export type DatabaseSetupMode = "BundledDocker" | "ExternalPostgres";
export type PostgresSslMode = "Disable" | "Prefer" | "Require";
```

Extend `DatabaseBootstrapOptions`:

```ts
mode: DatabaseSetupMode;
sslMode: PostgresSslMode;
```

- [ ] **Step 2: Update setup page state**

Add state:

```ts
const [databaseMode, setDatabaseMode] =
  useState<DatabaseSetupMode>("BundledDocker");
const [databaseSslMode, setDatabaseSslMode] =
  useState<PostgresSslMode>("Disable");
```

When mode changes to bundled Docker, set server `postgres`, port `5432`, database `alertyblurty`, username `alerty_app`, SSL mode `Disable`. When mode changes to external PostgreSQL, set SSL mode `Prefer` and leave user-editable host fields intact.

- [ ] **Step 3: Include mode and SSL mode in bootstrap request**

Send:

```ts
database: {
  mode: databaseMode,
  server: databaseServer.trim(),
  port: Number(databasePort),
  databaseName: databaseName.trim(),
  username: databaseUsername.trim(),
  password: databasePassword,
  sslMode: databaseSslMode,
}
```

- [ ] **Step 4: Add the database mode UI**

Above the database fields, add two radio options:

- `Bundled Docker PostgreSQL`
- `Existing PostgreSQL server`

For bundled mode, keep fields visible and prefilled so users can see what Compose provides. For external mode, show the SSL mode select with `Disable`, `Prefer`, and `Require`.

- [ ] **Step 5: Run frontend build**

Run:

```powershell
Push-Location src/alertblurty.Web
npm run build
Pop-Location
```

Expected: TypeScript and Vite build pass.

- [ ] **Step 6: Commit**

```powershell
git add src/alertblurty.Web/src/types/api.ts src/alertblurty.Web/src/pages/SetupPage.tsx
git commit -m "feat: add database mode to setup wizard"
```

---

### Task 3: Production Docker Image

**Files:**
- Create: `Dockerfile`
- Create: `.dockerignore`
- Modify: `src/alertblurty.Api/alertblurty.Api.csproj`
- Modify: `src/alertblurty.Api/Program.cs`

- [ ] **Step 1: Add ASP.NET static frontend hosting**

In `Program.cs`, before endpoint mapping, add:

```csharp
app.UseDefaultFiles();
app.UseStaticFiles();
```

After endpoint mapping, add SPA fallback:

```csharp
app.MapFallbackToFile("index.html");
```

Keep `/api/*` and `/health` mapped before fallback.

- [ ] **Step 2: Include frontend assets in API publish output**

In `alertblurty.Api.csproj`, include:

```xml
<ItemGroup>
  <Content Include="wwwroot\**\*" CopyToPublishDirectory="PreserveNewest" />
</ItemGroup>
```

- [ ] **Step 3: Create Dockerfile**

Create a multi-stage Dockerfile:

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS web-build
WORKDIR /src/src/alertblurty.Web
COPY src/alertblurty.Web/package*.json ./
RUN npm ci
COPY src/alertblurty.Web ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS api-build
WORKDIR /src
COPY alertblurty.sln ./
COPY src/alertblurty.Models/alertblurty.Models.csproj src/alertblurty.Models/
COPY src/alertblurty.Data/alertblurty.Data.csproj src/alertblurty.Data/
COPY src/alertblurty.Api/alertblurty.Api.csproj src/alertblurty.Api/
RUN dotnet restore alertblurty.sln
COPY src ./src
COPY --from=web-build /src/src/alertblurty.Web/dist ./src/alertblurty.Api/wwwroot
RUN dotnet publish src/alertblurty.Api/alertblurty.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV ALERTYBLURTY_CONFIG_PATH=/app/data/appsettings.Local.json
RUN mkdir -p /app/data
COPY --from=api-build /app/publish ./
EXPOSE 8080
ENTRYPOINT ["dotnet", "alertblurty.Api.dll"]
```

- [ ] **Step 4: Create `.dockerignore`**

Exclude:

```text
.git
.github
.vs
.worktrees
.superpowers
artifacts
logs
.local-logs
**/bin
**/obj
**/node_modules
**/dist
.env
src/alertblurty.Api/data
re-design.pdf
```

- [ ] **Step 5: Build image locally**

Run:

```powershell
docker build -t alertyblurty:local .
```

Expected: image builds without copying local secrets or artifacts.

- [ ] **Step 6: Commit**

```powershell
git add Dockerfile .dockerignore src/alertblurty.Api/alertblurty.Api.csproj src/alertblurty.Api/Program.cs
git commit -m "feat: add production docker image"
```

---

### Task 4: Compose Packaging

**Files:**
- Create: `docker-compose.yml`
- Create: `docker-compose.external-db.yml`
- Create: `.env.example`

- [ ] **Step 1: Create `.env.example`**

Include safe placeholders:

```dotenv
ALERTYBLURTY_IMAGE=ericallenpaul/alertyblurty:latest
ALERTYBLURTY_PORT=8080
ALERTYBLURTY_CONFIG_PATH=/app/data/appsettings.Local.json
POSTGRES_DB=alertyblurty
POSTGRES_USER=alerty_app
POSTGRES_PASSWORD=change-this-postgres-password
JWT_SECRET=change-this-to-at-least-32-random-characters
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_PHONE_NUMBER=
```

- [ ] **Step 2: Create bundled PostgreSQL compose file**

`docker-compose.yml` includes `alertyblurty` and `postgres`, app health check on `/health`, `depends_on` postgres health, named volumes `alertyblurty-data` and `alertyblurty-postgres-data`.

- [ ] **Step 3: Create external DB compose file**

`docker-compose.external-db.yml` includes only `alertyblurty`, reads `CONNECTION_STRING`, and keeps the app data volume.

- [ ] **Step 4: Validate compose config**

Run:

```powershell
docker compose --env-file .env.example config
docker compose --env-file .env.example -f docker-compose.external-db.yml config
```

Expected: both commands render valid Compose configuration.

- [ ] **Step 5: Commit**

```powershell
git add docker-compose.yml docker-compose.external-db.yml .env.example
git commit -m "feat: add docker compose packaging"
```

---

### Task 5: Documentation

**Files:**
- Create: `docs/docker.md`
- Modify: `README.md`
- Modify: `docs/environment-variables.md`

- [ ] **Step 1: Write Docker guide**

`docs/docker.md` includes:

- quick start with `cp .env.example .env`
- `docker compose up -d`
- first-run wizard bundled database choice
- external PostgreSQL compose command
- env-var override startup
- backup and restore commands for the Postgres volume
- upgrade commands using `docker compose pull && docker compose up -d`
- Docker Hub manual publish commands

- [ ] **Step 2: Update README quick start**

Make Docker Compose the first install option and point detailed setup to `docs/docker.md`.

- [ ] **Step 3: Update environment variable reference**

Add database mode and SSL mode to first-run wizard docs, and clarify env vars override saved config.

- [ ] **Step 4: Commit**

```powershell
git add README.md docs/docker.md docs/environment-variables.md
git commit -m "docs: document docker self-hosting"
```

---

### Task 6: Local Docker Verification

**Files:**
- No source changes expected unless verification finds a root cause.

- [ ] **Step 1: Run standard tests**

```powershell
dotnet test alertblurty.sln
```

Expected: all tests pass.

- [ ] **Step 2: Run frontend production build**

```powershell
Push-Location src/alertblurty.Web
npm run build
Pop-Location
```

Expected: build passes.

- [ ] **Step 3: Build Docker image**

```powershell
docker build -t alertyblurty:local .
```

Expected: image builds.

- [ ] **Step 4: Start bundled compose stack with test project name**

```powershell
Copy-Item .env.example .env.docker-test -Force
docker compose --env-file .env.docker-test -p alertyblurty-test up -d
```

Expected: app and postgres containers become healthy.

- [ ] **Step 5: Verify app health**

```powershell
Invoke-RestMethod http://127.0.0.1:8080/health
```

Expected: JSON response with `status` equal to `healthy`.

- [ ] **Step 6: Stop test stack**

```powershell
docker compose --env-file .env.docker-test -p alertyblurty-test down -v
Remove-Item .env.docker-test -Force
```

- [ ] **Step 7: Commit any verification fixes**

If verification required source changes, commit them with a focused message. If no changes are required, do not create a commit.

---

### Task 7: Docker Hub Publish

**Files:**
- No source changes expected.

- [ ] **Step 1: Confirm Docker login**

```powershell
docker login
```

Expected: Docker reports login succeeded for an account with access to `ericallenpaul`.

- [ ] **Step 2: Choose version tag**

Use a semver prerelease tag for the first Docker image, for example:

```powershell
$version = "0.1.0"
```

- [ ] **Step 3: Tag local image**

```powershell
docker tag alertyblurty:local ericallenpaul/alertyblurty:$version
docker tag alertyblurty:local ericallenpaul/alertyblurty:latest
```

- [ ] **Step 4: Push tags**

```powershell
docker push ericallenpaul/alertyblurty:$version
docker push ericallenpaul/alertyblurty:latest
```

Expected: both pushes complete successfully.

- [ ] **Step 5: Verify remote pull**

```powershell
docker pull ericallenpaul/alertyblurty:$version
```

Expected: Docker pulls the published image.

---

## Self-Review

- Spec coverage: The plan covers app image, bundled Postgres Compose, external database Compose, first-run wizard choice, env-var override docs, Docker Hub publishing, and verification.
- Placeholder scan: The plan intentionally avoids TBD/TODO placeholders and gives exact file paths and commands.
- Type consistency: Backend and frontend both use `BundledDocker`, `ExternalPostgres`, `Disable`, `Prefer`, and `Require`.
