# Docker Self-Hosted Distribution Design

## Goal

Ship AlertyBlurty as production-ready self-hosted software for other people to run in Docker. The default path should be simple Docker Compose with bundled PostgreSQL, while still supporting external PostgreSQL for users who already operate their own database.

The Docker Hub image target is:

`ericallenpaul/alertyblurty`

## Distribution Model

AlertyBlurty will publish a single application image that contains:

- the published ASP.NET Core API
- the built React/Vite frontend
- static-file hosting for the frontend from the API container

PostgreSQL is not baked into the app image. The supported bundled-database path is Docker Compose with a separate official `postgres` service and persistent volume. This keeps the app image clean and still gives casual self-hosters a one-command install.

## Installation Paths

### Docker Compose With Bundled PostgreSQL

This is the recommended path in the README.

Services:

- `alertyblurty`: app container from `ericallenpaul/alertyblurty:<tag>`
- `postgres`: official PostgreSQL image

Volumes:

- app config/data volume mounted at `/app/data`
- Postgres data volume mounted at `/var/lib/postgresql/data`

The app uses `ALERTYBLURTY_CONFIG_PATH=/app/data/appsettings.Local.json` so first-run wizard settings survive container replacement.

### Docker Compose With External PostgreSQL

The app service runs without the bundled `postgres` service. The first-run wizard collects the external database connection details, tests the connection, applies migrations, and saves the resulting connection string to the mounted app config file.

### Environment-Configured Startup

Environment variables override saved first-run config. This allows operators to bypass the wizard for fully managed deployments.

Authoritative env vars:

- `CONNECTION_STRING`
- `JWT_SECRET`
- `JWT_ISSUER`
- `JWT_AUDIENCE`
- `JWT_EXPIRY_HOURS`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_SECRET` or `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `ALERTYBLURTY_CONFIG_PATH`

If these are present and valid, startup should not require wizard-provided equivalents.

## First-Run Wizard

The wizard becomes the official first-run experience for Docker users.

Required flow:

1. Choose database mode:
   - bundled Docker PostgreSQL
   - existing PostgreSQL server
2. For bundled Docker PostgreSQL, prefill:
   - server: `postgres`
   - port: `5432`
   - database: `alertyblurty`
   - username from compose env
3. For external PostgreSQL, collect:
   - server
   - port
   - database
   - username
   - password
   - SSL mode, defaulting to `Prefer`
4. Test database connection.
5. Apply EF migrations.
6. Collect or confirm JWT secret.
7. Collect Twilio account SID, auth token, and sender phone number.
8. Create the first admin user if none exists.
9. Save config to the mounted app config path.

The existing setup API already builds and persists PostgreSQL and Twilio configuration. The implementation will add an explicit database mode field and SSL mode support to the setup request and connection-string builder.

## README Requirements

The README must make Docker Compose the primary quick-start path and include:

- `docker compose up -d` instructions
- how to copy and edit `.env.example`
- how to choose bundled vs external PostgreSQL in first-run setup
- how env vars can bypass first-run configuration
- where persistent app config and database data are stored
- how to upgrade to a newer image tag
- how to point Zabbix at the generated webhook URL
- how to configure Twilio
- how to run the local Zabbix/Twilio smoke test after setup

The README should not imply that GitHub CI/CD or hosted deployment is required.

## Docker Hub Publishing

Manual publishing is the first supported release flow.

Required tags:

- `ericallenpaul/alertyblurty:<version>`
- `ericallenpaul/alertyblurty:latest`

Publishing commands should be documented, not automated in GitHub Actions for this milestone.

## Verification

Before calling the Docker distribution ready:

- `dotnet test alertblurty.sln` passes.
- React production build succeeds.
- Docker image builds locally.
- Docker Compose starts app and PostgreSQL from a clean volume.
- First-run setup succeeds with bundled PostgreSQL.
- First-run setup succeeds with an external PostgreSQL connection or a documented local equivalent.
- Existing env-var configured startup still works.
- Local Zabbix/Twilio smoke test can target the Dockerized app.

## Out Of Scope

- Hosted SaaS deployment.
- GitHub Actions publishing.
- Kubernetes production hardening.
- Multi-tenant hosting.
- Non-Twilio notification providers.
