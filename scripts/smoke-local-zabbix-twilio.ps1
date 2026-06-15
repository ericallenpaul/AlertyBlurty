[CmdletBinding()]
param(
    [switch]$RunLive,
    [switch]$RestartApi,
    [switch]$SkipZabbix,
    [switch]$SkipDirectWebhook,
    [switch]$SkipCleanup,
    [string]$ApiBaseUrl = "http://127.0.0.1:5041",
    [string]$WebhookBaseUrl = "http://192.168.0.196:5041",
    [string]$HostName = "DONGO",
    [string]$TriggerDirectory = "C:\AlertyBlurtyTest",
    [string]$TriggerFile = "C:\AlertyBlurtyTest\alert.trigger",
    [string]$OrganizationName = "AlertyBlurty Local Test",
    [string]$TeamName = "DONGO File Watch Test",
    [string]$SmokeEmail = "eric.paul.localtest@alertyblurty.test",
    [string]$SmokePassword = "LocalTest!2026-06-10",
    [string]$SmokeFullName = "Eric Paul",
    [string]$SmokePhoneNumber = "+15026933830",
    [string]$SmokeTimezone = "America/New_York",
    [int]$PollSeconds = 10,
    [int]$PollTimeoutSeconds = 240
)

$ErrorActionPreference = "Stop"

function Write-Step {
    param([string]$Message)
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Write-JsonFile {
    param(
        [Parameter(Mandatory = $true)]$Value,
        [Parameter(Mandatory = $true)][string]$Path,
        [int]$Depth = 20
    )

    $Value | ConvertTo-Json -Depth $Depth | Set-Content -LiteralPath $Path
}

function Read-DotEnv {
    param([string]$Path)

    $values = @{}
    if (-not (Test-Path -LiteralPath $Path)) {
        return $values
    }

    Get-Content -LiteralPath $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line -eq "" -or $line.StartsWith("#") -or $line -notmatch "^[A-Za-z0-9_]+=") {
            return
        }

        $parts = $line -split "=", 2
        $values[$parts[0]] = $parts[1].Trim().Trim('"').Trim("'")
    }

    return $values
}

function Get-ConfigValue {
    param(
        [hashtable]$DotEnv,
        $LocalConfig,
        [string[]]$Keys
    )

    foreach ($key in $Keys) {
        if ($DotEnv.ContainsKey($key) -and -not [string]::IsNullOrWhiteSpace($DotEnv[$key])) {
            return $DotEnv[$key]
        }
    }

    if ($null -eq $LocalConfig) {
        return $null
    }

    foreach ($key in $Keys) {
        $segments = $key -split ":"
        $current = $LocalConfig
        foreach ($segment in $segments) {
            if ($null -eq $current -or -not ($current.PSObject.Properties.Name -contains $segment)) {
                $current = $null
                break
            }
            $current = $current.$segment
        }

        if ($null -ne $current -and -not [string]::IsNullOrWhiteSpace([string]$current)) {
            return [string]$current
        }
    }

    return $null
}

function New-PostgresConnectionStringFromDotEnv {
    param([hashtable]$DotEnv)

    if (-not $DotEnv.ContainsKey("DB_APP_USER") -or -not $DotEnv.ContainsKey("DB_PASSWORD")) {
        return $null
    }

    $hostName = if ($DotEnv.ContainsKey("DB_HOST")) { $DotEnv["DB_HOST"] } else { "localhost" }
    $port = if ($DotEnv.ContainsKey("DB_PORT")) { $DotEnv["DB_PORT"] } else { "5432" }
    $database = if ($DotEnv.ContainsKey("DB_NAME")) { $DotEnv["DB_NAME"] } else { "alertyblurty" }
    $username = $DotEnv["DB_APP_USER"]
    $password = $DotEnv["DB_PASSWORD"]

    return "Host=$hostName;Port=$port;Database=$database;Username=$username;Password=$password"
}

function Invoke-Json {
    param(
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)][string]$Uri,
        $Body = $null,
        [hashtable]$Headers = @{}
    )

    $parameters = @{
        Method      = $Method
        Uri         = $Uri
        Headers     = $Headers
        ContentType = "application/json"
    }

    if ($null -ne $Body) {
        $parameters.Body = ($Body | ConvertTo-Json -Depth 30)
    }

    try {
        return Invoke-RestMethod @parameters
    }
    catch {
        $responseText = ""
        if ($_.Exception.Response -and $_.Exception.Response.GetResponseStream()) {
            $reader = [System.IO.StreamReader]::new($_.Exception.Response.GetResponseStream())
            $responseText = $reader.ReadToEnd()
        }

        throw "HTTP $Method $Uri failed. $responseText"
    }
}

function New-BasicAuthHeader {
    param(
        [Parameter(Mandatory = $true)][string]$UserName,
        [Parameter(Mandatory = $true)][string]$Password
    )

    $bytes = [Text.Encoding]::ASCII.GetBytes("${UserName}:${Password}")
    return "Basic $([Convert]::ToBase64String($bytes))"
}

function Wait-Until {
    param(
        [Parameter(Mandatory = $true)][scriptblock]$Probe,
        [int]$TimeoutSeconds,
        [int]$IntervalSeconds,
        [string]$Description
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    do {
        $result = & $Probe
        if ($result.Success) {
            return $result
        }

        Start-Sleep -Seconds $IntervalSeconds
    } while ((Get-Date) -lt $deadline)

    throw "Timed out waiting for $Description after $TimeoutSeconds seconds."
}

function Wait-TwilioMessage {
    param(
        [string]$AccountSid,
        [string]$AuthToken,
        [string]$FromPhoneNumber,
        [string]$ToPhoneNumber,
        [string]$RunId,
        [datetime]$StartedAtUtc,
        [int]$TimeoutSeconds,
        [int]$IntervalSeconds
    )

    $auth = New-BasicAuthHeader -UserName $AccountSid -Password $AuthToken
    $encodedFrom = [Uri]::EscapeDataString($FromPhoneNumber)
    $encodedTo = [Uri]::EscapeDataString($ToPhoneNumber)
    $dateSent = $StartedAtUtc.ToString("yyyy-MM-dd")
    $uri = "https://api.twilio.com/2010-04-01/Accounts/$AccountSid/Messages.json?From=$encodedFrom&To=$encodedTo&DateSent=$dateSent&PageSize=20"

    return Wait-Until -TimeoutSeconds $TimeoutSeconds -IntervalSeconds $IntervalSeconds -Description "Twilio message containing $RunId" -Probe {
        $response = Invoke-RestMethod -Method Get -Uri $uri -Headers @{ Authorization = $auth }
        $matches = @($response.messages | Where-Object {
                $_.body -like "*$RunId*" -and ([datetime]$_.date_created).ToUniversalTime() -ge $StartedAtUtc.AddMinutes(-2)
            })

        if ($matches.Count -gt 0) {
            $message = $matches | Sort-Object { [datetime]$_.date_created } -Descending | Select-Object -First 1
            return [pscustomobject]@{
                Success = $true
                Message = $message
                QueryUri = $uri
            }
        }

        return [pscustomobject]@{
            Success = $false
            QueryUri = $uri
        }
    }
}

function Restart-AlertyBlurtyApi {
    param(
        [string]$ProjectRoot,
        [string]$ArtifactRoot,
        [string]$BindUrl,
        [string]$ConnectionString,
        [string]$JwtSecret,
        [string]$TwilioAccountSid,
        [string]$TwilioAuthToken,
        [string]$TwilioPhoneNumber
    )

    Write-Step "Restarting AlertyBlurty API for live smoke configuration"
    $port = [int](([Uri]$BindUrl).Port)
    $owners = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique

    foreach ($ownerPid in $owners) {
        if ($ownerPid -and $ownerPid -ne 0) {
            Stop-Process -Id $ownerPid -Force -ErrorAction SilentlyContinue
        }
    }

    $env:CONNECTION_STRING = $ConnectionString
    $env:JWT_SECRET = $JwtSecret
    $env:TWILIO_ACCOUNT_SID = $TwilioAccountSid
    $env:TWILIO_AUTH_TOKEN = $TwilioAuthToken
    $env:TWILIO_PHONE_NUMBER = $TwilioPhoneNumber

    $apiOut = Join-Path $ArtifactRoot "api.out.log"
    $apiErr = Join-Path $ArtifactRoot "api.err.log"
    Start-Process -FilePath "dotnet" `
        -ArgumentList @("run", "--project", "src\alertblurty.Api\alertblurty.Api.csproj", "--urls", $BindUrl) `
        -WorkingDirectory $ProjectRoot `
        -RedirectStandardOutput $apiOut `
        -RedirectStandardError $apiErr `
        -WindowStyle Hidden

    Wait-Until -TimeoutSeconds 60 -IntervalSeconds 2 -Description "AlertyBlurty API health on $BindUrl" -Probe {
        try {
            $healthUrl = "$($BindUrl.Replace("0.0.0.0", "127.0.0.1"))/health"
            $health = Invoke-RestMethod -Method Get -Uri $healthUrl
            return [pscustomobject]@{ Success = ($health.status -eq "healthy"); Health = $health }
        }
        catch {
            return [pscustomobject]@{ Success = $false }
        }
    } | Out-Null
}

function Invoke-ZabbixApi {
    param(
        [Parameter(Mandatory = $true)][string]$Uri,
        [Parameter(Mandatory = $true)][string]$Token,
        [Parameter(Mandatory = $true)][string]$Method,
        [Parameter(Mandatory = $true)]$Params
    )

    if (-not $script:ZabbixRequestId) {
        $script:ZabbixRequestId = 1000
    }

    $script:ZabbixRequestId += 1
    $body = @{
        jsonrpc = "2.0"
        method  = $Method
        params  = $Params
        auth    = $Token
        id      = $script:ZabbixRequestId
    }

    $response = Invoke-Json -Method Post -Uri $Uri -Body $body
    if ($response.error) {
        throw "Zabbix $Method failed: $($response.error | ConvertTo-Json -Depth 10)"
    }

    return $response.result
}

function Get-ApiToken {
    param(
        [string]$BaseUrl,
        [string]$Email,
        [string]$Password,
        [string]$FullName,
        [string]$PhoneNumber,
        [string]$Timezone,
        [string]$OrganizationName
    )

    $registerBody = @{
        email            = $Email
        password         = $Password
        fullName         = $FullName
        phoneNumber      = $PhoneNumber
        timezone         = $Timezone
        organizationName = $OrganizationName
    }

    try {
        $auth = Invoke-Json -Method Post -Uri "$BaseUrl/api/auth/register" -Body $registerBody
    }
    catch {
        $auth = Invoke-Json -Method Post -Uri "$BaseUrl/api/auth/login" -Body @{
            email    = $Email
            password = $Password
        }
    }

    if (-not $auth.success -or [string]::IsNullOrWhiteSpace($auth.data.token)) {
        throw "Could not register or log in smoke user $Email."
    }

    return $auth.data.token
}

function Ensure-TeamRoute {
    param(
        [string]$BaseUrl,
        [string]$Token,
        [string]$TeamName,
        [string]$RunId
    )

    $headers = @{ Authorization = "Bearer $Token" }
    $me = Invoke-Json -Method Get -Uri "$BaseUrl/api/users/me" -Headers $headers
    $teams = @(Invoke-Json -Method Get -Uri "$BaseUrl/api/teams/organization/$($me.organizationId)" -Headers $headers)
    $team = $teams | Where-Object { $_.name -eq $TeamName } | Select-Object -First 1

    if (-not $team) {
        $team = Invoke-Json -Method Post -Uri "$BaseUrl/api/teams" -Headers $headers -Body @{
            name                         = $TeamName
            description                  = "Local Zabbix/Twilio smoke route"
            requireAdminApprovalForSwaps = $false
        }
    }

    $members = @(Invoke-Json -Method Get -Uri "$BaseUrl/api/teams/$($team.id)/members" -Headers $headers)
    $member = $members | Where-Object { $_.userId -eq $me.id } | Select-Object -First 1
    if (-not $member) {
        $member = Invoke-Json -Method Post -Uri "$BaseUrl/api/teams/$($team.id)/members" -Headers $headers -Body @{
            userId        = $me.id
            rotationOrder = 1
        }
    }

    $scheduleName = "Smoke $RunId Current On-Call"
    $start = (Get-Date).ToUniversalTime().AddMinutes(-10)
    $schedule = Invoke-Json -Method Post -Uri "$BaseUrl/api/schedules" -Headers $headers -Body @{
        teamId          = $team.id
        name            = $scheduleName
        frequency       = 0
        startTimeUtc    = $start.ToString("o")
        durationMinutes = 180
    }

    $shifts = Invoke-Json -Method Post -Uri "$BaseUrl/api/schedules/$($schedule.id)/generate-shifts" -Headers $headers -Body @{
        count = 1
    }

    return [pscustomobject]@{
        User     = $me
        Team     = $team
        Member   = $member
        Schedule = $schedule
        Shifts   = $shifts
    }
}

function Configure-Zabbix {
    param(
        [string]$ZabbixUri,
        [string]$ZabbixToken,
        [string]$HostName,
        [string]$TriggerFile,
        [string]$EndpointUrl
    )

    $hostResult = @(Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "host.get" -Params @{
            output           = @("hostid", "host", "name", "status")
            filter           = @{ host = @($HostName) }
            selectInterfaces = @("interfaceid", "ip", "dns", "type", "main")
        })
    $zabbixHost = $hostResult | Select-Object -First 1
    if (-not $zabbixHost) {
        throw "Zabbix host $HostName was not found."
    }

    $escapedTriggerFile = $TriggerFile.Replace("\", "\\")
    $itemName = "AlertyBlurty trigger file exists"
    $itemKey = "vfs.file.exists[`"$TriggerFile`"]"
    $items = @(Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "item.get" -Params @{
            output  = @("itemid", "name", "key_", "hostid", "status")
            hostids = @($zabbixHost.hostid)
            search  = @{ key_ = $itemKey }
        })
    $item = $items | Select-Object -First 1
    if (-not $item) {
        $createdItem = Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "item.create" -Params @{
            name       = $itemName
            key_       = $itemKey
            hostid     = $zabbixHost.hostid
            type       = 0
            value_type = 3
            delay      = "10s"
            status     = 0
        }
        $item = [pscustomobject]@{ itemid = $createdItem.itemids[0]; name = $itemName; key_ = $itemKey; hostid = $zabbixHost.hostid; status = 0 }
    }

    $triggerName = "AlertyBlurty local file trigger on $HostName"
    $triggerExpression = "last(/$HostName/vfs.file.exists[`"$TriggerFile`"])=1"
    $triggers = @(Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "trigger.get" -Params @{
            output  = @("triggerid", "description", "expression", "status", "value")
            hostids = @($zabbixHost.hostid)
            filter  = @{ description = @($triggerName) }
        })
    $trigger = $triggers | Select-Object -First 1
    if (-not $trigger) {
        $createdTrigger = Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "trigger.create" -Params @{
            description = $triggerName
            expression  = $triggerExpression
            priority    = 3
            status      = 0
        }
        $trigger = [pscustomobject]@{ triggerid = $createdTrigger.triggerids[0]; description = $triggerName; expression = $triggerExpression; status = 0 }
    }

    $mediaTypeName = "AlertyBlurty Local Webhook"
    $webhookScript = @"
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
    eventTime: new Date().toISOString()
};

var response = req.post(params.endpoint_url, JSON.stringify(payload));
if (req.getStatus() < 200 || req.getStatus() >= 300) {
    throw 'AlertyBlurty webhook returned HTTP ' + req.getStatus() + ': ' + response;
}
return response;
"@

    $mediaTypes = @(Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "mediatype.get" -Params @{
            output = @("mediatypeid", "name", "type", "status")
            filter = @{ name = @($mediaTypeName) }
        })
    $mediaType = $mediaTypes | Select-Object -First 1
    $mediaTypeParams = @{
        name              = $mediaTypeName
        type              = 4
        status            = 0
        maxattempts       = 1
        maxsessions       = 1
        timeout           = "10s"
        script            = $webhookScript
        parameters        = @(
            @{ name = "endpoint_url"; value = $EndpointUrl },
            @{ name = "event_id"; value = "{EVENT.ID}" },
            @{ name = "trigger_id"; value = "{TRIGGER.ID}" },
            @{ name = "trigger_name"; value = "{TRIGGER.NAME}" },
            @{ name = "trigger_description"; value = "AlertyBlurty smoke trigger $script:RunId from Zabbix" },
            @{ name = "host_name"; value = "{HOST.HOST}" },
            @{ name = "event_severity"; value = "{EVENT.SEVERITY}" },
            @{ name = "event_value"; value = "{EVENT.VALUE}" }
        )
        message_templates = @(
            @{ eventsource = 0; recovery = 0; subject = "AlertyBlurty problem"; message = "Problem event" },
            @{ eventsource = 0; recovery = 1; subject = "AlertyBlurty recovery"; message = "Recovery event" }
        )
    }
    if (-not $mediaType) {
        $createdMediaType = Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "mediatype.create" -Params $mediaTypeParams
        $mediaType = [pscustomobject]@{ mediatypeid = $createdMediaType.mediatypesids[0]; name = $mediaTypeName; type = 4; status = 0 }
        if (-not $mediaType.mediatypeid) {
            $mediaType.mediatypeid = $createdMediaType.mediatypeids[0]
        }
    }
    else {
        $mediaTypeParams.mediatypeid = $mediaType.mediatypeid
        Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "mediatype.update" -Params $mediaTypeParams | Out-Null
    }

    $alias = "alertyblurty-local-webhook"
    $users = @(Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "user.get" -Params @{
            output       = @("userid", "username", "name")
            filter       = @{ username = @($alias) }
            selectMedias = @("mediaid", "mediatypeid", "sendto", "active")
        })
    $zabbixUser = $users | Select-Object -First 1
    $media = @{
        mediatypeid = $mediaType.mediatypeid
        sendto      = @("alertyblurty-local")
        active      = 0
        severity    = 63
        period      = "1-7,00:00-24:00"
    }
    if (-not $zabbixUser) {
        $createdUser = Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "user.create" -Params @{
            username = $alias
            name     = "AlertyBlurty Local Webhook"
            roleid   = "3"
            usrgrps  = @(@{ usrgrpid = "7" })
            medias   = @($media)
        }
        $zabbixUser = [pscustomobject]@{ userid = $createdUser.userids[0]; username = $alias }
    }
    else {
        Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "user.update" -Params @{
            userid = $zabbixUser.userid
            medias = @($media)
        } | Out-Null
    }

    $actionName = "AlertyBlurty Local File Test"
    $actions = @(Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "action.get" -Params @{
            output = @("actionid", "name", "status")
            filter = @{ name = @($actionName) }
        })
    $action = $actions | Select-Object -First 1
    $actionParams = @{
        name                = $actionName
        eventsource         = 0
        status              = 0
        esc_period          = "1m"
        filter              = @{
            evaltype   = 0
            conditions = @(
                @{ conditiontype = 1; operator = 0; value = $zabbixHost.hostid },
                @{ conditiontype = 2; operator = 0; value = $trigger.triggerid }
            )
        }
        operations          = @(@{
                operationtype = 0
                esc_step_from = 1
                esc_step_to   = 1
                opmessage_usr = @(@{ userid = $zabbixUser.userid })
                opmessage     = @{
                    default_msg = 1
                    mediatypeid = $mediaType.mediatypeid
                }
            })
        recovery_operations = @(@{
                operationtype = 11
                opmessage     = @{
                    default_msg = 1
                }
            })
    }
    if (-not $action) {
        $createdAction = Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "action.create" -Params $actionParams
        $action = [pscustomobject]@{ actionid = $createdAction.actionids[0]; name = $actionName; status = 0 }
    }
    else {
        $actionParams.actionid = $action.actionid
        Invoke-ZabbixApi -Uri $ZabbixUri -Token $ZabbixToken -Method "action.update" -Params $actionParams | Out-Null
    }

    return [pscustomobject]@{
        Host        = $zabbixHost
        Item        = $item
        Trigger     = $trigger
        MediaType   = $mediaType
        ZabbixUser  = $zabbixUser
        Action      = $action
        EndpointUrl = $EndpointUrl
    }
}

if (-not $RunLive) {
    Write-Host "Dry run only. Re-run with -RunLive and SMOKE_ZABBIX_TWILIO_ENABLED=true to send real webhooks/SMS." -ForegroundColor Yellow
    Write-Host "Example:"
    Write-Host '  $env:SMOKE_ZABBIX_TWILIO_ENABLED="true"; .\scripts\smoke-local-zabbix-twilio.ps1 -RunLive'
    exit 0
}

if ($env:SMOKE_ZABBIX_TWILIO_ENABLED -ne "true") {
    throw "Set SMOKE_ZABBIX_TWILIO_ENABLED=true before running this live smoke test."
}

$script:RunId = "smoke-$((Get-Date).ToUniversalTime().ToString("yyyyMMdd-HHmmss"))"
$artifactRoot = Join-Path "artifacts/local-zabbix-twilio-smoke" $script:RunId
New-Item -ItemType Directory -Force -Path $artifactRoot | Out-Null

$dotEnv = Read-DotEnv -Path ".env"
$localConfigPath = "src/alertblurty.Api/data/appsettings.Local.json"
$localConfig = if (Test-Path -LiteralPath $localConfigPath) {
    Get-Content -Raw -LiteralPath $localConfigPath | ConvertFrom-Json
}
else {
    $null
}

$twilioAccountSid = Get-ConfigValue -DotEnv $dotEnv -LocalConfig $localConfig -Keys @("TWILIO_ACCOUNT_SID", "Twilio:AccountSid")
$twilioAuthToken = Get-ConfigValue -DotEnv $dotEnv -LocalConfig $localConfig -Keys @("TWILIO_AUTH_TOKEN", "TWILIO_SECRET", "Twilio:AuthToken")
$twilioPhoneNumber = Get-ConfigValue -DotEnv $dotEnv -LocalConfig $localConfig -Keys @("TWILIO_PHONE_NUMBER", "Twilio:PhoneNumber")
$connectionString = Get-ConfigValue -DotEnv $dotEnv -LocalConfig $localConfig -Keys @("CONNECTION_STRING", "ConnectionStrings:DefaultConnection")
if ([string]::IsNullOrWhiteSpace($connectionString)) {
    $connectionString = New-PostgresConnectionStringFromDotEnv -DotEnv $dotEnv
}
$jwtSecret = Get-ConfigValue -DotEnv $dotEnv -LocalConfig $localConfig -Keys @("JWT_SECRET", "JwtSettings:Secret")
$zabbixServer = Get-ConfigValue -DotEnv $dotEnv -LocalConfig $localConfig -Keys @("ZABBIX_SERVER")
$zabbixToken = Get-ConfigValue -DotEnv $dotEnv -LocalConfig $localConfig -Keys @("ZABBIX_API_KEY")

$preflight = [ordered]@{
    runId                    = $script:RunId
    checkedAtUtc             = (Get-Date).ToUniversalTime().ToString("o")
    apiBaseUrl               = $ApiBaseUrl
    webhookBaseUrl           = $WebhookBaseUrl
    skipZabbix               = [bool]$SkipZabbix
    skipDirectWebhook        = [bool]$SkipDirectWebhook
    twilioAccountSidPresent  = -not [string]::IsNullOrWhiteSpace($twilioAccountSid)
    twilioAuthTokenPresent   = -not [string]::IsNullOrWhiteSpace($twilioAuthToken)
    twilioPhoneNumberPresent = -not [string]::IsNullOrWhiteSpace($twilioPhoneNumber)
    connectionStringPresent  = -not [string]::IsNullOrWhiteSpace($connectionString)
    jwtSecretPresent         = -not [string]::IsNullOrWhiteSpace($jwtSecret)
    zabbixServerPresent      = -not [string]::IsNullOrWhiteSpace($zabbixServer)
    zabbixApiKeyPresent      = -not [string]::IsNullOrWhiteSpace($zabbixToken)
}
Write-JsonFile -Value $preflight -Path (Join-Path $artifactRoot "preflight.json")

if (-not $preflight.twilioAccountSidPresent -or -not $preflight.twilioAuthTokenPresent -or -not $preflight.twilioPhoneNumberPresent) {
    throw "Twilio settings are required. Provide TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN/TWILIO_SECRET, and TWILIO_PHONE_NUMBER."
}

if (-not $preflight.connectionStringPresent -or -not $preflight.jwtSecretPresent) {
    throw "Database and JWT settings are required. Provide CONNECTION_STRING and JWT_SECRET or appsettings.Local.json values."
}

if (-not $SkipZabbix -and (-not $preflight.zabbixServerPresent -or -not $preflight.zabbixApiKeyPresent)) {
    throw "Zabbix settings are required for the full smoke test. Provide ZABBIX_SERVER and ZABBIX_API_KEY or pass -SkipZabbix."
}

if ($RestartApi) {
    Restart-AlertyBlurtyApi `
        -ProjectRoot (Get-Location).Path `
        -ArtifactRoot $artifactRoot `
        -BindUrl "http://0.0.0.0:5041" `
        -ConnectionString $connectionString `
        -JwtSecret $jwtSecret `
        -TwilioAccountSid $twilioAccountSid `
        -TwilioAuthToken $twilioAuthToken `
        -TwilioPhoneNumber $twilioPhoneNumber
}

Write-Step "Checking AlertyBlurty health"
$health = Invoke-Json -Method Get -Uri "$ApiBaseUrl/health"
Write-JsonFile -Value $health -Path (Join-Path $artifactRoot "api-health.json")

Write-Step "Seeding smoke user, team, schedule, and current shift"
$token = Get-ApiToken -BaseUrl $ApiBaseUrl -Email $SmokeEmail -Password $SmokePassword -FullName $SmokeFullName -PhoneNumber $SmokePhoneNumber -Timezone $SmokeTimezone -OrganizationName $OrganizationName
$route = Ensure-TeamRoute -BaseUrl $ApiBaseUrl -Token $token -TeamName $TeamName -RunId $script:RunId
Write-JsonFile -Value @{
    userId         = $route.User.id
    organizationId = $route.User.organizationId
    teamId         = $route.Team.id
    teamName       = $route.Team.name
    scheduleId     = $route.Schedule.id
    shiftCount     = @($route.Shifts).Count
    phoneNumber    = $route.User.phoneNumber
} -Path (Join-Path $artifactRoot "alertyblurty-route.json")

$twilioChecks = @()

if (-not $SkipDirectWebhook) {
    Write-Step "Sending direct AlertyBlurty webhook and polling Twilio"
    $directStartedAtUtc = (Get-Date).ToUniversalTime()
    $directEventId = "$script:RunId-direct"
    $directPayload = @{
        eventId            = $directEventId
        triggerId          = "$script:RunId-direct-trigger"
        triggerName        = "Direct local smoke test $script:RunId"
        triggerDescription = "Direct AlertyBlurty/Twilio smoke verification $script:RunId"
        hostName           = $HostName
        severity           = 3
        status             = "PROBLEM"
        eventTime          = $directStartedAtUtc.ToString("o")
    }
    $directResponse = Invoke-Json -Method Post -Uri "$ApiBaseUrl/api/webhooks/zabbix/$($route.Team.id)" -Body $directPayload
    Write-JsonFile -Value @{ payload = $directPayload; response = $directResponse } -Path (Join-Path $artifactRoot "direct-webhook.json")

    $directTwilio = Wait-TwilioMessage -AccountSid $twilioAccountSid -AuthToken $twilioAuthToken -FromPhoneNumber $twilioPhoneNumber -ToPhoneNumber $SmokePhoneNumber -RunId $script:RunId -StartedAtUtc $directStartedAtUtc -TimeoutSeconds $PollTimeoutSeconds -IntervalSeconds $PollSeconds
    $twilioChecks += [pscustomobject]@{
        path   = "direct"
        sid    = $directTwilio.Message.sid
        status = $directTwilio.Message.status
        to     = $directTwilio.Message.to
        from   = $directTwilio.Message.from
        body   = $directTwilio.Message.body
    }
    Write-JsonFile -Value $twilioChecks[-1] -Path (Join-Path $artifactRoot "twilio-direct.json")
}

if (-not $SkipZabbix) {
    Write-Step "Configuring Zabbix local file trigger"
    New-Item -ItemType Directory -Force -Path $TriggerDirectory | Out-Null
    Remove-Item -LiteralPath $TriggerFile -Force -ErrorAction SilentlyContinue

    $zabbixUri = $zabbixServer.TrimEnd("/") + "/api_jsonrpc.php"
    $version = Invoke-Json -Method Post -Uri $zabbixUri -Body @{
        jsonrpc = "2.0"
        method  = "apiinfo.version"
        params  = @{}
        id      = 1
    }
    Write-JsonFile -Value $version -Path (Join-Path $artifactRoot "zabbix-version.json")

    $endpointUrl = "$WebhookBaseUrl/api/webhooks/zabbix/$($route.Team.id)"
    $zabbixObjects = Configure-Zabbix -ZabbixUri $zabbixUri -ZabbixToken $zabbixToken -HostName $HostName -TriggerFile $TriggerFile -EndpointUrl $endpointUrl
    Write-JsonFile -Value $zabbixObjects -Path (Join-Path $artifactRoot "zabbix-objects.json")
    $configuredAction = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "action.get" -Params @{
        output                   = @("actionid", "name", "status")
        actionids                = @($zabbixObjects.Action.actionid)
        selectOperations         = "extend"
        selectRecoveryOperations = "extend"
        selectFilter             = "extend"
    }
    Write-JsonFile -Value $configuredAction -Path (Join-Path $artifactRoot "zabbix-configured-action.json")

    Write-Step "Ensuring Zabbix trigger is recovered before creating a new problem"
    Remove-Item -LiteralPath $TriggerFile -Force -ErrorAction SilentlyContinue
    $ready = Wait-Until -TimeoutSeconds $PollTimeoutSeconds -IntervalSeconds $PollSeconds -Description "Zabbix trigger to be recovered before smoke trigger" -Probe {
        $itemState = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "item.get" -Params @{
            output  = @("itemid", "lastvalue", "lastclock", "state", "error")
            itemids = @($zabbixObjects.Item.itemid)
        } | Select-Object -First 1
        $triggerState = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "trigger.get" -Params @{
            output     = @("triggerid", "value", "lastchange", "state", "error")
            triggerids = @($zabbixObjects.Trigger.triggerid)
        } | Select-Object -First 1

        return [pscustomobject]@{
            Success = (($itemState.lastvalue -eq "0" -or [string]::IsNullOrWhiteSpace($itemState.lastvalue)) -and $triggerState.value -eq "0")
            Item    = $itemState
            Trigger = $triggerState
        }
    }
    Write-JsonFile -Value $ready -Path (Join-Path $artifactRoot "zabbix-ready.json")

    Write-Step "Creating trigger file and waiting for Zabbix PROBLEM"
    $zabbixStartedAtUtc = (Get-Date).ToUniversalTime()
    "AlertyBlurty smoke $script:RunId" | Set-Content -LiteralPath $TriggerFile

    $problem = Wait-Until -TimeoutSeconds $PollTimeoutSeconds -IntervalSeconds $PollSeconds -Description "Zabbix trigger to enter PROBLEM" -Probe {
        $itemState = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "item.get" -Params @{
            output  = @("itemid", "lastvalue", "lastclock", "state", "error")
            itemids = @($zabbixObjects.Item.itemid)
        } | Select-Object -First 1
        $triggerState = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "trigger.get" -Params @{
            output     = @("triggerid", "value", "lastchange", "state", "error")
            triggerids = @($zabbixObjects.Trigger.triggerid)
        } | Select-Object -First 1

        return [pscustomobject]@{
            Success = ($itemState.lastvalue -eq "1" -and $triggerState.value -eq "1")
            Item    = $itemState
            Trigger = $triggerState
        }
    }
    Write-JsonFile -Value $problem -Path (Join-Path $artifactRoot "zabbix-problem.json")

    Write-Step "Polling Twilio for Zabbix-triggered SMS"
    try {
        $zabbixTwilio = Wait-TwilioMessage -AccountSid $twilioAccountSid -AuthToken $twilioAuthToken -FromPhoneNumber $twilioPhoneNumber -ToPhoneNumber $SmokePhoneNumber -RunId $script:RunId -StartedAtUtc $zabbixStartedAtUtc -TimeoutSeconds $PollTimeoutSeconds -IntervalSeconds $PollSeconds
    }
    catch {
        $diagnostics = [ordered]@{
            error  = $_.Exception.Message
            alerts = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "alert.get" -Params @{
                output    = "extend"
                actionids = @($zabbixObjects.Action.actionid)
                sortfield = "clock"
                sortorder = "DESC"
                limit     = 10
            }
            events = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "event.get" -Params @{
                output    = @("eventid", "clock", "name", "value", "severity", "objectid")
                objectids = @($zabbixObjects.Trigger.triggerid)
                sortfield = "clock"
                sortorder = "DESC"
                limit     = 10
            }
        }
        Write-JsonFile -Value $diagnostics -Path (Join-Path $artifactRoot "zabbix-timeout-diagnostics.json")

        Remove-Item -LiteralPath $TriggerFile -Force -ErrorAction SilentlyContinue
        if (-not $SkipCleanup) {
            Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "action.update" -Params @{
                actionid = $zabbixObjects.Action.actionid
                status   = 1
            } | Out-Null
        }

        throw
    }
    $twilioChecks += [pscustomobject]@{
        path   = "zabbix"
        sid    = $zabbixTwilio.Message.sid
        status = $zabbixTwilio.Message.status
        to     = $zabbixTwilio.Message.to
        from   = $zabbixTwilio.Message.from
        body   = $zabbixTwilio.Message.body
    }
    Write-JsonFile -Value $twilioChecks[-1] -Path (Join-Path $artifactRoot "twilio-zabbix.json")

    Write-Step "Removing trigger file and waiting for Zabbix recovery"
    Remove-Item -LiteralPath $TriggerFile -Force -ErrorAction SilentlyContinue
    $recovery = Wait-Until -TimeoutSeconds $PollTimeoutSeconds -IntervalSeconds $PollSeconds -Description "Zabbix trigger to recover" -Probe {
        $itemState = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "item.get" -Params @{
            output  = @("itemid", "lastvalue", "lastclock", "state", "error")
            itemids = @($zabbixObjects.Item.itemid)
        } | Select-Object -First 1
        $triggerState = Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "trigger.get" -Params @{
            output     = @("triggerid", "value", "lastchange", "state", "error")
            triggerids = @($zabbixObjects.Trigger.triggerid)
        } | Select-Object -First 1

        return [pscustomobject]@{
            Success = ($itemState.lastvalue -eq "0" -and $triggerState.value -eq "0")
            Item    = $itemState
            Trigger = $triggerState
        }
    }
    Write-JsonFile -Value $recovery -Path (Join-Path $artifactRoot "zabbix-recovery.json")

    if (-not $SkipCleanup) {
        Write-Step "Disabling Zabbix test action"
        Invoke-ZabbixApi -Uri $zabbixUri -Token $zabbixToken -Method "action.update" -Params @{
            actionid = $zabbixObjects.Action.actionid
            status   = 1
        } | Out-Null
    }
}

$summary = [ordered]@{
    runId             = $script:RunId
    completedAtUtc    = (Get-Date).ToUniversalTime().ToString("o")
    artifactRoot      = $artifactRoot
    directWebhook     = -not $SkipDirectWebhook
    zabbix            = -not $SkipZabbix
    twilioMessageSids = @($twilioChecks | ForEach-Object { $_.sid })
}
Write-JsonFile -Value $summary -Path (Join-Path $artifactRoot "summary.json")

Write-Step "Smoke test completed"
$summary | ConvertTo-Json -Depth 10
