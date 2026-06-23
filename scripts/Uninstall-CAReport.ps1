<#
.SYNOPSIS
    Removes the CAcertReport scheduled task.
#>
[CmdletBinding()]
param(
    [string]$TaskName = 'CAcertReport-Refresh'
)

$ErrorActionPreference = 'Stop'

$task = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $task) {
    Write-Host "Scheduled task '$TaskName' not found."
    return
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "Scheduled task '$TaskName' removed."
