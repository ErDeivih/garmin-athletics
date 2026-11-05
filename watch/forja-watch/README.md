# Forja Watch — app Connect IQ (T-32)

Watch-app propia de Forja para el Forerunner 255 y la gama compatible. **No es la app nativa de
Garmin**: muestra el entreno del día, permite marcar series y las manda al backend, con cola offline.
El diseño completo está en [DESIGN.md](DESIGN.md).

## Compilar

```powershell
# Lee el SDK de current-sdk.cfg; la clave .der es local y no se commitea.
.\build-matrix.ps1 -KeyPath C:\ruta\a\developer_key.der
```

Compilación verificada con SDK 8.3.0, `minSdkVersion 3.3.0`:

| Perfil | Compila | `.prg` |
|---|---:|---:|
| **fr255** (David) | **SÍ** | 104.892 B |
| fr245 (API 3.3) | SÍ | 106.092 B |
| fenix6 (3.4) | SÍ | 106.092 B |
| fr965 (5.2) | SÍ | 113.692 B |
| venu3 (5.2) | SÍ | 114.492 B |

`monkeydo` solo ejecuta en el simulador; instalar en el reloj real es Nivel 3 (clave/reloj de David).

## Simulador

1. Abrir `simulator.exe` y elegir Forerunner 255.
2. `monkeydo build\forja-fr255.prg fr255`.
3. Sin `apiUrl`/`token` configurados, la app usa una rutina de demostración para revisar las
   pantallas. Con ambos configurados en los ajustes de la app desde Garmin Connect, pide el entreno
   de hoy al backend.

**Nota de esta máquina**: el simulador pide permiso de firewall al arrancar; sin pulsar «Permitir»
`monkeydo` no puede conectar y la pantalla queda negra. Es un permiso local de Windows, no un fallo de
la app. Las capturas del simulador quedan pendientes de ese permiso.

## API que usa

- `GET /api/v1/watch/today` — entreno de hoy (calendario o plantilla del día).
- `POST /api/v1/watch/sets` — serie hecha, idempotente por `client_set_id`.

Los endpoints están en `backend/app/api/v1/watch.py` y probados con `tests/test_watch_api.py`.

## Privacidad y textos

El reloj solo muestra «FORJA», el nombre del entreno, el ejercicio, la serie, el peso, las reps y
«OK hecha / ABAJO siguiente / ATRÁS salir». No hay tokens, URLs ni detalles técnicos en pantalla.
