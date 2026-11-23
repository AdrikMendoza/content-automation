# Registers the daily Windows task that runs the nightly agent (wakes the PC from sleep).
# Instalar:     powershell -ExecutionPolicy Bypass -File agente\instalar_tarea.ps1 [-Hora 01:00] [-Videos 2]
# Desinstalar:  Unregister-ScheduledTask -TaskName "content-automation agente" -Confirm:$false
param([string]$Hora = "01:00", [int]$Videos = 2)

$script = Join-Path $PSScriptRoot "agente_nocturno.ps1"
$accion = New-ScheduledTaskAction -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$script`" -Videos $Videos"
$disparo = New-ScheduledTaskTrigger -Daily -At $Hora
$ajustes = New-ScheduledTaskSettingsSet -WakeToRun -StartWhenAvailable -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 5) -MultipleInstances IgnoreNew
# Runs as the logged-in user (needs Claude's login and the GPU); the PC can be asleep, not signed out or off.
$quien = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName "content-automation agente" -Action $accion -Trigger $disparo -Settings $ajustes `
  -Principal $quien -Description "Hace $Videos reels cada noche (agente\instrucciones.md)" -Force | Out-Null
Write-Host "Listo: el agente corre todos los días a las $Hora con $Videos videos."
Write-Host "Para que despierte la PC: Opciones de energía > Permitir temporizadores de reactivación = Habilitar."
