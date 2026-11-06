param(
    [string]$SdkPath = "",
    [string]$KeyPath = "",
    [string]$OutDir = "",
    [string[]]$Devices = @("fr255", "fr245", "fenix6", "fr965", "venu3")
)
# Compila y captura la watch-app en el simulador para cada modelo.
# Requiere que Windows haya permitido simulator.exe en el firewall y que el
# simulador tenga la pantalla encendida; si la captura sale negra, no es la app.
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
if (-not $SdkPath) {
    $current = Get-Content "$env:APPDATA\Garmin\ConnectIQ\current-sdk.cfg" -Raw
    $SdkPath = (($current -split "`n") | Where-Object { $_.Trim() -like "current-sdk=*" }) -replace "^current-sdk=", ""
    $SdkPath = $SdkPath.Trim()
}
if (-not $KeyPath -or -not (Test-Path $KeyPath)) { throw "Falta la clave .der" }
if (-not $OutDir) { $OutDir = Join-Path $root "screenshots" }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
$build = Join-Path $root "build"
New-Item -ItemType Directory -Force -Path $build | Out-Null

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
public class CargaCapture {
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr d, uint f);
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L; public int T; public int R; public int B; }
 public static void Save(IntPtr h, string path) {
   RECT r; GetWindowRect(h, out r);
   using (Bitmap bmp = new Bitmap(r.R - r.L, r.B - r.T)) {
     using (Graphics g = Graphics.FromImage(bmp)) { IntPtr d = g.GetHdc(); PrintWindow(h, d, 2); g.ReleaseHdc(d); }
     bmp.Save(path, ImageFormat.Png);
   }
 }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

foreach ($device in $Devices) {
    $prg = Join-Path $build "carga-$device.prg"
    & "$SdkPath\bin\monkeyc.bat" -d $device -f (Join-Path $root "monkey.jungle") -o $prg -y $KeyPath
    if ($LASTEXITCODE -ne 0) { throw "No compila $device" }

    Stop-Process -Name simulator -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    Start-Process -FilePath "$SdkPath\bin\simulator.exe" -ArgumentList "-d", $device -WorkingDirectory "$SdkPath\bin"
    Start-Sleep -Seconds 5
    Start-Process -FilePath "$SdkPath\bin\monkeydo.bat" -ArgumentList $prg, $device -WorkingDirectory $root
    Start-Sleep -Seconds 5

    $sim = Get-Process simulator -ErrorAction Stop | Select-Object -First 1
    [CargaCapture]::Save($sim.MainWindowHandle, (Join-Path $OutDir "watch-$device.png"))
    Write-Host "captura: $device"
}
Write-Host "Capturas en $OutDir"
