# Docker Self-Hosting

AlertyBlurty is distributed as a single application image:

```text
ericallenpaul/alertyblurty
```

The recommended install uses Docker Compose with a separate PostgreSQL container. PostgreSQL is not baked into the AlertyBlurty image.

## Quick Start

```bash
git clone https://github.com/ericallenpaul/AlertyBlurty.git
cd AlertyBlurty
cp .env.example .env
```

Edit `.env` and set at least:

```dotenv
POSTGRES_PASSWORD=replace-with-a-strong-password
```

Then start the stack:

```bash
docker compose up -d
```

Open:

```text
http://localhost:8080
```

Use the first-run wizard. Choose `Bundled Docker PostgreSQL` for the database mode. The default database values are:

```text
Server: postgres
Port: 5432
Database: alertyblurty
Username: alerty_app
SSL mode: Disable
```

Use the same database password you set as `POSTGRES_PASSWORD` in `.env`.

## External PostgreSQL

Use the app-only compose file when PostgreSQL is managed somewhere else:

```bash
cp .env.example .env
docker compose -f docker-compose.external-db.yml up -d
```

In the first-run wizard, choose `Existing PostgreSQL server`, enter your database host, port, database name, username, password, and SSL mode. `Prefer` is the default SSL mode for external PostgreSQL.

Operators who want a fully environment-driven startup can set `CONNECTION_STRING` in `.env` instead of using the wizard for database configuration.

## Environment Overrides

Environment variables override wizard-saved config. The most common override variables are:

```dotenv
CONNECTION_STRING=Host=db;Port=5432;Database=alertyblurty;Username=alerty_app;Password=replace-me;SSL Mode=Prefer
JWT_SECRET=replace-with-at-least-32-random-characters
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=twilio-auth-token
TWILIO_PHONE_NUMBER=+15551234567
```

Wizard-saved config is stored in the app data volume at:

```text
/app/data/appsettings.Local.json
```

## Upgrade

For Docker Hub releases:

```bash
docker compose pull
docker compose up -d
```

For a locally built image:

```bash
docker build -t alertyblurty:local .
ALERTYBLURTY_IMAGE=alertyblurty:local docker compose up -d
```

## Backup And Restore

Create a database backup:

```bash
docker compose exec postgres pg_dump -U alerty_app alertyblurty > alertyblurty-backup.sql
```

Restore into a running bundled PostgreSQL container:

```bash
docker compose exec -T postgres psql -U alerty_app alertyblurty < alertyblurty-backup.sql
```

The app configuration volume can be backed up with:

```bash
docker run --rm -v alertyblurty_alertyblurty-data:/data -v "$PWD:/backup" alpine tar czf /backup/alertyblurty-data.tgz -C /data .
```

## Zabbix And Twilio

After setup, create teams and schedules in AlertyBlurty, then configure a Zabbix webhook media type pointing at the generated team webhook URL:

```text
http://<alertyblurty-host>:8080/api/webhooks/zabbix/<team-id>
```

Twilio requires:

- Account SID
- Auth token
- Sender phone number in E.164 format

## Local Smoke Test

The local Zabbix/Twilio smoke test can target the Dockerized app by passing the Docker app URL:

```powershell
$env:SMOKE_ZABBIX_TWILIO_ENABLED = 'true'
.\scripts\smoke-local-zabbix-twilio.ps1 -RunLive -ApiBaseUrl http://127.0.0.1:8080 -WebhookBaseUrl http://<docker-host-lan-ip>:8080
```

## Manual Docker Hub Publish

Publishing is manual for now. Do not add GitHub Actions for this milestone.

```powershell
docker login
docker build -t alertyblurty:local .
docker tag alertyblurty:local ericallenpaul/alertyblurty:0.1.0
docker tag alertyblurty:local ericallenpaul/alertyblurty:latest
docker push ericallenpaul/alertyblurty:0.1.0
docker push ericallenpaul/alertyblurty:latest
```

