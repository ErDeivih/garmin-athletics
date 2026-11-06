# Lyfta Watch — app Connect IQ (T-32)

Watch-app propia de Lyfta para el Forerunner 255 y la gama compatible. **No es la app nativa de
Garmin**: recibe el entreno del día, detecta el movimiento de cada serie, estima la fuerza y manda
las series al backend, con cola offline. El diseño completo está en [DESIGN.md](DESIGN.md).

## Compilar

```powershell
# Lee el SDK de current-sdk.cfg; la clave .der es local y no se commitea.
.\build-matrix.ps1 -KeyPath C:\ruta\a\developer_key.der
```

Compilación verificada con SDK 8.3.0, `minSdkVersion 3.3.0`:

| Perfil | Compila | `.prg` |
|---|---:|---:|
| **fr255** (David) | **SÍ** | 108.716 B |
| fr245 (API 3.3) | SÍ | 110.268 B |
| fenix6 (3.4) | SÍ | 110.268 B |
| fr965 (5.2) | SÍ | 117.516 B |
| venu3 (5.2) | SÍ | 118.316 B |

`monkeydo` solo ejecuta en el simulador; instalar en el reloj real es Nivel 3 (clave/reloj de David).

## Simulador y capturas

1. Abrir `simulator.exe` y elegir el modelo.
2. `monkeydo build\lyfta-<modelo>.prg <modelo>`.
3. Sin `apiUrl`/`token` configurados, la app usa una rutina de demostración para revisar las
   pantallas. Con ambos configurados en los ajustes de la app desde Garmin Connect, pide el entreno
   de hoy al backend.

**Paso exacto de firewall**: al arrancar `simulator.exe`, Windows Defender muestra
«¿Quieres permitir que las redes públicas y privadas accedan a esta aplicación?» con dos botones.
Hay que pulsar **Permitir** una vez (no «Cancelar»). No hace falta ser administrador ni desactivar el
firewall. Sin ese clic, `monkeydo` no conecta con el simulador y la pantalla queda negra; no es un
fallo de la app.

Después:

```powershell
.\capture-simulator.ps1 -KeyPath C:\ruta\a\developer_key.der
```

Compila y captura los cinco modelos (`fr255`, `fr245`, `fenix6`, `fr965`, `venu3`) en
`screenshots/watch-<modelo>.png`. Si la pantalla del simulador está apagada, la captura sale negra:
no es la app; hay que encenderla con el botón **LIGHT** o el menú del simulador.

## API que usa

- `GET /api/v1/watch/today` — entreno de hoy (calendario o plantilla del día).
- `POST /api/v1/watch/sets` — serie hecha, idempotente por `client_set_id`; incluye reps detectadas,
  velocidad y fuerza estimada.

Los endpoints están en `backend/app/api/v1/watch.py` y probados con `tests/test_watch_api.py`.

## Privacidad y textos

El reloj solo muestra «Lyfta», el nombre del entreno, el ejercicio, la serie, «Peso», «Objetivo ×
reps», «Reps detectadas», velocidad, fuerza estimada y «OK serie · ABAJO ejercicio / ATRÁS salir».
No hay tokens, URLs ni detalles técnicos en pantalla.
