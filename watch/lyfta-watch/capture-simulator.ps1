param(
    [string]$SdkPath = "",
    [string]$KeyPath = "",
    [string]$OutDir = "",
    [string[]]$Devices = @("fr255", "fr245", "fenix6", "fr965", "venu3")
)
# Compila y captura la watch-app en el simulador para cada modelo.
# No espera un tiempo fijo: considera que hay frame cuando PrintWindow funciona
# y la imagen tiene píxeles distintos de negro. Comprueba por separado el código
# de salida de monkeydo y el resultado de la captura.
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
public class LyftaCapture {
 [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
 [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr d, uint f);
 [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
 [StructLayout(LayoutKind.Sequential)] public struct RECT { public int L; public int T; public int R; public int B; }
 public static bool Save(IntPtr h, string path, out bool nonBlack) {
   nonBlack = false;
   RECT r;
   if (h == IntPtr.Zero || !GetWindowRect(h, out r) || r.R - r.L < 20 || r.B - r.T < 20) return false;
   SetForegroundWindow(h);
   using (Bitmap bmp = new Bitmap(r.R - r.L, r.B - r.T)) {
     using (Graphics g = Graphics.FromImage(bmp)) {
       IntPtr d = g.GetHdc();
       bool printed = PrintWindow(h, d, 2);
       g.ReleaseHdc(d);
       if (!printed) return false;
     }
     int samples = 0, dark = 0, light = 0;
     // La ventana incluye menu y marco gris; el frame real esta en el centro.
     for (int y = 110; y < bmp.Height - 25; y += 5) {
       for (int x = 25; x < bmp.Width - 25; x += 5) {
         Color c = bmp.GetPixel(x, y);
         samples++;
         if (c.R < 35 && c.G < 35 && c.B < 35) dark++;
         if (c.R > 215 && c.G > 215 && c.B > 215) light++;
       }
     }
     nonBlack = samples > 0 && dark > samples / 30 && light > samples / 80 && light > 20;
     bmp.Save(path, ImageFormat.Png);
     return nonBlack;
   }
 }
}
'@
Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing

$results = @()
foreach ($device in $Devices) {
    $prg = Join-Path $build "lyfta-$device.prg"
    & "$SdkPath\bin\monkeyc.bat" -d $device -f (Join-Path $root "monkey.jungle") -o $prg -y $KeyPath *> $null
    $compileExit = $LASTEXITCODE
    if ($compileExit -ne 0) {
        Write-Host "COMPILE_FAIL $device exit=$compileExit"
        $results += [pscustomobject]@{ device=$device; compile=$compileExit; monkeydo=$null; capture=$false; file=$null }
        continue
    }

    Stop-Process -Name simulator -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500
    $sim = Start-Process -FilePath "$SdkPath\bin\simulator.exe" -ArgumentList "-d", $device -WorkingDirectory "$SdkPath\bin" -PassThru
    $window = [IntPtr]::Zero
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 250
        $sim.Refresh()
        if ($sim.MainWindowHandle -ne [IntPtr]::Zero) {
            $window = $sim.MainWindowHandle
            break
        }
    }
    if ($window -eq [IntPtr]::Zero) {
        Write-Host "WINDOW_FAIL $device"
        $results += [pscustomobject]@{ device=$device; compile=$compileExit; monkeydo=$null; capture=$false; file=$null }
        continue
    }

    $monkey = Start-Process -FilePath "$SdkPath\bin\monkeydo.bat" -ArgumentList @($prg, $device) -WorkingDirectory $root -PassThru -WindowStyle Hidden
    $capturePath = Join-Path $OutDir "watch-$device.png"
    $captured = $false
    $nonBlack = $false
    for ($i = 0; $i -lt 80; $i++) {
        Start-Sleep -Milliseconds 500
        if ($window -eq [IntPtr]::Zero -or $window -eq $null) { break }
        $ok = [LyftaCapture]::Save($window, $capturePath, [ref]$nonBlack)
        if ($ok -and $nonBlack) {
            $captured = $true
            break
        }
        if ($monkey.HasExited) {
            # deja una última pasada por si el frame ya estaba pintado
            $ok = [LyftaCapture]::Save($window, $capturePath, [ref]$nonBlack)
            if ($ok -and $nonBlack) { $captured = $true }
            break
        }
    }
    $monkeyExit = if ($monkey.HasExited) { $monkey.ExitCode } else { "running" }
    if (-not $monkey.HasExited) { Stop-Process -Id $monkey.Id -Force -ErrorAction SilentlyContinue }
    Write-Host "CAPTURE $device capture=$captured nonBlack=$nonBlack monkeydo=$monkeyExit file=$capturePath"
    $results += [pscustomobject]@{ device=$device; compile=$compileExit; monkeydo=$monkeyExit; capture=$captured; file=$(if($captured){$capturePath}else{$null}) }
}
Stop-Process -Name simulator -Force -ErrorAction SilentlyContinue
$results | Format-Table -AutoSize
if (($results | Where-Object { -not $_.capture }).Count -gt 0) { exit 1 }
exit 0
