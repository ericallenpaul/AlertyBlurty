# Local Zabbix/Twilio Smoke Test

This smoke test is a manual local check, not a CI test. It verifies the real alert path:

`Zabbix file trigger -> AlertyBlurty webhook -> current on-call user -> Twilio SMS`

The script also supports a direct AlertyBlurty webhook check that proves the app can route and send through Twilio before involving Zabbix.

## Prerequisites

- AlertyBlurty local database settings in `.env` or `src/alertblurty.Api/data/appsettings.Local.json`.
- Twilio settings available to the API:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN` or `TWILIO_SECRET`
  - `TWILIO_PHONE_NUMBER`
- Zabbix settings in `.env` for the full path:
  - `ZABBIX_SERVER`
  - `ZABBIX_API_KEY`
- Zabbix host `DONGO` can monitor `C:\AlertyBlurtyTest\alert.trigger`.
- The Zabbix server can reach this PC on the webhook URL, usually `http://192.168.0.196:5041`.

If Zabbix cannot reach port `5041`, run this once from an elevated PowerShell prompt:

```powershell
New-NetFirewallRule -DisplayName 'AlertyBlurty API Local Smoke 5041' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5041
```

## Run Direct AlertyBlurty/Twilio Check

This restarts the API with the local smoke configuration, posts a direct Zabbix-shaped webhook, and polls Twilio until it finds the SMS containing the run id.

```powershell
$env:SMOKE_ZABBIX_TWILIO_ENABLED = 'true'
.\scripts\smoke-local-zabbix-twilio.ps1 -RunLive -RestartApi -SkipZabbix
```

## Run Full Zabbix Path

```powershell
$env:SMOKE_ZABBIX_TWILIO_ENABLED = 'true'
.\scripts\smoke-local-zabbix-twilio.ps1 -RunLive
```

The script writes evidence under ignored `artifacts/local-zabbix-twilio-smoke/<runId>/`.

## Cleanup

The script disables the Zabbix action after a successful full run. On a Zabbix timeout it captures `zabbix-timeout-diagnostics.json`, removes the trigger file, and disables the action unless `-SkipCleanup` is used.

Manual cleanup:

```powershell
Remove-Item C:\AlertyBlurtyTest\alert.trigger -Force -ErrorAction SilentlyContinue
```
