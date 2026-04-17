$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$baseUrl = "http://127.0.0.1:3000"
$headers = @{ "Content-Type" = "application/json" }
$startedServer = $false
$serverProcess = $null
$serverOut = Join-Path $root "smoke-credits.server.out.log"
$serverErr = Join-Path $root "smoke-credits.server.err.log"

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
  $agent = (Invoke-JsonPost -Url "$baseUrl/api/agents" -Body @{
      name = "Credits-Test-$suffix"
      house = "RED"
      strategyProfile = "CALCULATED"
    }).agent

  if (-not $agent.id) {
    throw "Agent creation failed."
  }
  Write-Output "SMOKE_CREDITS_CHECK agent_created=$($agent.id)"

  # Check initial balance (should be 1000 from starter grant)
  $state = Invoke-RestMethod -Uri "$baseUrl/api/agents/$($agent.id)/credits" -Method Get
  if ($state.credits -ne 1000) {
    throw "Expected 1000 starter credits, got $($state.credits)."
  }
  Write-Output "SMOKE_CREDITS_CHECK initial_balance=$($state.credits)"

  # Test debit
  $debit = (Invoke-JsonPost -Url "$baseUrl/api/agents/$($agent.id)/credits" -Body @{
      amount = -500
    })
  if ($debit.newBalance -ne 500) {
    throw "Expected 500 after -500 debit, got $($debit.newBalance)."
  }
  Write-Output "SMOKE_CREDITS_CHECK post_debit=$($debit.newBalance)"

  # Test credit
  $credit = (Invoke-JsonPost -Url "$baseUrl/api/agents/$($agent.id)/credits" -Body @{
      amount = 750
    })
  if ($credit.newBalance -ne 1250) {
    throw "Expected 1250 after +750 credit, got $($credit.newBalance)."
  }
  Write-Output "SMOKE_CREDITS_CHECK post_credit=$($credit.newBalance)"

  # Test insufficient credits guard
  try {
    $null = Invoke-JsonPost -Url "$baseUrl/api/agents/$($agent.id)/credits" -Body @{
        amount = -2000
      }
    throw "Expected 409 for insufficient credits, but it succeeded."
  } catch [System.Net.WebException] {
    $resp = $_.Exception.Response
    $stream = $resp.GetResponseStream()
    $reader = New-Object System.IO.StreamReader($stream)
    $errBody = $reader.ReadToEnd() | ConvertFrom-Json
    if ($resp.StatusCode.value__ -ne 409 -or $errBody.error -ne "INSUFFICIENT_CREDITS") {
      throw "Expected 409 INSUFFICIENT_CREDITS, got $($resp.StatusCode) $($errBody.error)."
    }
  }
  Write-Output "SMOKE_CREDITS_CHECK insufficient_credits_guard_ok"

  Write-Output "SMOKE_CREDITS_OK agent=$($agent.id)"
  exit 0
} catch {
  $message = if ($_.Exception -and $_.Exception.Message) { $_.Exception.Message } else { ($_ | Out-String).Trim() }
  Write-Error "SMOKE_CREDITS_FAILED: $message"
  exit 1
} finally {
  if ($startedServer -and $serverProcess -and -not $serverProcess.HasExited) {
    Stop-Process -Id $serverProcess.Id -Force
  }
}
