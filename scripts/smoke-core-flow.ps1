$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$baseUrl = "http://127.0.0.1:3000"
$headers = @{ "Content-Type" = "application/json" }
$startedServer = $false
$serverProcess = $null
$serverOut = Join-Path $root "smoke-core.server.out.log"
$serverErr = Join-Path $root "smoke-core.server.err.log"

function Invoke-JsonPost {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][hashtable]$Body
  )

  return Invoke-RestMethod -Uri $Url -Method Post -Headers $headers -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 45
}

function Wait-ForServer {
  param([int]$TimeoutSeconds = 90)

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $null = Invoke-RestMethod -Uri "$baseUrl/api/agents" -Method Get -TimeoutSec 5
      return $true
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  return $false
}

try {
  $serverUp = $false
  try {
    $null = Invoke-RestMethod -Uri "$baseUrl/api/agents" -Method Get -TimeoutSec 3
    $serverUp = $true
  } catch {
    $serverUp = $false
  }

  if (-not $serverUp) {
    if (Test-Path $serverOut) { Remove-Item $serverOut -Force }
    if (Test-Path $serverErr) { Remove-Item $serverErr -Force }

    $serverProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $root -PassThru -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr
    $startedServer = $true

    if (-not (Wait-ForServer -TimeoutSeconds 90)) {
      throw "Server did not become ready at $baseUrl within timeout."
    }
  }

  $suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
  $creator = (Invoke-JsonPost -Url "$baseUrl/api/agents" -Body @{
      name = "Core-A-$suffix"
      house = "RED"
      strategyProfile = "CALCULATED"
    }).agent
  $opponent = (Invoke-JsonPost -Url "$baseUrl/api/agents" -Body @{
      name = "Core-B-$suffix"
      house = "BLUE"
      strategyProfile = "ADAPTIVE"
    }).agent

  if (-not $creator.id -or -not $opponent.id) {
    throw "Agent creation failed."
  }

  $createdMatch = (Invoke-JsonPost -Url "$baseUrl/api/matches" -Body @{
      game = "RPS"
      stakeMode = "CREDITS"
      stakeAmount = 5
      series = "QUICK"
      creatorAgentId = $creator.id
    }).match

  if (-not $createdMatch.id) {
    throw "Waiting match creation failed."
  }
  if ($createdMatch.status -ne "WAITING") {
    throw "Expected WAITING match, got $($createdMatch.status)."
  }
  Write-Output "SMOKE_CORE_CHECK created_waiting_match=$($createdMatch.id)"

  $joined = (Invoke-JsonPost -Url "$baseUrl/api/matches/$($createdMatch.id)/join" -Body @{
      opponentAgentId = $opponent.id
    }).match

  if (-not $joined.id) {
    throw "Join failed."
  }
  if ($joined.status -ne "ACTIVE") {
    throw "Expected ACTIVE match after join, got $($joined.status)."
  }
  Write-Output "SMOKE_CORE_CHECK joined_match=$($joined.id)"

  $arenaStatus = & curl.exe -s -o NUL -w "%{http_code}" "$baseUrl/match/$($createdMatch.id)"
  if ($LASTEXITCODE -ne 0) {
    throw "Arena page request failed."
  }
  if ($arenaStatus -ne "200") {
    throw "Arena page returned status $arenaStatus."
  }
  Write-Output "SMOKE_CORE_CHECK arena_page_ok=$($createdMatch.id)"

  $maxTicks = 10
  $final = $null
  for ($tick = 1; $tick -le $maxTicks; $tick += 1) {
    $null = Invoke-RestMethod -Uri "$baseUrl/api/matches/$($createdMatch.id)/tick" -Method Post -TimeoutSec 45
    $final = (Invoke-RestMethod -Uri "$baseUrl/api/matches/$($createdMatch.id)" -Method Get -TimeoutSec 15).match
    Write-Output "SMOKE_CORE_CHECK tick=$tick status=$($final.status)"
    if ($final.status -eq "COMPLETED") {
      break
    }
  }

  if (-not $final) {
    throw "Failed to fetch final match state."
  }
  if ($final.status -ne "COMPLETED") {
    throw "Match did not complete within $maxTicks ticks."
  }
  if (-not $final.moves -or $final.moves.Count -lt 2) {
    throw "Expected at least 2 moves, got $($final.moves.Count)."
  }

  Write-Output "SMOKE_CORE_OK match=$($final.id) status=$($final.status) moves=$($final.moves.Count) winner=$($final.winnerId)"
  exit 0
} catch {
  $message = if ($_.Exception -and $_.Exception.Message) { $_.Exception.Message } else { ($_ | Out-String).Trim() }
  Write-Error "SMOKE_CORE_FAILED: $message"
  if (Test-Path $serverErr) {
    Write-Output "--- server stderr (tail) ---"
    Get-Content $serverErr -Tail 60
  }
  if (Test-Path $serverOut) {
    Write-Output "--- server stdout (tail) ---"
    Get-Content $serverOut -Tail 60
  }
  exit 1
} finally {
  if ($startedServer -and $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
