<#
.SYNOPSIS
  Construye la imagen de Lyfta en este PC y la deja corriendo en el servidor.

.DESCRIPTION
  El servidor de casa no resuelve nombres (su /etc/resolv.conf apunta a los DNS
  de Tailscale, que no contestan), así que `docker compose build` allí no puede
  bajar la base de Python ni las dependencias. Aquí se construye, se envía
  comprimida y se carga con `docker load`. Mismo resultado, sin tocar el DNS del
  servidor.

  Uso:
    .\deploy\ship-image.ps1
    .\deploy\ship-image.ps1 -Server servidor-ts     # por el tailnet, desde fuera
    .\deploy\ship-image.ps1 -SkipBuild              # reenviar la imagen ya construida
#>
param(
  [string]$Server = 'servidor',
  [string]$Tag = 'lyfta:local',
  [switch]$SkipBuild
)

# Los comandos nativos (docker, scp, ssh) escriben su progreso por stderr; en
# PowerShell 5.1 eso se convierte en error terminante si está en 'Stop'. Aquí se
# deja pasar y el fallo se decide por el código de salida, que es lo fiable.
$ErrorActionPreference = 'Continue'
$raiz = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Push-Location $raiz
try {
  if (-not $SkipBuild) {
    Write-Host '==> Construyendo imagen (Vite + FastAPI)...' -ForegroundColor Cyan
    docker build -f deploy/Dockerfile -t $Tag .
    if ($LASTEXITCODE -ne 0) { throw "docker build falló ($LASTEXITCODE)" }
  }

  $tar = Join-Path $env:TEMP 'lyfta-image.tar'
  $gz = "$tar.gz"
  Write-Host '==> Empaquetando imagen...' -ForegroundColor Cyan
  if (Test-Path $tar) { Remove-Item -Force $tar }
  docker save -o $tar $Tag
  if ($LASTEXITCODE -ne 0) { throw "docker save falló ($LASTEXITCODE)" }

  Write-Host '==> Comprimiendo...' -ForegroundColor Cyan
  if (Test-Path $gz) { Remove-Item -Force $gz }
  $entrada = [System.IO.File]::OpenRead($tar)
  $salida = [System.IO.File]::Create($gz)
  $zipper = New-Object System.IO.Compression.GZipStream($salida, [System.IO.Compression.CompressionMode]::Compress)
  try { $entrada.CopyTo($zipper) } finally { $zipper.Dispose(); $salida.Dispose(); $entrada.Dispose() }
  Remove-Item -Force $tar
  Write-Host ("    {0:N0} MB comprimidos" -f ((Get-Item $gz).Length / 1MB)) -ForegroundColor DarkGray

  Write-Host "==> Enviando a $Server ..." -ForegroundColor Cyan
  scp $gz "${Server}:~/lyfta-image.tar.gz"
  if ($LASTEXITCODE -ne 0) { throw "scp falló ($LASTEXITCODE)" }

  Write-Host '==> Cargando y reiniciando el contenedor...' -ForegroundColor Cyan
  ssh $Server "docker load -i ~/lyfta-image.tar.gz && rm -f ~/lyfta-image.tar.gz && cd ~/lyfta/deploy && docker compose up -d --no-build && docker compose ps --format 'table {{.Name}} {{.Status}} {{.Ports}}'"
  if ($LASTEXITCODE -ne 0) { throw "el despliegue remoto falló ($LASTEXITCODE)" }

  Write-Host '==> Comprobando salud (hasta 30 s)...' -ForegroundColor Cyan
  $salud = ''
  for ($intento = 1; $intento -le 15; $intento++) {
    Start-Sleep -Seconds 2
    $salud = ssh $Server "curl -s -m 4 http://100.117.58.93:8010/healthz"
    if ($salud -match 'ok') { break }
  }
  if ($salud -notmatch 'ok') { throw "healthz no responde: '$salud'" }
  Write-Host '    /healthz OK' -ForegroundColor Green

  ssh $Server "~/lyfta/deploy/verify-server.sh"
  if ($LASTEXITCODE -ne 0) { throw "la verificación del servidor falló ($LASTEXITCODE)" }

  if (Test-Path $gz) { Remove-Item -Force $gz }
  Write-Host '==> Desplegado.' -ForegroundColor Green
  Write-Host '    Móvil: http://100.117.58.93:8010'
} finally {
  Pop-Location
}
