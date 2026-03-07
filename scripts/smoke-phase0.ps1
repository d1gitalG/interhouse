$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$baseUrl = "http://127.0.0.1:3000"
$headers = @{ "Content-Type" = "application/json" }
$startedServer = $false
$serverProcess = $null
$serverOut = Join-Path $root "smoke-phase0.server.out.log"
$serverErr = Join-Path $root "smoke-phase0.server.err.log"

function Invoke-JsonPost {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [Parameter(Mandatory = $true)][hashtable]$Body
  )

  return Invoke-RestMethod -Uri $Url -Method Post -Headers $headers -Body ($Body | ConvertTo-Json -Depth 10) -TimeoutSec 30
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
    $env:GEMINI_API_KEY = ""
    $env:ANTHROPIC_API_KEY = ""

    if (Test-Path $serverOut) { Remove-Item $serverOut -Force }
    if (Test-Path $serverErr) { Remove-Item $serverErr -Force }

    $serverProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev" -WorkingDirectory $root -PassThru -RedirectStandardOutput $serverOut -RedirectStandardError $serverErr
    $startedServer = $true

    if (-not (Wait-ForServer -TimeoutSeconds 90)) {
      throw "Server did not become ready at $baseUrl within timeout."
    }
  }

  $suffix = [Guid]::NewGuid().ToString("N").Substring(0, 8)
  $agent1 = (Invoke-JsonPost -Url "$baseUrl/api/agents" -Body @{
      name = "Smoke-A-$suffix"
      house = "RED"
      strategyProfile = "AGGRESSIVE"
    }).agent
  $agent2 = (Invoke-JsonPost -Url "$baseUrl/api/agents" -Body @{
      name = "Smoke-B-$suffix"
      house = "BLUE"
      strategyProfile = "DEFENSIVE"
    }).agent

  if (-not $agent1.id -or -not $agent2.id) {
    throw "Agent creation failed."
  }

  $match = (Invoke-JsonPost -Url "$baseUrl/api/matches" -Body @{
      game = "RPS"
      stakeMode = "CREDITS"
      stakeAmount = 25
      series = "QUICK"
      creatorAgentId = $agent1.id
      opponentAgentId = $agent2.id
    }).match

  if (-not $match.id) {
    throw "Match creation failed."
  }
  if ($match.status -ne "ACTIVE") {
    throw "Expected ACTIVE match, got $($match.status)."
  }

  $maxTicks = 10
  $tick = 0
  $final = $null

  while ($tick -lt $maxTicks) {
    $tick += 1
    $null = Invoke-RestMethod -Uri "$baseUrl/api/matches/$($match.id)/tick" -Method Post -TimeoutSec 45
    $final = (Invoke-RestMethod -Uri "$baseUrl/api/matches/$($match.id)" -Method Get -TimeoutSec 15).match
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

  Write-Output "SMOKE_PHASE0_OK match=$($final.id) status=$($final.status) moves=$($final.moves.Count)"
  exit 0
} catch {
  Write-Error "SMOKE_PHASE0_FAILED: $($_.Exception.Message)"
  if (Test-Path $serverErr) {
    Write-Output "--- server stderr (tail) ---"
    Get-Content $serverErr -Tail 40
  }
  if (Test-Path $serverOut) {
    Write-Output "--- server stdout (tail) ---"
    Get-Content $serverOut -Tail 40
  }
  exit 1
} finally {
  if ($startedServer -and $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
