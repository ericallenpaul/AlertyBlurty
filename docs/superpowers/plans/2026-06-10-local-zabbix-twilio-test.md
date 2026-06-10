# Local Zabbix Twilio Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure and run a live local integration test where a file on `DONGO` causes Zabbix to post to AlertyBlurty and AlertyBlurty sends Eric Paul a real Twilio SMS.

**Architecture:** Use the existing AlertyBlurty API and database, seed only the records needed for a current on-call route, then configure Zabbix API objects idempotently on host `DONGO`. Validate AlertyBlurty and Twilio with a direct webhook before triggering the Zabbix file condition.

**Tech Stack:** PowerShell, .NET 10, PostgreSQL/Npgsql through EF schema, React/Vite, Zabbix 7.0 JSON-RPC API, Zabbix agent item `vfs.file.exists[]`, Twilio SMS.

---

## Context

Approved spec: `docs/superpowers/specs/2026-06-10-local-zabbix-twilio-test-design.md`

Known local values:

- Zabbix server: read from `.env` key `ZABBIX_SERVER`
- Zabbix API token: read from `.env` key `ZABBIX_API_KEY`
- Zabbix host: `DONGO`
- Observed Zabbix host id: `10683`
- DONGO IP: `192.168.0.196`
- AlertyBlurty API URL for Zabbix: `http://192.168.0.196:5041`
- Trigger directory: `C:\AlertyBlurtyTest`
- Trigger file: `C:\AlertyBlurtyTest\alert.trigger`
- AlertyBlurty user: Eric Paul
- AlertyBlurty SMS recipient: `+15026933830`
- Test organization: `AlertyBlurty Local Test`
- Test team: `DONGO File Watch Test`

References used for the Zabbix API shape:

- Zabbix 7.0 media type object: `https://www.zabbix.com/documentation/7.0/en/manual/api/reference/mediatype/object`
- Zabbix 7.0 action.create: `https://www.zabbix.com/documentation/7.0/en/manual/api/reference/action/create`
- Zabbix trigger expression syntax: `https://www.zabbix.com/documentation/7.4/en/manual/config/triggers/expression`

## File Structure

This setup should not change production application behavior.

- Create: `artifacts/local-zabbix-twilio-test/`
  - Holds generated JSON evidence, response bodies, and test run notes.
- Create: `artifacts/local-zabbix-twilio-test/SeedCurrentShift/`
  - Temporary .NET console utility used to seed the current on-call schedule and shift through the existing EF model.
  - Do not commit this generated utility or its build outputs.
- Modify: no application source files.

## Task 1: Preflight Local Secrets and Runtime Configuration

**Files:**

- Read: `.env`
- Read: `src/alertblurty.Api/data/appsettings.Local.json` if it exists
- Create: `artifacts/local-zabbix-twilio-test/preflight.json`

- [ ] **Step 1: Create the evidence folder**

Run:

```powershell
New-Item -ItemType Directory -Force -Path artifacts\local-zabbix-twilio-test | Out-Null
```

Expected: command exits with code `0`.

- [ ] **Step 2: Parse non-Twilio local settings without printing secrets**

Run:

```powershell
$envMap = @{}
Get-Content .env | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $envMap[$parts[0]] = $parts[1]
}

$localConfigPath = 'src\alertblurty.Api\data\appsettings.Local.json'
$localConfigExists = Test-Path $localConfigPath
$localConfig = if ($localConfigExists) { Get-Content -Raw $localConfigPath | ConvertFrom-Json } else { $null }

$preflight = [ordered]@{
    checkedAt = (Get-Date).ToUniversalTime().ToString('o')
    zabbixServerPresent = $envMap.ContainsKey('ZABBIX_SERVER')
    zabbixApiKeyPresent = $envMap.ContainsKey('ZABBIX_API_KEY')
    jwtSecretPresent = $envMap.ContainsKey('JWT_SECRET')
    dbAppUserPresent = $envMap.ContainsKey('DB_APP_USER')
    dbPasswordPresent = $envMap.ContainsKey('DB_PASSWORD')
    localConfigExists = $localConfigExists
    localConfigHasConnectionString = [bool]($localConfig.ConnectionStrings.DefaultConnection)
    localConfigHasTwilioAccountSid = [bool]($localConfig.Twilio.AccountSid)
    localConfigHasTwilioAuthToken = [bool]($localConfig.Twilio.AuthToken)
    localConfigHasTwilioPhoneNumber = [bool]($localConfig.Twilio.PhoneNumber)
}

$preflight | ConvertTo-Json -Depth 5 | Set-Content artifacts\local-zabbix-twilio-test\preflight.json
$preflight
```

Expected:

- `zabbixServerPresent` is `True`
- `zabbixApiKeyPresent` is `True`
- `jwtSecretPresent` is `True`
- `localConfigHasTwilioAccountSid`, `localConfigHasTwilioAuthToken`, and `localConfigHasTwilioPhoneNumber` are `True`

If any Twilio field is `False`, stop and ask Eric for the Twilio sender configuration or complete the setup wizard before continuing. Do not print or commit Twilio secrets.

- [ ] **Step 3: Verify Zabbix API version**

Run:

```powershell
$envMap = @{}
Get-Content .env | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $envMap[$parts[0]] = $parts[1]
}

$zabbixUri = $envMap['ZABBIX_SERVER'].TrimEnd('/') + '/api_jsonrpc.php'
$body = @{
    jsonrpc = '2.0'
    method = 'apiinfo.version'
    params = @{}
    id = 1
} | ConvertTo-Json -Depth 10

$versionResponse = Invoke-RestMethod -Method Post -Uri $zabbixUri -ContentType 'application/json-rpc' -Body $body
$versionResponse | ConvertTo-Json -Depth 10 | Set-Content artifacts\local-zabbix-twilio-test\zabbix-version.json
$versionResponse
```

Expected: response contains `"result": "7.0.27"`.

## Task 2: Start AlertyBlurty for LAN-Reachable Webhooks

**Files:**

- Create: `.local-logs/api-live-test.out.log`
- Create: `.local-logs/api-live-test.err.log`
- Create: `.local-logs/web-live-test.out.log`
- Create: `.local-logs/web-live-test.err.log`

- [ ] **Step 1: Stop stale local API or Vite processes using ports 5041 and 5260**

Run:

```powershell
foreach ($port in 5041, 5260) {
    $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
    foreach ($connection in $connections) {
        if ($connection.OwningProcess -gt 0) {
            Stop-Process -Id $connection.OwningProcess -Force -ErrorAction SilentlyContinue
        }
    }
}
```

Expected: command exits with code `0`.

- [ ] **Step 2: Start the API bound to all local interfaces**

Run:

```powershell
New-Item -ItemType Directory -Force -Path .local-logs | Out-Null
$apiOut = Join-Path (Resolve-Path .local-logs) 'api-live-test.out.log'
$apiErr = Join-Path (Resolve-Path .local-logs) 'api-live-test.err.log'
Start-Process -FilePath dotnet `
    -ArgumentList 'run --project src\alertblurty.Api\alertblurty.Api.csproj --urls http://0.0.0.0:5041' `
    -WorkingDirectory (Get-Location) `
    -RedirectStandardOutput $apiOut `
    -RedirectStandardError $apiErr `
    -WindowStyle Hidden
Start-Sleep -Seconds 8
Invoke-RestMethod http://127.0.0.1:5041/health
```

Expected: health response contains `"status": "healthy"`.

- [ ] **Step 3: Verify the LAN URL from this PC**

Run:

```powershell
Invoke-RestMethod http://192.168.0.196:5041/health
```

Expected: health response contains `"status": "healthy"`.

If this fails while loopback succeeds, run this command once from an elevated PowerShell prompt, then retry this step:

```powershell
New-NetFirewallRule -DisplayName 'AlertyBlurty API Local Test 5041' -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5041
```

- [ ] **Step 4: Start the web UI**

Run:

```powershell
$webOut = Join-Path (Resolve-Path .local-logs) 'web-live-test.out.log'
$webErr = Join-Path (Resolve-Path .local-logs) 'web-live-test.err.log'
Start-Process -FilePath npm.cmd `
    -ArgumentList 'run dev' `
    -WorkingDirectory (Resolve-Path src\alertblurty.Web) `
    -RedirectStandardOutput $webOut `
    -RedirectStandardError $webErr `
    -WindowStyle Hidden
Start-Sleep -Seconds 5
Invoke-WebRequest http://127.0.0.1:5260 -UseBasicParsing | Select-Object StatusCode
```

Expected: status code is `200`.

## Task 3: Seed AlertyBlurty Test Route

**Files:**

- Create: `artifacts/local-zabbix-twilio-test/alertyblurty-seed.json`
- Create: `artifacts/local-zabbix-twilio-test/direct-webhook-response.json`

- [ ] **Step 1: Build local runtime environment variables for API calls and database seeding**

Run:

```powershell
$envMap = @{}
Get-Content .env | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $envMap[$parts[0]] = $parts[1]
}

$localConfig = Get-Content -Raw src\alertblurty.Api\data\appsettings.Local.json | ConvertFrom-Json
$connectionString = $localConfig.ConnectionStrings.DefaultConnection
$apiBaseUrl = 'http://127.0.0.1:5041'
$email = 'eric.paul.localtest@alertyblurty.test'
$password = 'LocalTest!2026-06-10'
$fullName = 'Eric Paul'
$phoneNumber = '+15026933830'
$organizationName = 'AlertyBlurty Local Test'
$teamName = 'DONGO File Watch Test'
```

Expected: variables are assigned and no secret values are printed.

- [ ] **Step 2: Register or log in as Eric**

Run:

```powershell
$registerBody = @{
    email = $email
    password = $password
    fullName = $fullName
    phoneNumber = $phoneNumber
    timezone = 'America/New_York'
    organizationName = $organizationName
} | ConvertTo-Json

try {
    $authResponse = Invoke-RestMethod -Method Post -Uri "$apiBaseUrl/api/auth/register" -ContentType 'application/json' -Body $registerBody
} catch {
    $loginBody = @{
        email = $email
        password = $password
    } | ConvertTo-Json
    $authResponse = Invoke-RestMethod -Method Post -Uri "$apiBaseUrl/api/auth/login" -ContentType 'application/json' -Body $loginBody
}

$token = $authResponse.data.token
$user = $authResponse.data.user
$headers = @{ Authorization = "Bearer $token" }
$user
```

Expected: `$user.fullName` is `Eric Paul`, `$user.phoneNumber` is `+15026933830`, and `$token` is populated.

If login fails because the user exists with a different password, use the UI or database to identify the existing Eric user and continue with a valid token for a SuperAdmin/Admin.

- [ ] **Step 3: Create or reuse the test team and membership**

Run:

```powershell
$me = Invoke-RestMethod -Method Get -Uri "$apiBaseUrl/api/users/me" -Headers $headers
$teams = Invoke-RestMethod -Method Get -Uri "$apiBaseUrl/api/teams/organization/$($me.organizationId)" -Headers $headers
$team = $teams | Where-Object { $_.name -eq $teamName } | Select-Object -First 1

if (-not $team) {
    $teamBody = @{
        name = $teamName
        description = 'Local Zabbix file-watch integration test team'
        requireAdminApprovalForSwaps = $false
    } | ConvertTo-Json
    $team = Invoke-RestMethod -Method Post -Uri "$apiBaseUrl/api/teams" -Headers $headers -ContentType 'application/json' -Body $teamBody
}

$members = Invoke-RestMethod -Method Get -Uri "$apiBaseUrl/api/teams/$($team.id)/members" -Headers $headers
$member = $members | Where-Object { $_.userId -eq $me.id } | Select-Object -First 1
if (-not $member) {
    $memberBody = @{
        userId = $me.id
        rotationOrder = 1
    } | ConvertTo-Json
    $member = Invoke-RestMethod -Method Post -Uri "$apiBaseUrl/api/teams/$($team.id)/members" -Headers $headers -ContentType 'application/json' -Body $memberBody
}

[ordered]@{
    userId = $me.id
    organizationId = $me.organizationId
    teamId = $team.id
    teamName = $team.name
    phoneNumber = $me.phoneNumber
} | ConvertTo-Json -Depth 5 | Set-Content artifacts\local-zabbix-twilio-test\alertyblurty-seed.json
Get-Content artifacts\local-zabbix-twilio-test\alertyblurty-seed.json
```

Expected: JSON includes `teamName` of `DONGO File Watch Test` and `phoneNumber` of `+15026933830`.

- [ ] **Step 4: Create a temporary EF-based seeding utility**

Run:

```powershell
$seed = Get-Content -Raw artifacts\local-zabbix-twilio-test\alertyblurty-seed.json | ConvertFrom-Json
$seederPath = 'artifacts\local-zabbix-twilio-test\SeedCurrentShift'
Remove-Item $seederPath -Recurse -Force -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force -Path $seederPath | Out-Null
dotnet new console --framework net10.0 --output $seederPath
dotnet add $seederPath\SeedCurrentShift.csproj reference src\alertblurty.Data\alertblurty.Data.csproj

@'
using alertblurty.Data;
using alertblurty.Data.Entities;
using Microsoft.EntityFrameworkCore;

if (args.Length != 3)
{
    Console.Error.WriteLine("Usage: SeedCurrentShift <connection-string> <team-id> <user-id>");
    return 2;
}

var connectionString = args[0];
var teamId = Guid.Parse(args[1]);
var userId = Guid.Parse(args[2]);

var options = new DbContextOptionsBuilder<AlertBlurtyDbContext>()
    .UseNpgsql(connectionString)
    .Options;

await using var db = new AlertBlurtyDbContext(options);

var teamExists = await db.Teams.AnyAsync(team => team.Id == teamId);
if (!teamExists)
{
    Console.Error.WriteLine($"Team {teamId} was not found.");
    return 3;
}

var userExists = await db.Users.AnyAsync(user => user.Id == userId);
if (!userExists)
{
    Console.Error.WriteLine($"User {userId} was not found.");
    return 4;
}

var now = DateTime.UtcNow;
var start = now.AddHours(-1);
var end = now.AddHours(24);
const string scheduleName = "DONGO File Watch Current Shift";

var schedule = await db.OnCallSchedules
    .Include(existing => existing.Shifts)
    .FirstOrDefaultAsync(existing => existing.TeamId == teamId && existing.Name == scheduleName);

if (schedule is null)
{
    schedule = new OnCallSchedule
    {
        Id = Guid.NewGuid(),
        TeamId = teamId,
        Name = scheduleName,
        Frequency = ScheduleFrequency.Daily,
        StartTimeUtc = start,
        DurationMinutes = 1440,
        IsActive = true
    };
    db.OnCallSchedules.Add(schedule);
}
else
{
    schedule.StartTimeUtc = start;
    schedule.DurationMinutes = 1440;
    schedule.IsActive = true;
    db.OnCallShifts.RemoveRange(schedule.Shifts);
}

db.OnCallShifts.Add(new OnCallShift
{
    Id = Guid.NewGuid(),
    Schedule = schedule,
    UserId = userId,
    StartTimeUtc = start,
    EndTimeUtc = end,
    IsSwapped = false
});

await db.SaveChangesAsync();

Console.WriteLine(System.Text.Json.JsonSerializer.Serialize(new
{
    schedule.Id,
    TeamId = teamId,
    UserId = userId,
    ShiftStartUtc = start,
    ShiftEndUtc = end
}));
'@ | Set-Content $seederPath\Program.cs
```

Expected: `dotnet new` reports the console template was created and the `Program.cs` file exists.

- [ ] **Step 5: Run the current-shift seeding utility**

Run:

```powershell
$seed = Get-Content -Raw artifacts\local-zabbix-twilio-test\alertyblurty-seed.json | ConvertFrom-Json
$localConfig = Get-Content -Raw src\alertblurty.Api\data\appsettings.Local.json | ConvertFrom-Json
$connectionString = $localConfig.ConnectionStrings.DefaultConnection
dotnet run --project artifacts\local-zabbix-twilio-test\SeedCurrentShift\SeedCurrentShift.csproj -- "$connectionString" "$($seed.teamId)" "$($seed.userId)"
```

Expected: command exits with code `0` and prints JSON containing `schedule`, `teamId`, `userId`, `shiftStartUtc`, and `shiftEndUtc`.

- [ ] **Step 6: Send a direct AlertyBlurty webhook to prove Twilio routing**

Run:

```powershell
$seed = Get-Content -Raw artifacts\local-zabbix-twilio-test\alertyblurty-seed.json | ConvertFrom-Json
$directBody = @{
    eventId = "direct-local-test-$(Get-Date -Format yyyyMMddHHmmss)"
    triggerId = 'direct-local-file-watch'
    triggerName = 'Direct local file-watch smoke test'
    triggerDescription = 'Direct webhook sent before Zabbix configuration'
    hostName = 'DONGO'
    severity = 3
    status = 'PROBLEM'
    eventTime = (Get-Date).ToUniversalTime().ToString('o')
} | ConvertTo-Json

$directResponse = Invoke-RestMethod -Method Post -Uri "$apiBaseUrl/api/webhooks/zabbix/$($seed.teamId)" -ContentType 'application/json' -Body $directBody
$directResponse | ConvertTo-Json -Depth 10 | Set-Content artifacts\local-zabbix-twilio-test\direct-webhook-response.json
$directResponse
```

Expected: response includes `success = True` and `status = Open`.

Ask Eric whether the direct SMS arrived. If it did not arrive, inspect `.local-logs\api-live-test.out.log` for `SMS sent successfully` or `Failed to send SMS` before configuring Zabbix.

## Task 4: Configure Zabbix File Watch Objects

**Files:**

- Create: `artifacts/local-zabbix-twilio-test/zabbix-objects.json`

- [ ] **Step 1: Create the local trigger directory and make sure the file is absent**

Run:

```powershell
New-Item -ItemType Directory -Force -Path C:\AlertyBlurtyTest | Out-Null
Remove-Item C:\AlertyBlurtyTest\alert.trigger -Force -ErrorAction SilentlyContinue
```

Expected: `Test-Path C:\AlertyBlurtyTest\alert.trigger` returns `False`.

- [ ] **Step 2: Define a reusable Zabbix API function**

Run:

```powershell
$envMap = @{}
Get-Content .env | Where-Object { $_ -match '^[A-Z0-9_]+=' } | ForEach-Object {
    $parts = $_ -split '=', 2
    $envMap[$parts[0]] = $parts[1]
}
$zabbixUri = $envMap['ZABBIX_SERVER'].TrimEnd('/') + '/api_jsonrpc.php'
$zabbixToken = $envMap['ZABBIX_API_KEY']
$script:ZabbixRequestId = 10

function Invoke-ZabbixApi {
    param(
        [Parameter(Mandatory=$true)][string]$Method,
        [Parameter(Mandatory=$true)]$Params
    )

    $script:ZabbixRequestId += 1
    $body = @{
        jsonrpc = '2.0'
        method = $Method
        params = $Params
        auth = $zabbixToken
        id = $script:ZabbixRequestId
    } | ConvertTo-Json -Depth 30

    $response = Invoke-RestMethod -Method Post -Uri $zabbixUri -ContentType 'application/json-rpc' -Body $body
    if ($response.error) {
        throw ($response.error | ConvertTo-Json -Depth 10)
    }
    return $response.result
}
```

Expected: function is available in the current PowerShell session.

- [ ] **Step 3: Resolve host `DONGO`**

Run:

```powershell
$hostResult = Invoke-ZabbixApi -Method 'host.get' -Params @{
    output = @('hostid','host','name','status')
    filter = @{ host = @('DONGO') }
    selectInterfaces = @('interfaceid','ip','dns','type','main')
}
$dongo = $hostResult | Select-Object -First 1
$dongo
```

Expected: `$dongo.hostid` is populated and `$dongo.host` is `DONGO`.

- [ ] **Step 4: Create or reuse the Zabbix item**

Run:

```powershell
$itemName = 'AlertyBlurty trigger file exists'
$itemKey = 'vfs.file.exists["C:\AlertyBlurtyTest\alert.trigger"]'
$items = Invoke-ZabbixApi -Method 'item.get' -Params @{
    output = @('itemid','name','key_','hostid','status')
    hostids = @($dongo.hostid)
    search = @{ key_ = $itemKey }
}
$item = $items | Select-Object -First 1
if (-not $item) {
    $created = Invoke-ZabbixApi -Method 'item.create' -Params @{
        name = $itemName
        key_ = $itemKey
        hostid = $dongo.hostid
        type = 0
        value_type = 3
        delay = '10s'
        status = 0
    }
    $item = [pscustomobject]@{ itemid = $created.itemids[0]; name = $itemName; key_ = $itemKey; hostid = $dongo.hostid; status = 0 }
}
$item
```

Expected: `$item.itemid` is populated.

- [ ] **Step 5: Create or reuse the Zabbix trigger**

Run:

```powershell
$triggerName = 'AlertyBlurty local file trigger on DONGO'
$triggerExpression = 'last(/DONGO/vfs.file.exists["C:\AlertyBlurtyTest\alert.trigger"])=1'
$triggers = Invoke-ZabbixApi -Method 'trigger.get' -Params @{
    output = @('triggerid','description','expression','status')
    hostids = @($dongo.hostid)
    filter = @{ description = @($triggerName) }
}
$trigger = $triggers | Select-Object -First 1
if (-not $trigger) {
    $created = Invoke-ZabbixApi -Method 'trigger.create' -Params @{
        description = $triggerName
        expression = $triggerExpression
        priority = 3
        status = 0
    }
    $trigger = [pscustomobject]@{ triggerid = $created.triggerids[0]; description = $triggerName; expression = $triggerExpression; status = 0 }
}
$trigger
```

Expected: `$trigger.triggerid` is populated.

- [ ] **Step 6: Create or reuse the Zabbix webhook media type**

Run:

```powershell
$seed = Get-Content -Raw artifacts\local-zabbix-twilio-test\alertyblurty-seed.json | ConvertFrom-Json
$mediaTypeName = 'AlertyBlurty Local Webhook'
$endpointUrl = "http://192.168.0.196:5041/api/webhooks/zabbix/$($seed.teamId)"
$webhookScript = @'
var params = JSON.parse(value);
var req = new HttpRequest();
req.addHeader('Content-Type: application/json');

var payload = {
    eventId: params.event_id,
    triggerId: params.trigger_id,
    triggerName: params.trigger_name,
    triggerDescription: params.trigger_description,
    hostName: params.host_name,
    severity: parseInt(params.event_severity, 10) || 0,
    status: params.event_value === '0' ? 'OK' : 'PROBLEM',
    eventTime: params.event_time_iso
};

var response = req.post(params.endpoint_url, JSON.stringify(payload));
if (req.getStatus() < 200 || req.getStatus() >= 300) {
    throw 'AlertyBlurty webhook returned HTTP ' + req.getStatus() + ': ' + response;
}
return response;
'@

$mediaTypes = Invoke-ZabbixApi -Method 'mediatype.get' -Params @{
    output = @('mediatypeid','name','type','status')
    filter = @{ name = @($mediaTypeName) }
}
$mediaType = $mediaTypes | Select-Object -First 1
if (-not $mediaType) {
    $created = Invoke-ZabbixApi -Method 'mediatype.create' -Params @{
        name = $mediaTypeName
        type = 4
        status = 0
        maxattempts = 1
        maxsessions = 1
        timeout = '10s'
        script = $webhookScript
        parameters = @(
            @{ name = 'endpoint_url'; value = $endpointUrl },
            @{ name = 'event_id'; value = '{EVENT.ID}' },
            @{ name = 'trigger_id'; value = '{TRIGGER.ID}' },
            @{ name = 'trigger_name'; value = '{TRIGGER.NAME}' },
            @{ name = 'trigger_description'; value = '{TRIGGER.DESCRIPTION}' },
            @{ name = 'host_name'; value = '{HOST.HOST}' },
            @{ name = 'event_severity'; value = '{EVENT.SEVERITY}' },
            @{ name = 'event_value'; value = '{EVENT.VALUE}' },
            @{ name = 'event_time_iso'; value = '{EVENT.DATE}T{EVENT.TIME}' }
        )
        message_templates = @(
            @{ eventsource = 0; recovery = 0; subject = 'AlertyBlurty problem'; message = 'Problem event' },
            @{ eventsource = 0; recovery = 1; subject = 'AlertyBlurty recovery'; message = 'Recovery event' }
        )
    }
    $mediaType = [pscustomobject]@{ mediatypeid = $created.mediatypeids[0]; name = $mediaTypeName; type = 4; status = 0 }
}
$mediaType
```

Expected: `$mediaType.mediatypeid` is populated.

- [ ] **Step 7: Create or reuse a Zabbix user and attach the webhook media**

Run:

```powershell
$alias = 'alertyblurty-local-webhook'
$userName = 'AlertyBlurty Local Webhook'
$zabbixAdminGroupId = '7'
$zabbixSuperAdminRoleId = '3'

$users = Invoke-ZabbixApi -Method 'user.get' -Params @{
    output = @('userid','username','name')
    filter = @{ username = @($alias) }
    selectMedias = @('mediaid','mediatypeid','sendto','active')
}
$zabbixUser = $users | Select-Object -First 1
if (-not $zabbixUser) {
    $created = Invoke-ZabbixApi -Method 'user.create' -Params @{
        username = $alias
        name = $userName
        roleid = $zabbixSuperAdminRoleId
        usrgrps = @(@{ usrgrpid = $zabbixAdminGroupId })
        medias = @(@{
            mediatypeid = $mediaType.mediatypeid
            sendto = @('alertyblurty-local')
            active = 0
            severity = 63
            period = '1-7,00:00-24:00'
        })
    }
    $zabbixUser = [pscustomobject]@{ userid = $created.userids[0]; username = $alias; name = $userName }
} else {
    $hasMedia = $zabbixUser.medias | Where-Object { $_.mediatypeid -eq $mediaType.mediatypeid }
    if (-not $hasMedia) {
        Invoke-ZabbixApi -Method 'user.update' -Params @{
            userid = $zabbixUser.userid
            medias = @(@{
                mediatypeid = $mediaType.mediatypeid
                sendto = @('alertyblurty-local')
                active = 0
                severity = 63
                period = '1-7,00:00-24:00'
            })
        } | Out-Null
    }
}
$zabbixUser
```

Expected: `$zabbixUser.userid` is populated.

The current server has user group `7` named `Zabbix administrators` and role `3` named `Super admin role`; those IDs are used above.

- [ ] **Step 8: Create or reuse the trigger action**

Run:

```powershell
$actionName = 'AlertyBlurty Local File Test'
$actions = Invoke-ZabbixApi -Method 'action.get' -Params @{
    output = @('actionid','name','status')
    filter = @{ name = @($actionName) }
}
$action = $actions | Select-Object -First 1
if (-not $action) {
    $created = Invoke-ZabbixApi -Method 'action.create' -Params @{
        name = $actionName
        eventsource = 0
        status = 0
        esc_period = '1m'
        filter = @{
            evaltype = 0
            conditions = @(
                @{ conditiontype = 1; operator = 0; value = $dongo.hostid },
                @{ conditiontype = 2; operator = 0; value = $trigger.triggerid }
            )
        }
        operations = @(@{
            operationtype = 0
            esc_step_from = 1
            esc_step_to = 1
            opmessage_usr = @(@{ userid = $zabbixUser.userid })
            opmessage = @{
                default_msg = 1
                mediatypeid = $mediaType.mediatypeid
            }
        })
        recovery_operations = @(@{
            operationtype = 11
            opmessage_usr = @(@{ userid = $zabbixUser.userid })
            opmessage = @{
                default_msg = 1
                mediatypeid = $mediaType.mediatypeid
            }
        })
    }
    $action = [pscustomobject]@{ actionid = $created.actionids[0]; name = $actionName; status = 0 }
}

[ordered]@{
    hostid = $dongo.hostid
    itemid = $item.itemid
    triggerid = $trigger.triggerid
    mediatypeid = $mediaType.mediatypeid
    userid = $zabbixUser.userid
    actionid = $action.actionid
    endpointUrl = $endpointUrl
} | ConvertTo-Json -Depth 10 | Set-Content artifacts\local-zabbix-twilio-test\zabbix-objects.json
Get-Content artifacts\local-zabbix-twilio-test\zabbix-objects.json
```

Expected: all IDs are populated and `endpointUrl` contains `http://192.168.0.196:5041/api/webhooks/zabbix/`.

## Task 5: Trigger and Verify the Live Zabbix SMS Path

**Files:**

- Create: `artifacts/local-zabbix-twilio-test/live-test-result.json`
- Read: `.local-logs/api-live-test.out.log`

- [ ] **Step 1: Confirm Zabbix latest data is in recovery before triggering**

Run:

```powershell
$objects = Get-Content -Raw artifacts\local-zabbix-twilio-test\zabbix-objects.json | ConvertFrom-Json
$latestBefore = Invoke-ZabbixApi -Method 'item.get' -Params @{
    output = @('itemid','name','lastvalue','lastclock','state','error')
    itemids = @($objects.itemid)
}
$latestBefore | ConvertTo-Json -Depth 10
```

Expected: `state` is `0`. `lastvalue` may be `0` or empty before the first poll.

- [ ] **Step 2: Create the trigger file**

Run:

```powershell
"AlertyBlurty live Zabbix test $(Get-Date -Format o)" | Set-Content C:\AlertyBlurtyTest\alert.trigger
Test-Path C:\AlertyBlurtyTest\alert.trigger
```

Expected: `True`.

- [ ] **Step 3: Wait for Zabbix item and trigger to update**

Run:

```powershell
$deadline = (Get-Date).AddMinutes(3)
$observed = $null
do {
    Start-Sleep -Seconds 10
    $itemState = Invoke-ZabbixApi -Method 'item.get' -Params @{
        output = @('itemid','lastvalue','lastclock','state','error')
        itemids = @($objects.itemid)
    } | Select-Object -First 1
    $triggerState = Invoke-ZabbixApi -Method 'trigger.get' -Params @{
        output = @('triggerid','value','lastchange','state','error')
        triggerids = @($objects.triggerid)
    } | Select-Object -First 1
    $observed = [ordered]@{ item = $itemState; trigger = $triggerState }
    $observed | ConvertTo-Json -Depth 10
} until (($itemState.lastvalue -eq '1' -and $triggerState.value -eq '1') -or (Get-Date) -gt $deadline)

$observed | ConvertTo-Json -Depth 10 | Set-Content artifacts\local-zabbix-twilio-test\live-test-result.json
```

Expected: item `lastvalue` becomes `1` and trigger `value` becomes `1`.

- [ ] **Step 4: Confirm AlertyBlurty received the Zabbix webhook**

Run:

```powershell
Get-Content .local-logs\api-live-test.out.log -Tail 120 | Select-String -Pattern 'Received Zabbix webhook|Processed Zabbix webhook|SMS sent successfully|Failed to send SMS|No on-call user'
```

Expected:

- A line containing `Received Zabbix webhook`
- A line containing `Processed Zabbix webhook`
- A line containing either `SMS sent successfully` or a specific Twilio failure

- [ ] **Step 5: Ask Eric for SMS confirmation**

Ask:

```text
Did the SMS for "AlertyBlurty local file trigger on DONGO" arrive on 502-693-3830?
```

Expected: Eric confirms receipt.

Run this after Eric answers, using `$true` if the SMS arrived and `$false` if it did not:

```powershell
$smsConfirmedByEric = $true
$current = Get-Content -Raw artifacts\local-zabbix-twilio-test\live-test-result.json | ConvertFrom-Json
$current | Add-Member -NotePropertyName smsConfirmedByEric -NotePropertyValue $smsConfirmedByEric -Force
$current | ConvertTo-Json -Depth 20 | Set-Content artifacts\local-zabbix-twilio-test\live-test-result.json
```

- [ ] **Step 6: Remove the trigger file and verify recovery**

Run:

```powershell
Remove-Item C:\AlertyBlurtyTest\alert.trigger -Force -ErrorAction SilentlyContinue
$deadline = (Get-Date).AddMinutes(3)
$recovered = $null
do {
    Start-Sleep -Seconds 10
    $itemState = Invoke-ZabbixApi -Method 'item.get' -Params @{
        output = @('itemid','lastvalue','lastclock','state','error')
        itemids = @($objects.itemid)
    } | Select-Object -First 1
    $triggerState = Invoke-ZabbixApi -Method 'trigger.get' -Params @{
        output = @('triggerid','value','lastchange','state','error')
        triggerids = @($objects.triggerid)
    } | Select-Object -First 1
    $recovered = [ordered]@{ item = $itemState; trigger = $triggerState }
    $recovered | ConvertTo-Json -Depth 10
} until (($itemState.lastvalue -eq '0' -and $triggerState.value -eq '0') -or (Get-Date) -gt $deadline)

$current = Get-Content -Raw artifacts\local-zabbix-twilio-test\live-test-result.json | ConvertFrom-Json
$summary = [ordered]@{
    problemObservation = $current
    recoveryObservation = $recovered
    completedAt = (Get-Date).ToUniversalTime().ToString('o')
}
$summary | ConvertTo-Json -Depth 20 | Set-Content artifacts\local-zabbix-twilio-test\live-test-result.json
```

Expected: item `lastvalue` becomes `0` and trigger `value` becomes `0`.

## Task 6: Final Cleanup and Report

**Files:**

- Create: `artifacts/local-zabbix-twilio-test/summary.md`

- [ ] **Step 1: Disable the Zabbix action after the test**

Run:

```powershell
$objects = Get-Content -Raw artifacts\local-zabbix-twilio-test\zabbix-objects.json | ConvertFrom-Json
Invoke-ZabbixApi -Method 'action.update' -Params @{
    actionid = $objects.actionid
    status = 1
}
```

Expected: response includes the action id.

- [ ] **Step 2: Leave item and trigger enabled but file removed**

Run:

```powershell
Remove-Item C:\AlertyBlurtyTest\alert.trigger -Force -ErrorAction SilentlyContinue
Test-Path C:\AlertyBlurtyTest\alert.trigger
```

Expected: `False`.

- [ ] **Step 3: Write the run summary**

Run:

```powershell
$summary = @"
# Local Zabbix Twilio Test Summary

Run completed: $(Get-Date -Format o)

- Zabbix host: DONGO
- Trigger file: C:\AlertyBlurtyTest\alert.trigger
- AlertyBlurty API URL used by Zabbix: http://192.168.0.196:5041
- Evidence:
  - preflight.json
  - alertyblurty-seed.json
  - direct-webhook-response.json
  - zabbix-objects.json
  - live-test-result.json

Eric SMS confirmation: record final user answer in the chat transcript and in live-test-result.json.
"@
$summary | Set-Content artifacts\local-zabbix-twilio-test\summary.md
```

Expected: summary file exists.

- [ ] **Step 4: Decide whether to commit non-secret artifacts**

Run:

```powershell
git status --short artifacts\local-zabbix-twilio-test
```

Expected: generated JSON artifacts remain uncommitted. Commit only `summary.md` when it contains no secrets:

```powershell
git add artifacts\local-zabbix-twilio-test\summary.md
git commit -m "docs: record local zabbix twilio test run"
```

## Verification Checklist

- [ ] `dotnet` API health succeeds on `http://127.0.0.1:5041/health`.
- [ ] API health succeeds on `http://192.168.0.196:5041/health`.
- [ ] Direct AlertyBlurty webhook creates an incident.
- [ ] Direct AlertyBlurty webhook sends or attempts Twilio SMS with a clear log result.
- [ ] Zabbix item on `DONGO` reads `1` after creating `C:\AlertyBlurtyTest\alert.trigger`.
- [ ] Zabbix trigger enters `PROBLEM`.
- [ ] Zabbix action posts to AlertyBlurty.
- [ ] AlertyBlurty logs show webhook receipt and processing.
- [ ] Eric confirms the real SMS arrived.
- [ ] Removing the file returns the Zabbix trigger to `OK`.
- [ ] Zabbix action is disabled after the test.

## Self-Review Notes

- Spec coverage: The plan covers local file setup, AlertyBlurty data setup, Zabbix item/trigger/media/action setup, direct webhook verification, live trigger verification, recovery, and cleanup.
- Scope: The plan does not add schedule endpoints or UI because the approved spec intentionally uses direct local database seeding for the current shift.
- Secret handling: The plan avoids printing Twilio secrets and instructs not to commit generated JSON artifacts unless reviewed.
