# Connect IQ PoC — compatibilidad del reloj

Prueba de concepto que ejercita **solo** las APIs necesarias para la parte del reloj:

- acelerómetro de alta frecuencia (`Sensor.registerSensorDataListener`, 25 Hz),
- grabación de actividad de fuerza (`ActivityRecording` + `SPORT_TRAINING` +
  `SUB_SPORT_STRENGTH_TRAINING`),
- HTTP HTTPS por el móvil emparejado (`Communications.makeWebRequest`),
- almacenamiento local (`Application.Storage`, para la mano del reloj y la cola offline).

No usa `AccelerometerData.timestamp` (API **5.1.1**) para no dejar fuera relojes más antiguos:
el conteo de repeticiones usará índice de muestra y periodo, no timestamp.

## Compilar

Requisitos: Connect IQ SDK 8.3.0 (`current-sdk.cfg`) y una clave de desarrollador `.der` **local**
(nunca se commitea).

```powershell
# La ruta del SDK se lee de current-sdk.cfg si no se pasa -SdkPath.
.\build-matrix.ps1 -KeyPath C:\ruta\a\developer_key.der
```

Los `.prg` y `build/matrix.json` se generan en `build/` (ignorado por git).

## Resultado verificado (2026-11-04)

SDK 8.3.0, clave RSA generada en local. `minSdkVersion="3.3.0"`.

| Perfil | API level del dispositivo | Compila | Tamaño `.prg` |
|---|---|---:|---:|
| **fr255** (reloj de David) | 5.2 | **SÍ** | 94.492 B |
| fr255m | 5.2 | SÍ | 94.492 B |
| fr265 | 5.2 | SÍ | 100.572 B |
| fr965 | 5.2 | SÍ | 103.292 B |
| fenix7 | 5.2 | SÍ | 94.812 B |
| venu3 | 5.2 | SÍ | 104.092 B |
| fr245 | 3.3 | SÍ | 94.652 B |
| fenix6 | 3.4 | SÍ | 94.652 B |
| venu2 | 5.0 | SÍ | 104.092 B |

- **Mínimo común de APIs usadas**: `Sensor.AccelerometerData` desde **2.3.0**, `Communications` y
  `ActivityRecording` desde 1.0. La compilación se ha probado contra **API 3.3** (fr245) y superiores,
  que es el mínimo realista para estas APIs en los perfiles instalados. `minSdkVersion` se fija en
  **3.3.0**.
- **fr235 queda fuera**: su perfil es **API 1.4**, por debajo de 2.3 (no tiene
  `AccelerometerData`) y de 3.3. Si se quisiera cubrir, sería una app distinta sin sensor.
- Memoria de `watchApp` en fr255: **524.288 B** (la más pequeña de los objetivos); el `.prg` de
  94.492 B entra con margen.
- **No probado en un reloj real**. El camino principal (A) para llevar el entrenamiento al reloj **no
  necesita instalar esta app**: usa Garmin Connect (subir workout + push al dispositivo).

## API por perfil

Los perfiles instalados declaran su API en `compiler.json` (`deviceGroup`). fr255 soporta además
`AccelerometerData.timestamp` (5.1.1), pero la PoC no lo usa para mantener compatibilidad.
