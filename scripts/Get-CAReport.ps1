<#
.SYNOPSIS
    Collects certificate issuance and request data from a Windows Certification Authority.

.DESCRIPTION
    Queries the CA database via certutil.exe and writes data.js, which is loaded by the
    static web report (../web/index.html). The script is intended to be run as a scheduled
    task on the CA server (or any host configured to reach the CA).

.PARAMETER OutputPath
    Folder where data.js is written. Defaults to ..\web\data relative to this script.

.PARAMETER DaysBack
    How many days of history to include. Default: 365.

.PARAMETER ConfigString
    Optional CA configuration string in the form "ServerFqdn\CAName". When omitted,
    certutil targets the locally installed CA.

.EXAMPLE
    .\Get-CAReport.ps1
    Runs against the local CA and writes ..\web\data\data.js.

.EXAMPLE
    .\Get-CAReport.ps1 -ConfigString "ca01.contoso.com\Contoso Issuing CA" -DaysBack 90
#>
[CmdletBinding()]
param(
    [string]$OutputPath,
    [int]$DaysBack = 365,
    [string]$ConfigString
)

$ErrorActionPreference = 'Stop'

if (-not $OutputPath) {
    $OutputPath = Join-Path $PSScriptRoot '..\web\data'
}
$OutputPath = [IO.Path]::GetFullPath($OutputPath)
if (-not (Test-Path $OutputPath)) {
    New-Item -ItemType Directory -Path $OutputPath -Force | Out-Null
}

$sinceDate = (Get-Date).AddDays(-[Math]::Abs($DaysBack))
$sinceStr  = $sinceDate.ToString('MM/dd/yyyy')

# certutil writes localized strings (e.g. dates) using the console code page.
# Force UTF-8 so non-ASCII names (RequesterName, CommonName) survive the round trip.
$prevOutEnc = [Console]::OutputEncoding
[Console]::OutputEncoding = [Text.Encoding]::UTF8

function Invoke-CertView {
    param(
        [Parameter(Mandatory)] [string] $Restrict,
        [Parameter(Mandatory)] [string] $Columns
    )

    $cuArgs = @('-view')
    if ($ConfigString) { $cuArgs += @('-config', $ConfigString) }
    $cuArgs += @('-restrict', $Restrict, '-out', $Columns, 'csv')

    Write-Verbose ("certutil {0}" -f ($cuArgs -join ' '))
    $raw = & certutil @cuArgs 2>&1
    $exit = $LASTEXITCODE

    # certutil emits a trailing status line; strip it and any error/info lines.
    $lines = @($raw) | ForEach-Object { "$_" } | Where-Object {
        $_ -and ($_ -notmatch '^CertUtil:') -and ($_ -notmatch '^\s*$')
    }

    if ($exit -ne 0 -and $lines.Count -lt 2) {
        Write-Warning "certutil returned exit code $exit for restrict '$Restrict'."
        return @()
    }

    if ($lines.Count -lt 2) { return @() }

    try {
        return $lines | ConvertFrom-Csv
    }
    catch {
        Write-Warning "Failed to parse certutil CSV: $($_.Exception.Message)"
        return @()
    }
}

function ConvertTo-IsoDate {
    param([string]$Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $dt = $null
    if ([DateTime]::TryParse($Value, [Globalization.CultureInfo]::InvariantCulture,
            [Globalization.DateTimeStyles]::AssumeLocal, [ref]$dt)) {
        return $dt.ToUniversalTime().ToString('o')
    }
    if ([DateTime]::TryParse($Value, [Globalization.CultureInfo]::CurrentCulture,
            [Globalization.DateTimeStyles]::AssumeLocal, [ref]$dt)) {
        return $dt.ToUniversalTime().ToString('o')
    }
    return $Value
}

function Get-PropertyValue {
    param($Row, [string[]]$Names)
    foreach ($n in $Names) {
        if ($Row.PSObject.Properties.Name -contains $n) {
            $v = $Row.$n
            if ($null -ne $v -and "$v".Trim() -ne '') { return "$v" }
        }
    }
    return $null
}

try {
    $issuedCols  = 'RequestID,Request.RequesterName,CommonName,NotBefore,NotAfter,SerialNumber,CertificateTemplate,Request.SubmittedWhen,Request.Disposition,Request.DispositionMessage'
    $issuedRows  = Invoke-CertView -Restrict "NotBefore>=$sinceStr,Disposition=20" -Columns $issuedCols

    $failedCols  = 'RequestID,Request.RequesterName,CommonName,Request.SubmittedWhen,CertificateTemplate,Request.Disposition,Request.DispositionMessage,Request.StatusCode'
    $failedRows  = Invoke-CertView -Restrict "Request.SubmittedWhen>=$sinceStr,Disposition>=30" -Columns $failedCols

    $issued = foreach ($r in $issuedRows) {
        [pscustomobject]@{
            RequestID     = Get-PropertyValue $r 'Request ID','RequestID','Issued Request ID'
            Requester     = Get-PropertyValue $r 'Requester Name','Request.RequesterName','RequesterName'
            CommonName    = Get-PropertyValue $r 'Issued Common Name','CommonName','Common Name'
            Template      = Get-PropertyValue $r 'Certificate Template','CertificateTemplate'
            SerialNumber  = Get-PropertyValue $r 'Serial Number','SerialNumber'
            NotBefore     = ConvertTo-IsoDate (Get-PropertyValue $r 'Certificate Effective Date','NotBefore')
            NotAfter      = ConvertTo-IsoDate (Get-PropertyValue $r 'Certificate Expiration Date','NotAfter')
            SubmittedWhen = ConvertTo-IsoDate (Get-PropertyValue $r 'Request Submission Date','Request.SubmittedWhen','SubmittedWhen')
            Disposition   = Get-PropertyValue $r 'Request Disposition','Request.Disposition','Disposition'
            Status        = Get-PropertyValue $r 'Request Disposition Message','Request.DispositionMessage','DispositionMessage'
        }
    }

    $failed = foreach ($r in $failedRows) {
        [pscustomobject]@{
            RequestID     = Get-PropertyValue $r 'Request ID','RequestID'
            Requester     = Get-PropertyValue $r 'Requester Name','Request.RequesterName','RequesterName'
            CommonName    = Get-PropertyValue $r 'Common Name','CommonName'
            Template      = Get-PropertyValue $r 'Certificate Template','CertificateTemplate'
            SubmittedWhen = ConvertTo-IsoDate (Get-PropertyValue $r 'Request Submission Date','Request.SubmittedWhen','SubmittedWhen')
            Disposition   = Get-PropertyValue $r 'Request Disposition','Request.Disposition','Disposition'
            Status        = Get-PropertyValue $r 'Request Disposition Message','Request.DispositionMessage','DispositionMessage'
            StatusCode    = Get-PropertyValue $r 'Request Status Code','Request.StatusCode','StatusCode'
        }
    }

    $payload = [ordered]@{
        generatedAt = (Get-Date).ToUniversalTime().ToString('o')
        windowDays  = $DaysBack
        windowStart = $sinceDate.ToUniversalTime().ToString('o')
        caConfig    = if ($ConfigString) { $ConfigString } else { "$env:COMPUTERNAME (local CA)" }
        issued      = @($issued)
        failed      = @($failed)
    }

    $json   = $payload | ConvertTo-Json -Depth 6 -Compress:$false
    $jsFile = Join-Path $OutputPath 'data.js'
    $header = "// Generated by Get-CAReport.ps1 on $((Get-Date).ToString('s'))`r`n// Do not edit by hand.`r`n"
    $body   = "window.CERT_DATA = $json;`r`n"

    [IO.File]::WriteAllText($jsFile, $header + $body, [Text.UTF8Encoding]::new($false))

    # Also drop a plain JSON copy for ad-hoc consumers.
    $jsonFile = Join-Path $OutputPath 'data.json'
    [IO.File]::WriteAllText($jsonFile, $json, [Text.UTF8Encoding]::new($false))

    Write-Host ("Wrote {0} issued, {1} failed/denied records to {2}" -f $issued.Count, $failed.Count, $jsFile)
}
finally {
    [Console]::OutputEncoding = $prevOutEnc
}
