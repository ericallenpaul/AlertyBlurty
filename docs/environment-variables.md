# Environment Variables

This document lists all environment variables used by alertblurty.

## Required Variables

### Database Configuration

- **`DB_PASSWORD`**
  - **Description**: PostgreSQL password for the runtime app user in the configured connection string.
  - **Example**: `YourAppUserPassword123!`
  - **Required**: Yes
  - **Security**: Keep this secret! Store in User Secrets for development, environment variables for production.

- **`DB_MIGRATION_PASSWORD`**
  - **Description**: PostgreSQL password for the EF migration user. Use this when running `dotnet ef database update --connection ...`.
  - **Example**: `YourMigrationUserPassword123!`
  - **Required**: For migration execution only
  - **Security**: Keep this separate from `DB_PASSWORD`.

### JWT Authentication

- **`JWT_SECRET`**
  - **Description**: Secret key for signing JWT tokens (minimum 32 characters)
  - **Example**: `YourSuperSecretKeyForJWTTokens123456789!@#$%^&*()`
  - **Required**: Yes
  - **Security**: Keep this secret! Use a strong, random value in production.

### Twilio SMS Configuration

- **`TWILIO_ACCOUNT_SID`**
  - **Description**: Twilio account SID for SMS notifications
  - **Example**: `ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
  - **Required**: Yes (for SMS functionality)

- **`TWILIO_AUTH_TOKEN`**
  - **Description**: Twilio authentication token
  - **Example**: `your_auth_token_here`
  - **Required**: Yes (for SMS functionality)
  - **Security**: Keep this secret!

- **`TWILIO_PHONE_NUMBER`**
  - **Description**: Twilio phone number to send SMS from
  - **Example**: `+15551234567`
  - **Required**: Yes (for SMS functionality)

## Optional Variables

### JWT Configuration

- **`JWT_ISSUER`**
  - **Description**: JWT token issuer name
  - **Default**: `alertblurty`
  - **Required**: No

- **`JWT_AUDIENCE`**
  - **Description**: JWT token audience
  - **Default**: `alertblurty-users`
  - **Required**: No

- **`JWT_EXPIRY_MINUTES`**
  - **Description**: JWT token expiration time in minutes
  - **Default**: `60`
  - **Required**: No

### Security Configuration

- **`WEBHOOK_IP_ALLOWLIST`**
  - **Description**: Comma-separated list of IP addresses allowed to send webhooks
  - **Example**: `192.168.1.100,192.168.1.101,10.0.0.50`
  - **Default**: Empty (allow all)
  - **Required**: No
  - **Recommended**: Set this in production for security

- **`AUDIT_LOG_RETENTION_DAYS`**
  - **Description**: Number of days to retain audit logs
  - **Default**: `90`
  - **Required**: No

### ASP.NET Core Configuration

- **`ASPNETCORE_ENVIRONMENT`**
  - **Description**: Application environment
  - **Values**: `Development`, `Staging`, `Production`
  - **Default**: `Production`
  - **Required**: No

- **`ASPNETCORE_URLS`**
  - **Description**: URLs the application listens on
  - **Example**: `http://+:80;https://+:443`
  - **Default**: `http://localhost:5000`
  - **Required**: No

## Setting Environment Variables

### Local Development (Windows)

```powershell
$env:DB_PASSWORD="YourAppUserPassword"
$env:DB_MIGRATION_PASSWORD="YourMigrationUserPassword"
$env:JWT_SECRET="YourSecretKeyForDevelopment_MinimumLength32Chars"
$env:TWILIO_ACCOUNT_SID="your_account_sid"
$env:TWILIO_AUTH_TOKEN="your_auth_token"
$env:TWILIO_PHONE_NUMBER="+15551234567"
```

### Local Development (Linux/macOS)

```bash
export DB_PASSWORD="YourAppUserPassword"
export DB_MIGRATION_PASSWORD="YourMigrationUserPassword"
export JWT_SECRET="YourSecretKeyForDevelopment_MinimumLength32Chars"
export TWILIO_ACCOUNT_SID="your_account_sid"
export TWILIO_AUTH_TOKEN="your_auth_token"
export TWILIO_PHONE_NUMBER="+15551234567"
```

### Docker

Create a `.env` file:

```env
DB_PASSWORD=YourAppUserPassword
DB_MIGRATION_PASSWORD=YourMigrationUserPassword
JWT_SECRET=YourSecretKeyHere_ChangeInProduction
JWT_ISSUER=alertblurty
JWT_AUDIENCE=alertblurty-users
JWT_EXPIRY_MINUTES=60
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+15551234567
ZABBIX_API_URL=https://zabbix.example.com/api_jsonrpc.php
ZABBIX_API_TOKEN=your_zabbix_token
WEBHOOK_IP_ALLOWLIST=192.168.1.100,192.168.1.101
AUDIT_LOG_RETENTION_DAYS=90
```

Then reference in `docker-compose.yml`:

```yaml
services:
  alertblurty:
    image: alertblurty:latest
    env_file:
      - .env
```

### Kubernetes

Create a Secret:

```bash
kubectl create secret generic alertblurty-secrets \
  --from-literal=DB_PASSWORD='YourAppUserPassword' \
  --from-literal=JWT_SECRET='YourSecretKeyHere_ChangeInProduction' \
  --from-literal=TWILIO_ACCOUNT_SID='your_account_sid' \
  --from-literal=TWILIO_AUTH_TOKEN='your_auth_token' \
  --from-literal=TWILIO_PHONE_NUMBER='+15551234567' \
  --from-literal=ZABBIX_API_TOKEN='your_zabbix_token' \
  -n alertblurty
```

### Visual Studio User Secrets (Local Development - Recommended)

For local development, use .NET User Secrets feature to store sensitive data securely:

```bash
cd src/alertblurty.Api
dotnet user-secrets init
dotnet user-secrets set "DB_PASSWORD" "YourLocalPassword"
dotnet user-secrets set "DB_MIGRATION_PASSWORD" "YourLocalMigrationPassword"
dotnet user-secrets set "JWT_SECRET" "YourSecretKeyForDevelopment_MinimumLength32Chars"
dotnet user-secrets set "TWILIO_ACCOUNT_SID" "your_account_sid"
dotnet user-secrets set "TWILIO_AUTH_TOKEN" "your_auth_token"
dotnet user-secrets set "TWILIO_PHONE_NUMBER" "+15551234567"
```

User Secrets are stored outside the project directory at:
- **Windows**: `%APPDATA%\Microsoft\UserSecrets\<user_secrets_id>\secrets.json`
- **Linux/macOS**: `~/.microsoft/usersecrets/<user_secrets_id>/secrets.json`

## Security Best Practices

1. **Never commit secrets to version control**
   - Use `.gitignore` to exclude files containing secrets
   - Use environment variables or secret management systems

2. **Use strong, random values for JWT_SECRET**
   - Minimum 32 characters
   - Use a cryptographically secure random generator

3. **Rotate secrets regularly**
   - Establish a rotation policy for all API tokens and secrets
   - Update secrets in all environments when rotating

4. **Use different secrets for each environment**
   - Development, staging, and production should have unique secrets
   - Never use production secrets in development

5. **Restrict database access**
   - Use dedicated database users with minimum required privileges
   - Enable SSL/TLS for database connections in production

6. **Configure IP allowlisting for webhooks**
   - Set `WEBHOOK_IP_ALLOWLIST` to restrict webhook sources
   - Update the list when Zabbix server IP changes

## Validation

The application will validate environment variables on startup. Missing required variables will cause the application to fail with an error message indicating which variables are missing.

To verify your configuration:

```bash
dotnet run --project src/alertblurty.Api
```

Check the startup logs for any configuration errors.
