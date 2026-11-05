param(
    [string]$SdkPath = "",
    [string]$KeyPath = "",
    [string]$OutDir = ""
)
# Captura la watch-app en el simulador. Requiere que Windows haya permitido
# simulator.exe en el firewall la primera vez (es un permiso local, no un secreto).
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

& "$SdkPath\bin\monkeyc.bat" -d fr255 -f (Join-Path $root "monkey.jungle") -o (Join-Path $root "build\pulso-fr255.prg") -y $KeyPath
if ($LASTEXITCODE -ne 0) { throw "No compila" }

Stop-Process -Name simulator -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2
Start-Process -FilePath "$SdkPath\bin\simulator.exe" -ArgumentList "-d fr255" -WorkingDirectory "$SdkPath\bin"
Start-Sleep -Seconds 6
Start-Process -FilePath "$SdkPath\bin\monkeydo.bat" -ArgumentList (Join-Path $root "build\pulso-fr255.prg"), "fr255" -WorkingDirectory $root
Start-Sleep -Seconds 8

$code = @'
using System;
using System.Runtime.InteropServices;
using System.Drawing;
using System.Drawing.Imaging;
public class PULSOCapture {
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
$sim = Get-Process simulator | Select-Object -First 1
[PULSOCapture]::Save($sim.MainWindowHandle, (Join-Path $OutDir "simulador-01-entreno.png"))

$ws = New-Object -ComObject WScript.Shell
$ws.AppActivate($sim.Id) | Out-Null
Start-Sleep -Milliseconds 500
$ws.SendKeys("{ENTER}")
Start-Sleep -Seconds 1
[PULSOCapture]::Save($sim.MainWindowHandle, (Join-Path $OutDir "simulador-02-hecha.png"))
Write-Host "Capturas en $OutDir"
