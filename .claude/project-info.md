# alertblurty – Project Information

## Project Overview
**alertblurty** is a **single-tenant**, self-hosted on-call alert router that works alongside **Zabbix**. It receives **webhooks from Zabbix**, groups related events (by **host + trigger**) into a single incident, and notifies the active **on-call user** via **Twilio SMS**. When a user **acknowledges** an incident in alertblurty, the app **acknowledges it in Zabbix via API token** and stops further notifications for that grouped incident. alertblurty does **not** implement its own escalation or re-notify logic—**Zabbix controls escalation**; the app reflects state and enables simple, reliable ack + audit.

The system uses a structured **C#/.NET** architecture with centralized logging, small internal retry for Twilio calls, and environment-based configuration. It supports **hourly/daily/weekly/monthly** schedules, a **per-member** rotation, and **schedule swaps** (other user must accept; optional **admin approval** per team). Time is stored/calculated in **UTC**; users can view schedules and incidents in their **local timezone**.

Please make sure to include a .net standard .gitignore file.

### Setup & Onboarding
- **First-run Setup Wizard** prompts for:
  - **Superadmin password** (required) and initial superadmin account creation
  - **Organization name** and **default timezone** (UTC recommended)
  - **Zabbix 7.4 API URL** and **API token** (skippable, can be configured later)
  - **Twilio** account SID, auth token, and sending number (skippable, can be configured later)
  - Optional: **IP allowlist** for inbound webhooks and **audit log retention** defaults
- Wizard verifies credentials and creates baseline **team**, **on-call schedule**, and **policy defaults**.

### Key Capabilities (v1)
- **Inbound:** Webhooks from **Zabbix 7.4** (alerts/events).  
- **Outbound:** **SMS via Twilio** (provider layer designed to add others later).  
- **Ack Flow:** User acks in alertblurty ⇒ app **acks in Zabbix** via API token.  
- **Dedup/Grouping:** Group incidents by **{host, trigger}** until acked.  
- **Scheduling:** Hourly/daily/weekly/monthly shifts; **per-member rotation**; **swap with acceptance** (optional admin approval).  
- **Roles:** `superadmin` (global), `admin` (only their teams/users), `user` (own + team incidents).  
- **Audit & Logging:**  
  - Immutable audit log in **DB** with **configurable retention**.  
  - App logs via **NLog** with **7-day rolling** file retention.  
  - Store **Twilio delivery receipts** and per-attempt logs.  
- **Security:** Internal auth (short-lived **JWTs**). No HMAC signing on inbound webhooks.  
- **Deployability:** Platform-agnostic. Public **Docker images**; provide **Kubernetes YAML/Helm**; **setup scripts** for self-hosted web/DB.  
- **Data Store:** **PostgreSQL** (v1).  
- **Reliability:** Small internal retry around Twilio calls (RabbitMQ can be added later).  
- **Observability:** Health endpoints and counters (delivered, failed, ack latency).  
- **UI:** **Blazor** for v1 (web). Architecture leaves room for a **.NET MAUI** app later.


## Essential Commands

### Development
```bash
# Build and run for local development
dotnet build
dotnet run

# Run tests
dotnet test

# Publish for containerization
dotnet publish -c Release -o out

# Docker build and push (example)
docker build -t alertblurty .
preferred docker repo AWS ECR 344418511404.dkr.ecr.us-west-2.amazonaws.com
```

## Directory Structure
```
alertblurty/
├── src/                      # Main project source code
│   ├── alertblurty.api/     # Web API or app entry point
│   ├── alertblurty.data/    # Data access layer (PostgreSQL, EF Core)
│   ├── alertblurty.models/  # Shared models and DTOs
│   └── alertblurty.console/ # Background or utility apps (optional)
├── tests/                    # Unit and integration tests
├── logs/                     # NLog output (7-day rolling retention)
├── docker/                   # Dockerfiles and environment setup
├── scripts/                  # CI/CD and helper scripts
├── docs/                     # Documentation and notes
└── .claude/                  # RIPER workflow configuration

```

## Technology Stack
- **Language:** C# (.NET 8)
- **Database:** PostgreSQL (preferred) or SQL Server (legacy)
- **Logging:** NLog (7-day retention)
- **Retry Logic:** Polly (5 attempts, stepped backoff)
- **Containerization:** Docker
- **Deployment:** Jenkins or Octopus Deploy
- **Cloud Provider:** AWS or DigitalOcean (depending on project)
- **Message Queue:** RabbitMQ (native client)
- **Configuration:** Environment variables + database-stored settings
- **Authentication:** JWT / Amazon Cognito (for public APIs)
- **AI Integration (optional):** OpenAI / Anthropic via `openai-dotnet`
- **Frontend (if applicable):** React + Bootstrap (mobile-friendly)
- **Search (if applicable):** Elasticsearch (NEST 7.17.5)
- **Vector DB (if applicable):** Qdrant

## RIPER Workflow

This project uses the RIPER development process for structured, context-efficient development.

### Available Commands
- `/riper:strict` - Enable strict RIPER protocol enforcement
- `/riper:research` - Research mode for information gathering
- `/riper:innovate` - Innovation mode for brainstorming (optional)
- `/riper:plan` - Planning mode for specifications
- `/riper:execute` - Execution mode for implementation
- `/riper:execute <substep>` - Execute a specific substep from the plan
- `/riper:review` - Review mode for validation
- `/memory:save` - Save context to memory bank
- `/memory:recall` - Retrieve from memory bank
- `/memory:list` - List all memories

### Workflow Phases
1. **Research & Innovate** - Understand and explore the codebase and requirements
2. **Plan** - Create detailed technical specifications saved to memory bank
3. **Execute** - Implement exactly what was specified in the approved plan
4. **Review** - Validate implementation against the plan

### Using the Workflow
1. Start with `/riper:strict` to enable strict mode enforcement
2. Use `/riper:research` to investigate the codebase
3. Optionally use `/riper:innovate` to brainstorm approaches
4. Create a plan with `/riper:plan`
5. Execute with `/riper:execute` (or `/riper:execute 1.2` for specific steps)
6. Validate with `/riper:review`

## Memory Bank Policy

### ⚠️ CRITICAL: Repository-Level Memory Bank
- Memory-bank location: Use `git rev-parse --show-toplevel` to find root, then `[ROOT]/.claude/memory-bank/`
- NEVER create memory-banks in subdirectories or packages
- All memories are branch-aware and date-organized
- Memories persist across sessions and can be shared with team

### Memory Bank Structure
```
.claude/memory-bank/
├── [branch-name]/
│   ├── plans/      # Technical specifications
│   ├── reviews/    # Code review reports
│   └── sessions/   # Session context
```

## Development Guidelines

- Follow **Eric’s standard architecture**:
  - `Data` → `Models` → `Console/API`
  - Implement interfaces first (e.g., `IPdfGenerator` before `IJiraFetcher`)
  - Use **Dependency Injection** for all services
  - Include **NLog** + **Polly** in every service method
- Prefer `Response.Headers.Append` over `.Add`
- All logs should go to `/logs` with daily rolling file targets
- Keep `appsettings.json` minimal—use environment overrides
- Limit log retention to **7 days**
- Avoid storing secrets in files — use Visual Studio Secrets for local development. Octopus deploy will be used to manage secrets in production.
- Test locally before pushing container builds to ECR
- For public APIs, enforce JWT expiry ≤ 5 minutes and avoid CORS by proxying tokens server-side
- Maintain simplicity in front-end design (Bootstrap defaults, no custom JS frameworks unless required)
- Use short-lived, non-cacheable JWTs for client ↔ server interactions