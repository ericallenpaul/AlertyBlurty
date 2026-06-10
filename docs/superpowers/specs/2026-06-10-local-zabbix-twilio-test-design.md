# Local Zabbix to Twilio Integration Test Design

## Goal

Create a real local integration test that proves this path works end to end:

`DONGO file condition -> Zabbix trigger -> AlertyBlurty webhook -> on-call routing -> Twilio SMS to Eric Paul`

The test uses the existing local Zabbix server and the existing Zabbix host `DONGO` for this PC. Eric Paul is the test on-call user, with SMS delivered to `+15026933830`.

## Scope

This is a live environment setup, not an automated unit test. It will create or reuse test objects in AlertyBlurty and Zabbix, then trigger a real SMS.

In scope:

- Start the local AlertyBlurty API and React web app.
- Confirm AlertyBlurty runtime configuration, database access, and Twilio configuration.
- Create or reuse an AlertyBlurty organization, Eric Paul user, test team, team membership, and current on-call shift.
- Configure Zabbix host `DONGO` with a file-based test item and trigger.
- Configure Zabbix to post trigger events to AlertyBlurty's `/api/webhooks/zabbix/{teamId}` endpoint.
- Create and remove a local trigger file to verify problem and recovery behavior.
- Record verification evidence from Zabbix, AlertyBlurty incidents/notifications, logs, and Eric's SMS receipt.

Out of scope:

- Production-ready Zabbix templates.
- New user-facing schedule management UI.
- Long-term alert taxonomy or escalation policy design.
- Reworking notification delivery or Twilio status callbacks.

## Architecture

The test has four pieces:

1. Local file signal on `DONGO`
   - Directory: `C:\AlertyBlurtyTest`
   - Trigger file: `C:\AlertyBlurtyTest\alert.trigger`
   - Creating the file causes the test alert to enter `PROBLEM`.
   - Removing the file causes the test alert to recover.

2. Zabbix monitoring on host `DONGO`
   - A Zabbix agent item checks whether the trigger file exists.
   - A trigger fires when the item reports file existence.
   - A recovery expression clears the problem when the file is removed.

3. Zabbix delivery to AlertyBlurty
   - A Zabbix webhook media type posts JSON to the AlertyBlurty webhook endpoint.
   - The payload matches `ZabbixWebhookRequest`: `eventId`, `triggerId`, `triggerName`, `triggerDescription`, `hostName`, `severity`, `status`, and `eventTime`.
   - A Zabbix action targets only this test trigger to avoid noisy test messages.

4. AlertyBlurty routing and SMS
   - AlertyBlurty receives the webhook for the test team.
   - The incident service creates or updates an incident.
   - The current on-call shift resolves to Eric Paul.
   - The notification service sends SMS through Twilio to Eric's phone number.

## AlertyBlurty Data Setup

Use the existing local PostgreSQL database configured by `.env` and the local runtime configuration. If records with the exact names below already exist, reuse and update them. Otherwise, create them. If the database has not been initialized, initialize it through the setup path or API before creating test records.

Required AlertyBlurty records:

- Organization: `AlertyBlurty Local Test`
- User: Eric Paul
  - Phone: `+15026933830`
  - Timezone: `America/New_York`
  - Role: `SuperAdmin` or `Admin`
- Team: `DONGO File Watch Test`
- Team membership: Eric Paul, active, rotation order `1`
- Current on-call shift for the test team covering the current time

The current API exposes team and membership endpoints, but it does not expose public schedule endpoints. For this live test, create the current schedule and shift directly in the local database, using existing EF schema fields. This keeps the integration setup narrow and avoids adding schedule UI/API work before proving the alert path.

## Zabbix Setup

Use the existing Zabbix API configuration from `.env`:

- `ZABBIX_SERVER`
- `ZABBIX_API_KEY`

Target host:

- Host name: `DONGO`
- Current observed host id: `10683`

Create or reuse idempotently named Zabbix objects:

- Item: `AlertyBlurty trigger file exists`
- Trigger: `AlertyBlurty local file trigger on DONGO`
- Media type: `AlertyBlurty Local Webhook`
- User or delivery target needed by the action
- Action: `AlertyBlurty Local File Test`

The action should be constrained to the test trigger so unrelated Zabbix events do not send test webhooks.

## Data Flow

Problem flow:

1. Create `C:\AlertyBlurtyTest\alert.trigger`.
2. Zabbix agent on `DONGO` reports the file exists.
3. Zabbix trigger changes to `PROBLEM`.
4. Zabbix action invokes the AlertyBlurty webhook media type.
5. AlertyBlurty creates an open incident for the test team.
6. AlertyBlurty finds Eric's current on-call shift.
7. AlertyBlurty sends a Twilio SMS to `+15026933830`.

Recovery flow:

1. Remove `C:\AlertyBlurtyTest\alert.trigger`.
2. Zabbix trigger recovers.
3. Zabbix action invokes AlertyBlurty with status `OK`.
4. AlertyBlurty resolves the matching open incident for the same host and trigger id.

## Error Handling

Before triggering the live SMS path:

- Confirm the AlertyBlurty API is reachable from the Zabbix server. The preferred local URL is `http://192.168.0.196:5041`. If the API binds only to loopback, restart it bound to the LAN interface for this test.
- Confirm Twilio settings are configured. If not, the notification record will be marked failed and no SMS will be sent.
- Confirm Zabbix can poll the file item on `DONGO`. If the item is unsupported, inspect the agent key and Windows agent permissions.
- Confirm the team has a current on-call shift. Without one, AlertyBlurty will create the incident but log that no on-call user was found.

Failures should be diagnosed from:

- AlertyBlurty API logs in `.local-logs` or app console output.
- AlertyBlurty incident and notification records.
- Zabbix latest data, trigger state, action log, and media type test output.
- Twilio delivery response from the AlertyBlurty log.

## Verification

Minimum success criteria:

- Zabbix item on `DONGO` changes when the trigger file is created.
- Zabbix trigger enters `PROBLEM`.
- Zabbix action posts to AlertyBlurty successfully.
- AlertyBlurty creates an open incident with host `DONGO`.
- AlertyBlurty creates a notification record for Eric's phone number.
- Eric confirms the real SMS arrived.
- Removing the trigger file causes the Zabbix trigger to recover.
- AlertyBlurty resolves or records the recovery for the matching incident.

Optional preliminary check:

- Send one direct POST to `/api/webhooks/zabbix/{teamId}` before configuring Zabbix. This isolates AlertyBlurty, schedule routing, and Twilio from Zabbix configuration issues.

## Cleanup

After the test, either leave the Zabbix objects disabled for repeat testing or remove them. The recommended default is to disable the Zabbix action and leave the item/trigger in place so the same test can be repeated later with less setup.

Remove `C:\AlertyBlurtyTest\alert.trigger` after each test run so the trigger returns to recovery state.
