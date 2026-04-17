$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$baseUrl = "http://127.0.0.1:3000"
$headers = @{ "Content-Type" = "application/json" }
$startedServer = $false
$serverProcess = $null
$serverOut = Join-Path $root "smoke-cancel.server.out.log"
$serverErr = Join-Path $root "smoke-cancel.server.err.log"

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
  
  # Step 1: Create Agents
  Write-Output "Creating agents..."
  $agentA = (Invoke-JsonPost -Url "$baseUrl/api/agents" -Body @{
      name = "Cancel-A-$suffix"
      house = "RED"
      strategyProfile = "CALCULATED"
    }).agent
  $agentB = (Invoke-JsonPost -Url "$baseUrl/api/agents" -Body @{
      name = "Cancel-B-$suffix"
      house = "BLUE"
      strategyProfile = "ADAPTIVE"
    }).agent

  # Starter credits are 1000
  $initialCredits = 1000
  $stake = 50

  # Step 2: Create and Join Match
  Write-Output "Creating match..."
  $match = (Invoke-JsonPost -Url "$baseUrl/api/matches" -Body @{
      game = "RPS"
      stakeMode = "CREDITS"
      stakeAmount = $stake
      series = "QUICK"
      creatorAgentId = $agentA.id
    }).match

  Write-Output "Joining match..."
  $joined = (Invoke-JsonPost -Url "$baseUrl/api/matches/$($match.id)/join" -Body @{
      opponentAgentId = $agentB.id
    }).match

  if ($joined.status -ne "ACTIVE") {
    throw "Expected ACTIVE match, got $($joined.status)."
  }

  # Step 3: Verify Credits are Locked
  Write-Output "Verifying credits are locked..."
  $agentA_locked = (Invoke-RestMethod -Uri "$baseUrl/api/agents/$($agentA.id)" -Method Get).agent
  $agentB_locked = (Invoke-RestMethod -Uri "$baseUrl/api/agents/$($agentB.id)" -Method Get).agent

  if ($agentA_locked.credits -ne ($initialCredits - $stake)) {
    throw "Agent A credits not debited correctly. Expected $($initialCredits - $stake), got $($agentA_locked.credits)."
  }
  if ($agentA_locked.lockedCredits -ne $stake) {
    throw "Agent A lockedCredits not incremented. Expected $stake, got $($agentA_locked.lockedCredits)."
  }
  if ($agentB_locked.credits -ne ($initialCredits - $stake)) {
    throw "Agent B credits not debited correctly. Expected $($initialCredits - $stake), got $($agentB_locked.credits)."
  }
  if ($agentB_locked.lockedCredits -ne $stake) {
    throw "Agent B lockedCredits not incremented. Expected $stake, got $($agentB_locked.lockedCredits)."
  }

  # Step 4: Cancel Match
  Write-Output "Cancelling match..."
  $cancelled = (Invoke-JsonPost -Url "$baseUrl/api/matches/$($match.id)/cancel" -Body @{}).match

  if ($cancelled.status -ne "CANCELLED") {
    throw "Expected CANCELLED status, got $($cancelled.status)."
  }

  # Step 5: Verify Credits are Refunded
  Write-Output "Verifying credits are refunded..."
  $agentA_final = (Invoke-RestMethod -Uri "$baseUrl/api/agents/$($agentA.id)" -Method Get).agent
  $agentB_final = (Invoke-RestMethod -Uri "$baseUrl/api/agents/$($agentB.id)" -Method Get).agent

  if ($agentA_final.credits -ne $initialCredits) {
    throw "Agent A credits not refunded. Expected $initialCredits, got $($agentA_final.credits)."
  }
  if ($agentA_final.lockedCredits -ne 0) {
    throw "Agent A lockedCredits not cleared. Expected 0, got $($agentA_final.lockedCredits)."
  }
  if ($agentB_final.credits -ne $initialCredits) {
    throw "Agent B credits not refunded. Expected $initialCredits, got $($agentB_final.credits)."
  }
  if ($agentB_final.lockedCredits -ne 0) {
    throw "Agent B lockedCredits not cleared. Expected 0, got $($agentB_final.lockedCredits)."
  }

  Write-Output "SMOKE_CANCEL_OK match=$($match.id) refunded_credits=$stake"
  exit 0
} catch {
  $message = if ($_.Exception -and $_.Exception.Message) { $_.Exception.Message } else { ($_ | Out-String).Trim() }
  Write-Error "SMOKE_CANCEL_FAILED: $message"
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
