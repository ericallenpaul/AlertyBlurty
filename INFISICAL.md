# Infisical setup and agent guide

This guide applies across laptops and operating systems. It contains metadata and operating instructions, never credentials. User instructions and current task authorization govern actions; this guide does not authorize new authentication, transfers, access grants, or production changes.

## Reference from AGENTS.md or a prompt

```text
Before working with application credentials, read ./INFISICAL.md in this repository. Follow its secret-safe workflow and project/environment mappings. Do not display secret values. Confirm the current task authorizes any login, transfer, or configuration change.
```

No AGENTS.md was modified when this guide was created.

## New machine quickstart

The cloud organization, projects and stored secrets are shared centrally. Install the CLI and sign in separately on each machine. Login profiles/session credentials are machine-local. Directory linking uses `.infisical.yaml` in each checkout; if the checkout already contains that file, verify its project mapping rather than overwriting it. Never copy auth tokens, credential stores or offline caches between computers.

1. Install the official CLI for the machine. On Windows, use the exact verified winget package:

   ```powershell
   winget install --id infisical.infisical --exact --source winget
   ```

   On macOS with Homebrew:

   ```sh
   brew install infisical/get-cli/infisical
   ```

   For Linux, follow the matching distribution instructions in the [official installation guide](https://infisical.com/docs/cli/install). Older Cloudsmith repository instructions are obsolete; use the current official instructions.

2. Open a new terminal after installation so PATH updates take effect. Verify:

   ```sh
   infisical --version
   infisical login --help
   infisical init --help
   infisical sm run --help
   ```

   If the executable is not found, check installation/PATH before authenticating. Version 0.44.11 was tested; it is not a permanent required version. Check installed help before using these flags on another version.

3. Use browser login to the existing US Cloud account and organization, creating a named profile on this machine as shown below. Do not create duplicate cloud projects.
4. From the current repository root, verify or initialize its project link. Use the project-specific section in repository copies, or the project map below.
5. Launch only the required app with an explicit environment and folder. Normally use `local`; selecting `prod` requires the actual task to authorize production credential access. Finish with profile logout when appropriate for that authorized session.

## Account and project map

- Cloud: US, https://app.infisical.com
- CLI/API domain: https://app.infisical.com/api
- Organization: Ace Solutions LLC
- Organization ID: `f9b7a2c5-d7f5-43f9-83df-d1913c88958f`
- Account: `eric@acesolutions-llc.com`
- Environment slugs: `local` and `prod`. Always specify one; CLI defaults to `dev`.
- Repository paths are relative to wherever you cloned them on this machine.

| Infisical project | Project ID | Repository |
|---|---|---|
| acesolutions | a2449371-8324-47d2-b8b7-d303151371a6 | acesolutions-llc |
| werewolf | d5167446-33eb-4b60-9b3c-c620ac3c3187 | werewolfthegame |
| foodtrucks | 78353cee-3c4e-490f-8dac-828046bd9664 | foodtrucks.biz |
| alertblurty | e493beb4-27c7-431a-9c89-c9e101f8c531 | AlertyBlurty — inactive |
| pleasecheckonme | c70ce8af-4ac4-456d-add4-92f9d5fc4a58 | pleasecheckonme |

Existing Example Project and DONGO Dummy Pilot are separate; do not repurpose or delete them.

## Verified stored configuration

**acesolutions:** `/providers/cloudflare`, `/providers/digitalocean`, `/providers/gitlab`, `/providers/sendgrid`, `/providers/twilio`; `/build-deploy` exists but is empty. There are 10 local and 8 prod entries. Twilio test SID/token are local only. Other stored provider names are CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNTID, DIGITAL_OCEAN_PAT, GITLAB_TOKEN, SENDGRID_API_TOKEN, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_MASTER_ACCOUNT_SID.

**foodtrucks/local:** `/runtime` has 4 entries: `Billing__ApiKey`, `Billing__WebhookSecret`, `Billing__Enabled`, `SendGrid__EventPublicKey`.

**pleasecheckonme/local:** service-specific folders preserve source differences:

| Folder | Verified entries |
|---|---:|
| /services/admin-api | 12 |
| /services/api | 13 |
| /services/check-in-worker | 7 |
| /services/notification-worker | 7 |

Each service has its approved database, RabbitMQ and Twilio settings. Admin/API also have their own JWT and SendGrid settings. API includes migration connection credentials and push-service account JSON. Admin Twilio/SendGrid/JWT settings differ from public API settings; do not merge service folders blindly.

These 43 app entries were read back and compared in memory. Originals remain intact. Application launchers and deployments have NOT been wired to Infisical. App-specific prod settings remain unfilled/held; werewolf and inactive alertblurty have no migrated app secrets. Shared provider storage is not automatic cross-project sharing.

## Secret-safe agent procedure

1. Identify the specific project, environment, service and folder needed. Retrieve only those settings. Do not inject every shared deployment/admin token into application runtime or an AI/editor process.
2. Treat `local` as a usage label, not proof of test-only credentials. Some credentials used locally may be production-capable.
3. Never print/list/export secret values, raw credential-bearing JSON, environment dumps, auth tokens, connection strings, value lengths or fingerprints. Do not put secret values in command arguments, prompts, MCP arguments, screenshots, logs, temporary files or exceptions.
4. For approved transfers, use the reviewed local in-memory bridge: capture CLI stdout/stderr privately; obtain authentication only in-process; send values directly over HTTPS to the verified official API, with redirects disabled. Suppress raw errors and responses. Do not use visible `dotnet user-secrets list`, `infisical export`, or an uncaptured secret-get command.
5. Read only approved source stores. Compare destination values in memory; create absent entries, verify identical entries, and hold differing entries instead of overwriting. Emit only approved key names, counts, presence/equality booleans and sanitized status.
6. Preserve original sources. Do not rotate, redeploy, delete originals, grant identities, invite members, or purchase infrastructure based on this guide alone.

## Authentication and directory linking

Commands below are examples for a separately authorized work session, not commands already run by this guide. CLI help was checked for these flags. Do not provide passwords or tokens as arguments.

```powershell
# Browser authentication; creates a persistent named login profile.
infisical login --save-as ace-local-work --domain https://app.infisical.com/api --organization-id f9b7a2c5-d7f5-43f9-83df-d1913c88958f

# Later, sign back into that existing profile:
infisical login --profile ace-local-work

# From the FoodTrucks checkout root, after directory linking is authorized:
infisical init --project-id 78353cee-3c4e-490f-8dac-828046bd9664 --profile ace-local-work
```

`init` writes `.infisical.yaml`; inspect any existing project configuration before changing it. `init` uses `--project-id`, whereas `sm run` documents `--projectId` for machine-auth targeting. The examples below use directory linking instead of relying on that distinction.

Use the credential context belonging to the current OS user. A sandbox can differ from the interactive user's context. Check safely in the authorized user context before starting another login; do not read credential-store files or dump configuration to diagnose it. A profile created on one laptop does not authenticate another.

## Runtime injection examples

After linking the directory and authenticating, launch one app with only its folder:

```powershell
infisical sm run --profile ace-local-work --env local --path /runtime --include-imports=false --expand=false -- dotnet run --project ./src/FoodTrucks.Api/FoodTrucks.Api.csproj
```

This is a verified CLI command shape, not a completed application smoke test. FoodTrucks still needs its other runtime configuration; the four stored entries alone do not establish a working deployment. `infisical run` is also supported, but prefer `infisical sm run` consistently.

For a deliberately scoped interactive child shell, if PowerShell 7 (`pwsh`) is installed on this machine:

```powershell
infisical sm run --profile ace-local-work --env local --path /runtime --include-imports=false --expand=false -- pwsh -NoProfile
# Run only the required application commands, then exit the child shell.
exit
```

Every process launched from that child shell inherits its injected environment, including an AI/editor if launched there. Prefer direct application launch. Avoid `--recursive`, broad folder combinations and debug output unless specifically necessary and reviewed.

For PleaseCheckOnMe, link its project and use exactly one `/services/...` path for the corresponding service. No cross-project paid imports are configured.

Injection does not modify the parent environment. It does not erase pre-existing OS environment variables, invalidate provider keys, or guarantee descendants have stopped. Applications can also retain/log values; this is not a zero-disk-copies guarantee.

```powershell
# When the authorized session is complete:
infisical logout --profile ace-local-work
```

CLI 0.44.11 documents logout as removing local profile credentials and the shared offline backup of fetched secrets. The backup is shared across profiles, even when other profiles stay logged in. Shared server sessions used by another profile are preserved. Do not use `--all`. Logout is not a forensic erasure guarantee.

## Key naming and remaining mappings

- Convert .NET `Section:Key` to `Section__Key` for environment injection; preserve actual semantic names.
- PCOM public API intentionally binds `Jwt__Secret`; Admin uses `Jwt__AdminKey` with `Jwt__Key` fallback. Do not rename them to one common key.
- PCOM `Stripe:WebhookSecret` in User Secrets is unresolved: code expects `Payment:StripeWebhookSecret`. It was excluded. `Payment:StripeSecretKey` was not found in inspected sources; never invent it or reuse FoodTrucks Stripe settings.
- Bootstrap/human/test-login credentials were excluded, including Admin initial login and FoodTrucks LocalTesting/TestCustomer settings.
- FoodTrucks Buffer and Workers AI `.env` settings were inspected but not transferred. Its database connection source remains unresolved.
- PCOM scheduler's declared User Secrets file is absent; do not guess its configuration from another service.
- AlertyBlurty's declared User Secrets file is absent. Its `.env` ownership and external configuration need resolution before migration; keep it inactive.
- Production source ownership remains unconfirmed. Exclude backups/worktrees unless explicitly approved as comparison-only; never promote development sources to prod automatically.

For future settings: inspect only relevant source names/references, determine local/prod and service ownership, separate human accounts from app credentials, identify conflicts and aliases, then obtain the required specific transfer authorization. Reuse existing entries only after equality/ownership verification; do not duplicate shared credentials blindly.

## MCP status

No official secret-management MCP was configured by this setup. Reviewed npm `@infisical/mcp@0.0.24` masks successful secret responses but lacks comprehensive error sanitization, and secret-write arguments expose values to MCP/client traces. Do not use it for this migration. Use the safe CLI/runtime or in-memory API workflow. Local Codex MCP configuration would not automatically provide tools to a delegated cloud task. Check another machine's actual configuration rather than assuming its installed integrations.

## Verification note: original setup machine

On DONGO, Windows, 2026-11-01, CLI 0.44.11 was installed using the exact winget package above. Installed help verified the documented login/init/run/logout flags. A harmless pilot verified sentinel absence in the parent, presence in the child, and absence in the parent after exit. These tests are evidence from that machine, not a test of another laptop.

The desktop credential store was accessible in the authorized desktop context while the sandbox appeared unauthenticated. The one-time `codex-migration-20261101` profile was logged out after transfer, with authentication verified false. That profile name/session is not required on another machine. No application was wired or redeployed during this setup; no installation on additional machines has been performed by this guide update.

The Cloudflare token was copied specifically from DONGO's Windows User scope after that token verified active and its Process-scope candidate returned HTTP 401. Token permissions were not checked. Source variables were unchanged; do not assume scopes or machines have matching values.

## This repository

Project: `alertblurty`; ID: `e493beb4-27c7-431a-9c89-c9e101f8c531`. Inactive. No app-specific values migrated; do not activate or deploy it from this guide.

Only after authorization to link this directory:

```powershell
infisical init --project-id e493beb4-27c7-431a-9c89-c9e101f8c531 --profile ace-local-work
```
