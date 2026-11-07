# Prueba real del reloj — 2026-11-07

Sesión real contra Garmin Connect con la cuenta de David y el Forerunner 255. No se ha cerrado la
sesión ni se ha hecho logout.

## Estado de los pasos

| Paso | Estado | Evidencia |
|---|---|---|
| 1. Login Garmin Connect | **OK**, sin 2FA | `LOGIN_OK`; cuenta y dispositivo visibles |
| 2. Código de 6 dígitos | **No hizo falta** | Los tokens guardados fueron aceptados y refrescados |
| 3. Subir entreno del calendario | **OK** | `workoutId=1753715348`, `scheduled` para 2026-11-07 |
| 4. Enviar el workout al reloj | **OK, entregado** | `218604643433` salió `new`; el reloj sincronizó a las 11:38 y la cola quedó vacía |
| 5. Recuperar las series | **Pendiente** | No hay todavía una actividad de fuerza nueva en Garmin |

## Qué se hizo

- Se reutilizó la sesión guardada de Garmin y se actualizaron sus tokens en
  `backend/garmin_tokens/`.
- Se copiaron los tokens al directorio por usuario para que la API de Lyfta los use sin volver a
  pedir 2FA.
- Se creó la plantilla **Empuje A** (press de banca, curl, sentadilla) y el evento de hoy en el
  calendario real.
- `POST /api/v1/calendar/events/{id}/send` subió el workout a Garmin y lo programó para hoy.
- Se llamó a `push_workout_to_device` con el ID del Forerunner 255 para forzar el envío al reloj.

## Datos exactos

- Cuenta: `davidpeve01@gmail.com`.
- Dispositivo: `Forerunner 255`, id `3498989127`.
- Workout: `Empuje A`, id `1753715348`, `sportTypeId=5` (fuerza), duración estimada 1524 s.
- Programación: `calendarDate=2026-11-07`, `workoutScheduleId=1832673792`.
- Push al dispositivo: `messageId=218604643433`, `messageType=workouts`; entregado al sincronizar a las 11:38 (la cola de mensajes pasó de 4 a 0).
- Garmin confirma el evento en `get_scheduled_workouts(2026, 11)`.

## Importación preparada

En cuanto el reloj registre la actividad, la importación es **un solo comando**:

```powershell
.\\venv\\Scripts\\python.exe scripts\\import_latest_strength.py
```

El script:

1. reutiliza los tokens de David (sin volver a pedir 2FA);
2. busca la última actividad de fuerza de hoy en Garmin;
3. la importa con `POST /api/v1/strength/import-garmin/{activity_id}`;
4. muestra `sets_imported`, `unmapped` y la sesión creada; si ya estaba importada, informa
   `ALREADY_IMPORTED` sin duplicar.

Estado ahora: `NO_STRENGTH_ACTIVITY`; la actividad aún no ha llegado a Garmin.

## Diagnóstico: el reloj no ha sincronizado

Comprobado en Garmin (solo lecturas):

- **El workout está en la cuenta**: `get_workouts` devuelve `Empuje A` con `workoutId=1753715348` y
  `sportTypeKey=strength_training`.
- **Está programado**: `get_scheduled_workouts(2026, 11)` devuelve la ocurrencia
  `workoutScheduleId=1832673792`, fecha `2026-11-07`, `workoutId=1753715348`.
- **El dispositivo es el suyo**: `deviceId=3498989127`, `Forerunner 255`,
  `lastUsedDeviceApplicationKey=forerunner255Asia`. No hay otro reloj en la cuenta.
- **Entrega resuelta**: a las **11:38** el reloj sincronizó (`lastUsedDeviceUploadTime=1794047905000`)
  y la cola de mensajes pasó de **4 a 0**. El mensaje `218604643433` (`workouts`, `Empuje A`) quedó
  entregado, junto con el `schedules` y el workout de calendario.
- **Antes de sincronizar**: los cuatro mensajes estaban en `new` y la última subida del reloj era del
  **2026-11-06 22:26**; por eso no aparecía. El formato y el dispositivo siempre fueron correctos.

**Causa**: el reloj no había sincronizado desde antes del envío; no era el workout.

**Solución aplicada**: David sincronizó Garmin Connect. La cola quedó vacía y el reloj subió datos.
Abrir en el reloj **Entrenamiento → Entrenamientos** (o el calendario de hoy) y ejecutar **Empuje A**.

Si tras sincronizar sigue sin aparecer, no se toca de nuevo el workout: se revisa el estado de los
mensajes y, como alternativa, se usa el mismo `workoutId` desde Garmin Connect → Entrenamientos
para abrirlo en el reloj.

## Cambios de la especificación de David

- **Peso preestablecido**: el workout nativo lleva `weightValue` en gramos (80 kg → `80000`) en
  cada paso de ejercicio; la watch-app recibe además `targets` por serie y pinta el peso objetivo.
  El usuario no escribe pesos en el reloj.
- **Desde Lyfta**: la plantilla y el evento se crean en la app y el envío lo hace el backend por API;
  no hay que montar el entrenamiento a mano en Garmin Connect.
- **Detección automática**: `LyftaSensor` usa umbral relativo a la línea base, amplitud mínima,
  recorrido mínimo, refractario y cierre por inactividad (~1,9 s); al cerrar avisa a la vista, que
  guarda la serie y prepara la siguiente sin pulsar nada. No hay vibración.
- **Corrección posterior**: `GET/PUT /api/v1/strength/sessions/{id}` y la pantalla
  `/gimnasio/sesiones/:id` permiten cambiar peso y reps reales de cada serie después; recalculan
  volumen y marcas.

## Pendiente

El reloj todavía no ha registrado una actividad de fuerza nueva. Para cerrar el paso 5:

1. David abre el entreno **Empuje A** en el reloj.
2. Pulsa empezar y completa al menos una serie.
3. Sincroniza el reloj con Garmin Connect.
4. Ejecutar el comando de arriba.

**No se ha cerrado la sesión**: los tokens siguen guardados para no repetir el 2FA.
