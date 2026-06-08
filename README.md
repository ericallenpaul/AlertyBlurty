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
- **Role-Based Access Control**: Superadmin, admin, and user roles
- **Immutable Audit Logging**: Complete audit trail with configurable retention
- **Web-Based UI**: Blazor web interface for incident and schedule management
- **First-Run Setup Wizard**: Easy initial configuration

## Quick Start

### Prerequisites

- .NET 10 SDK
- PostgreSQL 15+
- Twilio account (for SMS notifications)
- Zabbix 7.4 instance

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd alertblurty
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

3. **Configure User Secrets (Local Development)**

   Store sensitive configuration in .NET User Secrets (outside the repository):
   ```bash
   cd src/alertblurty.Api
   dotnet user-secrets init
   dotnet user-secrets set "DB_PASSWORD" "app_password"
   dotnet user-secrets set "JWT_SECRET" "your_jwt_secret_minimum_32_characters"
   dotnet user-secrets set "TWILIO_ACCOUNT_SID" "your_twilio_account_sid"
   dotnet user-secrets set "TWILIO_AUTH_TOKEN" "your_twilio_auth_token"
   dotnet user-secrets set "TWILIO_PHONE_NUMBER" "+15551234567"
   ```

   **Important**: Secrets are stored in User Secrets (outside the repository):
   - Windows: `%APPDATA%\Microsoft\UserSecrets\<user_secrets_id>\secrets.json`
   - Linux/macOS: `~/.microsoft/usersecrets/<user_secrets_id>/secrets.json`

4. **Update appsettings.json (Non-Secret Config)**

   The connection string in `src/alertblurty.Api/appsettings.json` should be:
   ```json
   {
     "ConnectionStrings": {
       "DefaultConnection": "Host=localhost;Port=5432;Database=alertyblurty;Username=alertyblurty_app"
     },
     "JwtSettings": {
       "Issuer": "AlertyBlurty",
       "Audience": "AlertyBlurty",
       "ExpirationHours": 24
     },
     "Twilio": {
       "PhoneNumber": "+1234567890"
     }
   }
   ```
   Note: the app role password is loaded from User Secrets or `DB_PASSWORD`, not stored in appsettings.json.

5. **Build the solution**
   ```bash
   dotnet build
   ```

6. **Run database migrations**
   ```bash
   cd src/alertblurty.Api
   dotnet ef database update --project ../alertblurty.Data --connection "Host=localhost;Port=5432;Database=alertyblurty;Username=alertyblurty_migration;Password=migration_password"
   ```
   This creates 11 tables with proper indexes and foreign key relationships.

7. **Run the application**
   ```bash
   dotnet run --project src/alertblurty.Api
   ```
   The API will be available at:
   - HTTP: `http://localhost:5041`
   - Swagger UI: `http://localhost:5041/swagger`

8. **Register your organization**

   Use the API to create your first organization and SuperAdmin user:
   ```bash
   curl -X POST http://localhost:5041/api/auth/register \
     -H "Content-Type: application/json" \
     -d '{
       "email": "admin@example.com",
       "password": "SecurePassword123!",
       "fullName": "Admin User",
       "phoneNumber": "+15551234567",
       "timezone": "America/New_York",
       "organizationName": "My Organization"
     }'
   ```

   See `docs/api-guide.md` for complete API documentation and examples.

### Docker Deployment

```bash
# Build Docker image
docker build -t alertblurty -f docker/Dockerfile .

# Run with Docker Compose
docker-compose -f docker/docker-compose.yml up
```

### Kubernetes Deployment

```bash
# Apply Kubernetes manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
```

## Configuration

### Environment Variables

**Required Variables:**

- `DB_PASSWORD`: PostgreSQL database password (stored in User Secrets for local development)
- `JWT_SECRET`: Secret key for JWT token generation (minimum 32 characters)
- `TWILIO_ACCOUNT_SID`: Twilio account SID for SMS notifications
- `TWILIO_AUTH_TOKEN`: Twilio authentication token
- `TWILIO_PHONE_NUMBER`: Twilio phone number to send SMS from (E.164 format)

**Optional Variables:**

- `JWT_ISSUER`: JWT token issuer (default: "AlertyBlurty")
- `JWT_AUDIENCE`: JWT token audience (default: "AlertyBlurty")
- `JWT_EXPIRY_HOURS`: JWT token expiration in hours (default: 24)
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
├── alertblurty.Api/      # Web API and Blazor UI
├── alertblurty.Data/     # Data access layer (EF Core)
└── alertblurty.Models/   # DTOs and interfaces

tests/
└── alertblurty.Tests/    # Unit and integration tests
```

### Technology Stack

- **Backend**: C# / .NET 10
- **Database**: PostgreSQL 15+
- **UI**: Blazor Server
- **Logging**: NLog (7-day retention)
- **Retry Logic**: Polly
- **SMS**: Twilio SDK
- **Authentication**: JWT Bearer tokens
- **Containerization**: Docker
- **Orchestration**: Kubernetes

## Documentation

- **[API Usage Guide](docs/api-guide.md)** - Complete API reference with curl examples
- **[Environment Variables](docs/environment-variables.md)** - Configuration reference for all environments
- [Database Schema](docs/database-schema.md) - Schema documentation
- [Deployment Guide](docs/deployment.md) - Production deployment instructions
- [Monitoring & Operations](docs/monitoring.md) - Observability and operations guide
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
         'http://your-alertyblurty-host:5041/api/webhooks/zabbix/{teamId}',
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
./scripts/build-docker.sh v1.0.0
./scripts/push-docker.sh v1.0.0
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
