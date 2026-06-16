# Environment Variables

AlertyBlurty supports two setup paths:

- Set environment variables before startup, including one full PostgreSQL `CONNECTION_STRING`.
- Start the app without database/Twilio values and complete the first-run setup wizard. The wizard asks for bundled Docker PostgreSQL or an existing PostgreSQL server, then builds the connection string and runs EF migrations against a blank database.

Do not use a separate `DB_PASSWORD`; it is intentionally not supported.

Environment variables override wizard-saved values in `appsettings.Local.json`.

## Required for Environment-Based Setup

### `CONNECTION_STRING`

Full PostgreSQL connection string for the runtime app user.

Example:

```text
Host=postgres;Port=5432;Database=alertyblurty;Username=alerty_app;Password=AppPassword123!;SSL Mode=Disable
```

The database must already exist. AlertyBlurty will create and update tables during setup/migration, but it will not create the PostgreSQL database itself.

### `JWT_SECRET`

Secret key for signing JWT tokens. Use at least 32 characters.

Example:

```text
replace-with-a-long-random-secret-at-least-32-chars
```

### `TWILIO_ACCOUNT_SID`

Twilio account SID.

Example:

```text
ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### `TWILIO_SECRET` or `TWILIO_AUTH_TOKEN`

Twilio auth token. `TWILIO_SECRET` and `TWILIO_AUTH_TOKEN` are aliases; use one.

Example:

```text
twilio_auth_token_here
```

### `TWILIO_PHONE_NUMBER`

Twilio sender number in E.164 format.

Example:

```text
+15551234567
```

## Optional Variables

- `ALERTYBLURTY_CONFIG_PATH`: path for wizard-saved local configuration. Default: `src/alertblurty.Api/data/appsettings.Local.json` when running from source.
- `ASPNETCORE_ENVIRONMENT`: `Development`, `Staging`, or `Production`.
- `ASPNETCORE_URLS`: URLs the API listens on, such as `http://+:8080`.
- `VITE_API_BASE_URL`: React dev/build API base URL. Leave empty when serving from the same origin or using the Vite proxy.
- `WEBHOOK_IP_ALLOWLIST`: comma-separated webhook source IP allowlist.
- `AUDIT_LOG_RETENTION_DAYS`: audit retention days.

## Docker Example

```bash
cp .env.example .env
docker compose up -d
```

See `docs/docker.md` for Docker Compose, external PostgreSQL, backup, upgrade, and Docker Hub publishing instructions.

## First-Run Wizard

The wizard stores supplied database, JWT, and Twilio values in an ignored local config file and then initializes the blank database with EF migrations.

Database fields collected by the wizard:

- Database mode: bundled Docker PostgreSQL or existing PostgreSQL server
- Server: `postgres` or `localhost`
- Port: `5432`
- Database name: `alertyblurty`
- Username: `alerty_app`
- Password: the app database user password
- SSL mode: `Disable`, `Prefer`, or `Require`

Twilio fields collected by the wizard:

- Account SID
- Auth token
- Sender phone number

## Database User Standard

Use a separate migration owner and runtime app user:

```sql
CREATE ROLE alerty_migration LOGIN PASSWORD 'MigrationPassword123!';
CREATE ROLE alerty_app LOGIN PASSWORD 'AppPassword123!';
CREATE DATABASE alertyblurty OWNER alerty_migration;
GRANT CONNECT ON DATABASE alertyblurty TO alerty_app;

\connect alertyblurty
ALTER SCHEMA public OWNER TO alerty_migration;
GRANT CREATE, USAGE ON SCHEMA public TO alerty_migration;
GRANT USAGE ON SCHEMA public TO alerty_app;

ALTER DEFAULT PRIVILEGES FOR ROLE alerty_migration IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO alerty_app;
ALTER DEFAULT PRIVILEGES FOR ROLE alerty_migration IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO alerty_app;
ALTER DEFAULT PRIVILEGES FOR ROLE alerty_migration IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO alerty_app;
```

The setup wizard should be run with a connection string for the user that is allowed to apply migrations to the blank database. For least privilege, run migrations with the migration owner, then switch runtime `CONNECTION_STRING` to the app user.

## Security

- Never commit `.env`, `appsettings.Local.json`, or files under `src/alertblurty.Api/data/`.
- Use a strong random `JWT_SECRET`.
- Use different secrets for development, staging, and production.
- Restrict database access to the AlertyBlurty host.
- Rotate Twilio and JWT secrets on a regular schedule.
