<#
.SYNOPSIS
    Registers a Windows scheduled task that refreshes the CA report data.

.DESCRIPTION
    Creates a daily scheduled task that runs Get-CAReport.ps1 under SYSTEM. The task
    refreshes the data.js consumed by the static web report in ..\web.

.PARAMETER TaskName
    Name of the scheduled task. Defaults to "CAcertReport-Refresh".

.PARAMETER At
    Time of day to run. Defaults to 03:00.

.PARAMETER DaysBack
    History window passed to Get-CAReport.ps1. Default 365.

.PARAMETER ConfigString
    Optional CA config string ("Server\CAName") forwarded to Get-CAReport.ps1.

.EXAMPLE
    .\Install-CAReport.ps1
#>
[CmdletBinding()]
param(
    [string] $TaskName     = 'CAcertReport-Refresh',
    [string] $At           = '03:00',
    [int]    $DaysBack     = 365,
    [string] $ConfigString
)

$ErrorActionPreference = 'Stop'

$scriptPath = (Resolve-Path (Join-Path $PSScriptRoot 'Get-CAReport.ps1')).Path

$argList = @(
    '-NoProfile',
    '-ExecutionPolicy', 'Bypass',
    '-File', "`"$scriptPath`"",
    '-DaysBack', $DaysBack
)
if ($ConfigString) {
    $argList += @('-ConfigString', "`"$ConfigString`"")
}

$action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument ($argList -join ' ')
$trigger   = New-ScheduledTaskTrigger -Daily -At $At
$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
$settings  = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries `
                -DontStopIfGoingOnBatteries -RunOnlyIfNetworkAvailable:$false

Register-ScheduledTask -TaskName $TaskName `
                       -Action $action `
                       -Trigger $trigger `
                       -Principal $principal `
                       -Settings $settings `
                       -Description 'Refreshes the CA certificate report data (data.js).' `
                       -Force | Out-Null

Write-Host "Scheduled task '$TaskName' registered. Running once now to populate data..."
Start-ScheduledTask -TaskName $TaskName

Write-Host "Done. Open ..\web\index.html in a browser to view the report."
