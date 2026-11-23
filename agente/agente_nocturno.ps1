# Nightly agent: runs Claude Code headless to produce N reels.
# Uso:  powershell -ExecutionPolicy Bypass -File agente\agente_nocturno.ps1 [-Videos 2]
param([int]$Videos = 2)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$hoy = Get-Date -Format "yyyy-MM-dd"
$logDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force $logDir | Out-Null
$log = Join-Path $logDir "$hoy.txt"

$env:TQDM_DISABLE = "1"
$env:HYPERFRAMES_TELEMETRY_DISABLED = "1"

$prompt = "Fecha de hoy: $hoy. N = $Videos. Lee agente/instrucciones.md y síguelo de principio a fin sin pedir confirmación."

# Tools the agent may use without asking. Everything else is denied in -p mode.
$allowed = @("Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Bash", "PowerShell")
# Hard stops even though Bash/PowerShell are allowed.
$denied = @(
  "Bash(git push:*)", "Bash(git commit:*)", "Bash(curl:*)", "Bash(wget:*)", "Bash(pip install:*)",
  "Bash(npm install:*)", "Bash(rm -rf:*)", "Bash(scp:*)", "Bash(ssh:*)",
  "PowerShell(Invoke-WebRequest:*)", "PowerShell(Invoke-RestMethod:*)", "PowerShell(git push:*)",
  # Edit(...) rules cover every file-writing tool (Write included)
  "Edit(voice/**)", "Edit(vendor/**)", "Edit(tts.py)", "Edit(CLAUDE.md)", "Edit(.claude/**)", "Edit(brand.json)"
)

"=== Agente $hoy $(Get-Date -Format HH:mm) | videos: $Videos ===" | Out-File $log -Encoding utf8 -Append
$inicio = Get-Date
# claude writes progress to stderr; keep it in the log instead of aborting the script
$ErrorActionPreference = "Continue"
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
& claude -p $prompt `
  --permission-mode acceptEdits `
  --allowedTools ($allowed -join ",") `
  --disallowedTools ($denied -join ",") `
  --output-format text 2>&1 | ForEach-Object { "$_" } | Out-File $log -Encoding utf8 -Append
$code = $LASTEXITCODE
$min = [math]::Round(((Get-Date) - $inicio).TotalMinutes, 1)
"=== Fin $(Get-Date -Format HH:mm) | $min min | código $code ===" | Out-File $log -Encoding utf8 -Append
exit $code
