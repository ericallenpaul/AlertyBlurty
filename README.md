# alertblurty

**Single-Tenant On-Call Alert Router for Zabbix 7.4**

alertblurty is a self-hosted on-call alert management system that receives webhooks from Zabbix 7.4, groups related incidents by host and trigger, and notifies on-call users via Twilio SMS. The system provides bidirectional acknowledgment with Zabbix, ensuring alerts are properly managed across both platforms.

## Features

- **Zabbix 7.4 Integration**: Receives webhook notifications from Zabbix monitoring
- **Intelligent Incident Grouping**: Deduplicates alerts by {host, trigger} to reduce noise
- **SMS Notifications**: Sends alerts to on-call users via Twilio with automatic retry
- **Bidirectional Acknowledgment**: Acknowledges incidents in both alertblurty and Zabbix
- **On-Call Scheduling**: Flexible scheduling with hourly, daily, weekly, and monthly rotations
- **Shift Swap Management**: Request and approve shift swaps with optional admin approval
- **Role-Based Access Control**: Admin and user roles
- **Immutable Audit Logging**: Complete audit trail with configurable retention
- **Web-Based UI**: React web interface for incident and schedule management
- **First-Run Setup Wizard**: Easy initial configuration

## Install Via Docker Compose

Docker Compose is the recommended self-hosted install path. It runs AlertyBlurty and PostgreSQL as separate containers with persistent volumes.

### Quick Start

```bash
git clone https://github.com/ericallenpaul/AlertyBlurty.git
cd AlertyBlurty
cp .env.example .env
docker compose up -d
```

Open `http://localhost:18080` and complete the first-run setup wizard. Choose `Bundled Docker PostgreSQL` to use the included PostgreSQL service, or `Existing PostgreSQL server` to connect to your own database.

The Docker host port is set by `ALERTYBLURTY_PORT` in `.env` before startup. The first-run wizard cannot change it because Docker publishes ports before the app starts.

### Helper Scripts

On Windows:

```powershell
.\scripts\start-docker.ps1
```

On Linux or macOS:

```bash
./scripts/start-docker.sh
```

The helper starts Docker Compose and prints the URL to open.

### Docker Image

The app image is published on Docker Hub:

```text
ericallenpaul/alertyblurty
```

Current tags:

- `ericallenpaul/alertyblurty:0.1.7`
- `ericallenpaul/alertyblurty:latest`

Use Docker Compose for the bundled PostgreSQL install. Running the image directly with `docker run` starts only the AlertyBlurty app container, so choose `Existing PostgreSQL server` in setup unless you provide a separate PostgreSQL container.

See [Docker Self-Hosting](docs/docker.md) for `.env` values, external PostgreSQL, backups, upgrades, and manual Docker Hub publishing.

## Docker Compose File

This repository includes ready-to-use Compose files:

- [`docker-compose.yml`](docker-compose.yml): AlertyBlurty with bundled PostgreSQL
- [`docker-compose.external-db.yml`](docker-compose.external-db.yml): AlertyBlurty only, for external PostgreSQL

Minimal bundled PostgreSQL example:

```yaml
services:
  alertyblurty:
    image: ericallenpaul/alertyblurty:latest
    restart: unless-stopped
    depends_on:
      postgres:
        condition: service_healthy
    ports:
      - "18080:8080"
    environment:
      ASPNETCORE_URLS: http://+:8080
      ALERTYBLURTY_PORT: 18080
      ALERTYBLURTY_CONFIG_PATH: /app/data/appsettings.Local.json
      BUNDLED_POSTGRES_PASSWORD: alertyblurty-bootstrap-change-me
    volumes:
      - alertyblurty-data:/app/data

  postgres:
    image: postgres:17-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: alertyblurty
      POSTGRES_USER: alerty_app
      POSTGRES_PASSWORD: alertyblurty-bootstrap-change-me
    volumes:
      - alertyblurty-postgres-data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U \"$${POSTGRES_USER}\" -d \"$${POSTGRES_DB}\""]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  alertyblurty-data:
  alertyblurty-postgres-data:
```

For production use, copy `.env.example` to `.env` if you want to override ports, image tags, Twilio defaults, or the internal bundled PostgreSQL bootstrap password. In bundled mode, the first-run wizard password becomes the application database password.

## Install From Source

Use source installation for development or for operators who want to build and run the API/frontend manually.

### Prerequisites

- .NET 10 SDK
- Node.js 24+
- PostgreSQL 15+
- Twilio account (for SMS notifications)
- Zabbix 7.4 instance

### Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/ericallenpaul/AlertyBlurty.git
   cd AlertyBlurty
   ```

2. **Set up PostgreSQL database**
   ```sql
   CREATE ROLE alertyblurty_migration LOGIN PASSWORD 'migration_password';
   CREATE ROLE alertyblurty_app LOGIN PASSWORD 'app_password';
   CREATE DATABASE alertyblurty OWNER alertyblurty_migration;
   GRANT CONNECT ON DATABASE alertyblurty TO alertyblurty_app;

   \connect alertyblurty
   ALTER SCHEMA public OWNER TO alertyblurty_migration;
   GRANT CREATE, USAGE ON SCHEMA public TO alertyblurty_migration;
   GRANT USAGE ON SCHEMA public TO alertyblurty_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE alertyblurty_migration IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO alertyblurty_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE alertyblurty_migration IN SCHEMA public
     GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO alertyblurty_app;
   ALTER DEFAULT PRIVILEGES FOR ROLE alertyblurty_migration IN SCHEMA public
     GRANT EXECUTE ON FUNCTIONS TO alertyblurty_app;
   ```

3. **Configure secrets**

   Store sensitive configuration in .NET User Secrets (outside the repository), or provide database and Twilio settings in the first-run setup wizard:
   ```bash
   cd src/alertblurty.Api
   dotnet user-secrets init
   dotnet user-secrets set "CONNECTION_STRING" "Host=localhost;Port=5432;Database=alertyblurty;Username=alertyblurty_app;Password=app_password"
   dotnet user-secrets set "JWT_SECRET" "your_jwt_secret_minimum_32_characters"
   dotnet user-secrets set "TWILIO_ACCOUNT_SID" "your_twilio_account_sid"
   dotnet user-secrets set "TWILIO_SECRET" "your_twilio_auth_token"
   dotnet user-secrets set "TWILIO_PHONE_NUMBER" "+15551234567"
   ```

   **Important**: Secrets are stored in User Secrets (outside the repository):
   - Windows: `%APPDATA%\Microsoft\UserSecrets\<user_secrets_id>\secrets.json`
   - Linux/macOS: `~/.microsoft/usersecrets/<user_secrets_id>/secrets.json`

4. **Optional appsettings.json defaults**

   You can keep non-secret JWT defaults in `src/alertblurty.Api/appsettings.json`:
   ```json
   {
     "JwtSettings": {
       "Issuer": "AlertyBlurty",
       "Audience": "AlertyBlurty",
       "ExpirationHours": 24
     }
   }
   ```
   Do not commit passwords, Twilio secrets, or generated setup config.

5. **Build the backend and frontend**
   ```bash
   dotnet build
   cd src/alertblurty.Web
   npm install
   npm run build
   cd ../..
   ```

6. **Run the API**
   ```bash
   dotnet run --project src/alertblurty.Api/alertblurty.Api.csproj
   ```
   The API will be available at:
   - HTTP: `http://localhost:5041`
   - Swagger UI: `http://localhost:5041/swagger`

7. **Run the React frontend**

   In a second terminal:
   ```bash
   cd src/alertblurty.Web
   npm install
   npm run dev
   ```
   The web UI will be available at `http://127.0.0.1:5260` and will proxy API calls to `http://127.0.0.1:5041`.

   For a different API URL, set `VITE_API_BASE_URL` before starting Vite:
   ```bash
   VITE_API_BASE_URL=http://localhost:5041 npm run dev
   ```

8. **Initialize and register your organization**

   Open the web UI and use the first-run setup wizard. If `CONNECTION_STRING` and Twilio variables are not already set, the wizard asks for database mode, server, port, database name, username, password, SSL mode, and Twilio settings, then applies EF migrations to the blank database.

   See `docs/api-guide.md` for complete API documentation and examples.

## Configuration

### Environment Variables

Environment variables can be used to bypass first-run setup values. If present, they override wizard-saved configuration.

**Environment-Based Setup Variables:**

- `CONNECTION_STRING`: PostgreSQL connection string, including username and password
- `JWT_SECRET`: Secret key for JWT token generation (minimum 32 characters)
- `TWILIO_ACCOUNT_SID`: Twilio account SID for SMS notifications
- `TWILIO_SECRET` or `TWILIO_AUTH_TOKEN`: Twilio authentication token
- `TWILIO_PHONE_NUMBER`: Twilio phone number to send SMS from (E.164 format)

**Optional Variables:**

- `JWT_ISSUER`: JWT token issuer (default: "AlertyBlurty")
- `JWT_AUDIENCE`: JWT token audience (default: "AlertyBlurty")
- `JWT_EXPIRY_HOURS`: JWT token expiration in hours (default: 24)
- `VITE_API_BASE_URL`: React frontend API base URL at build/dev time (default: same origin with Vite dev proxy)
- `WEBHOOK_IP_ALLOWLIST`: Comma-separated list of allowed IPs for webhooks
- `AUDIT_LOG_RETENTION_DAYS`: Days to retain audit logs (default: 90)

**Security Best Practices:**

- **Never commit secrets to version control** - use User Secrets for local development
- Use strong, random values for `JWT_SECRET` (minimum 32 characters)
- Rotate secrets regularly
- Use different secrets for each environment (dev, staging, production)
- Enable `WEBHOOK_IP_ALLOWLIST` in production to restrict webhook sources

See `docs/environment-variables.md` for complete configuration reference and examples.

## Architecture

alertblurty follows a layered architecture:

```
src/
├── alertblurty.Api/      # ASP.NET Core Web API
├── alertblurty.Data/     # Data access layer (EF Core)
├── alertblurty.Models/   # DTOs and interfaces
└── alertblurty.Web/      # React/Vite frontend

tests/
└── alertblurty.Tests/    # Unit and integration tests
```

### Technology Stack

- **Backend**: C# / .NET 10
- **Database**: PostgreSQL 15+
- **UI**: React, TypeScript, Vite
- **Logging**: NLog (7-day retention)
- **Retry Logic**: Polly
- **SMS**: Twilio SDK
- **Authentication**: JWT Bearer tokens
- **Containerization**: Docker
- **Self-Hosting**: Docker Compose

## Documentation

- **[Docker Self-Hosting](docs/docker.md)** - Docker Compose install, external database setup, backups, upgrades, and image publishing
- **[API Usage Guide](docs/api-guide.md)** - Complete API reference with curl examples
- **[Environment Variables](docs/environment-variables.md)** - Configuration reference for all environments
- **[Frontend Deployment](docs/frontend-deployment.md)** - Static React artifact hosting model
- [Release Process](docs/release-process.md) - Tagged release and rollback workflow
- [Release Notes v0.1.0](docs/release-notes-v0.1.0.md) - Initial OSS preview notes
- [Security Policy](SECURITY.md) - Vulnerability reporting and disclosure process

### API Endpoints

The API is available at `http://localhost:5041/api`. Key endpoints:

- **Authentication**: `/api/auth/register`, `/api/auth/login`
- **Users**: `/api/users`, `/api/users/me`, `/api/users/organization/{id}`
- **Teams**: `/api/teams`, `/api/teams/{id}/members`
- **Incidents**: `/api/incidents/open`, `/api/incidents/team/{teamId}`
- **Webhooks**: `/api/webhooks/zabbix/{teamId}` (no auth required)

For interactive testing, visit the Swagger UI at `http://localhost:5041/swagger`

## Zabbix Integration

### Configuring Zabbix Webhook

1. **Create a Team** in AlertyBlurty and note the Team GUID
2. **Configure Zabbix Media Type** (Administration → Media types → Create media type):
   - Name: `AlertyBlurty`
   - Type: `Webhook`
   - Script:
     ```javascript
     var params = JSON.parse(value);
     var req = new HttpRequest();
     req.addHeader('Content-Type: application/json');
     var payload = {
         eventId: params.eventId,
         triggerId: params.triggerId,
         triggerName: params.triggerName,
         triggerDescription: params.triggerDescription,
         hostName: params.hostName,
         severity: params.severity,
         status: params.status,
         eventTime: params.eventTime
     };
     var response = req.post(
         'http://your-alertyblurty-host:18080/api/webhooks/zabbix/{teamId}',
         JSON.stringify(payload)
     );
     return response;
     ```
   - Parameters: Configure event fields (eventId, triggerId, triggerName, etc.)

3. **Assign Media Type** to users in Zabbix (Administration → Users)
4. **Create Action** to trigger webhook on alerts (Configuration → Actions)

### Incident Grouping

AlertyBlurty automatically groups related alerts:
- Multiple events from the **same host** and **same trigger** are grouped into one incident
- Only the first occurrence sends an SMS notification
- The incident's `eventCount` increments with each duplicate alert
- `lastOccurrenceUtc` updates to show the most recent event

Example:
1. **Event 1**: "web-01 CPU High" → Creates Incident A, sends SMS
2. **Event 2**: "web-01 CPU High" (same host/trigger) → Updates Incident A, **no new SMS**
3. **Event 3**: "web-02 CPU High" (different host) → Creates Incident B, sends SMS

## Development

### Running Tests

```bash
dotnet test
```

### Building for Production

```bash
dotnet publish -c Release -o out
```

### Docker Image Build

```bash
docker build -t alertyblurty:local .
docker tag alertyblurty:local ericallenpaul/alertyblurty:0.1.7
docker tag alertyblurty:local ericallenpaul/alertyblurty:latest
```

## Contributing

This is a single-tenant, self-hosted solution. Contributions are welcome for bug fixes and feature enhancements.
See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, checks, and pull request requirements.

## License

This project is licensed under the [MIT License](LICENSE).

## Support

For issues and questions, please open an issue in the repository.

---

**Version**: 1.0.0
**Author**: Eric Paul
**Built with**: Claude Code
