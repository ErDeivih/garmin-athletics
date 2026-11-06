param(
    [string]$SdkPath = "",
    [string]$KeyPath = "",
    [string[]]$Devices = @("fr255", "fr245", "fenix6", "fr965", "venu3"),
    [string]$OutDir = ""
)
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $SdkPath) {
    $current = Get-Content "$env:APPDATA\Garmin\ConnectIQ\current-sdk.cfg" -Raw
    $SdkPath = (($current -split "`n") | Where-Object { $_.Trim() -like "current-sdk=*" }) -replace "^current-sdk=", ""
    $SdkPath = $SdkPath.Trim()
}
if (-not (Test-Path "$SdkPath\bin\monkeyc.bat")) { throw "No encuentro monkeyc en $SdkPath" }
if (-not $KeyPath -or -not (Test-Path $KeyPath)) { throw "Falta la clave de desarrollador (.der); no se commitea." }
if (-not $OutDir) { $OutDir = Join-Path $root "build" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$results = @()
foreach ($device in $Devices) {
    $output = Join-Path $OutDir "lyfta-$device.prg"
    $log = & "$SdkPath\bin\monkeyc.bat" -d $device -f (Join-Path $root "monkey.jungle") -o $output -y $KeyPath 2>&1
    $code = $LASTEXITCODE
    $size = if (Test-Path $output) { (Get-Item $output).Length } else { 0 }
    $results += [pscustomobject]@{
        device = $device
        compile = if ($code -eq 0) { "OK" } else { "FAIL" }
        exit = $code
        bytes = $size
        detail = if ($code -eq 0) { "" } else { ($log | Select-Object -Last 1) }
    }
    Write-Host "$device -> $($results[-1].compile) ($($results[-1].bytes) bytes)"
}
$results | ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $OutDir "matrix.json")
