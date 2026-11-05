# Guion de prueba con el reloj real (fr255)

El día que David pueda dar el 2FA y el reloj, esta es la única lista que hay que seguir. No promete
que funcione: comprueba y deja evidencia. El 2FA lo introduce David; el agente no lo pide ni lo
guarda.

## Checklist de una pasada

| # | Acción | Debe verse | Si falla |
|---|---|---|---|
| 1 | Backend con la cuenta real y **Ajustes → Vincular cuenta** (correo, contraseña, 2FA) | «Vinculado» | Apuntar el mensaje, sin contraseña ni código |
| 2 | **Gimnasio → Preparar envío → Enviar al reloj** | «Enviado. Compruébalo en el reloj.» | Apuntar el `detail` del backend |
| 3 | Abrir el entreno en el reloj y pulsar **Empezar** | Ejercicios, series, peso y repeticiones | Captura del reloj y qué pantalla falta |
| 4 | **Calendario → Programar entrenamiento** (hoy) → **Cargar el de hoy en el reloj** | «Entreno de hoy cargado en el reloj.» | Apuntar `sent` y el error |
| 5 | Repetir el paso 4 el mismo día | «No hay entrenamientos para hoy» o `sent: 0` | Comprobar que no hay dos entrenos |
| 6 | Terminar una serie en el reloj y sincronizar | La actividad aparece en la app | Hora, modelo y captura |
| 7 | Importar la actividad: `POST /strength/import-garmin/{id}` | `sets_imported > 0` | Apuntar `unmapped` y el `id` |
| 8 | **Catálogo → Configurar detección** y activar un perfil | «Detección activada.» | Revisar los valores y el 422 |
| 9 | POC IMU con la watch-app (cuando exista) | Conteo por serie | Ver Prueba D |

## Antes de empezar

- Backend levantado contra la **cuenta real** de David (no la copia), con sus tokens.
- Reloj **Forerunner 255** cargado y emparejado con Garmin Connect; abrir la app de Garmin Connect
  una vez.
- Una plantilla con 2–3 ejercicios, series, pesos, reps y descansos reales.
- Una actividad con GPS ya sincronizada, para comprobar el detalle y las vueltas.
- El guion no necesita GitHub Actions ni instalar nada en el reloj para A–C.

## Prueba A — Enviar un entrenamiento al reloj (T-31)

1. **Ajustes → Vincular cuenta**. Correo, contraseña y código 2FA. Debe quedar «Vinculado».
2. **Gimnasio → Enviar al reloj → Preparar envío**.
   Debe verse `N ejercicios · ~N min` y ningún aviso de «No se pueden enviar».
3. Marcar «Lo revisaré en el reloj» y pulsar **Enviar al reloj**.
4. **Backend**: `status: sent`, `workoutId` y `pushed_to_device`; ni 502 ni 400.
5. **Reloj**: el entreno en el calendario de hoy, con ejercicios, series, peso y repeticiones. Si no
   aparece, apuntar qué muestra exactamente.
6. Pulsar **Empezar** y completar una serie. Debe registrarse en el reloj y en Garmin Connect.

**Si falla**: anotar el `detail` (sin secretos), la hora y el modelo. No reintentar en bucle: un
envío repetido puede duplicar el entreno.

## Prueba B — Calendario y auto-carga (T-42)

1. **Calendario → Programar entrenamiento**: elegir plantilla, hoy y la hora. Debe aparecer en
   «Tus entrenamientos semanales».
2. **Cargar el de hoy en el reloj**. Debe devolver `sent: 1`.
3. Alternativa automática: esperar al job de las **06:30** o ejecutar
   `POST /api/v1/calendar/sync-today` con el token.
4. **Reloj**: el entreno de hoy debe estar en el calendario y abrirse como en A.
5. Ejecutarlo otra vez el mismo día: `sent: 0`, sin duplicar (idempotencia).

## Prueba C — Importar las series reales (T-30)

1. Terminar una actividad de fuerza en el reloj.
2. Sincronizar en Garmin Connect y esperar a que aparezca.
3. Llamar `POST /api/v1/strength/import-garmin/{activity_id}` con el token.
4. **Debe volver**: `sets_imported > 0`, `unmapped` vacío si todo está en el catálogo y la sesión en
   el historial con peso/reps.
5. Repetir: `409 already_imported`, sin duplicar.

## Prueba D — Patrón IMU por ejercicio (T-43, POC)

1. En la app: **Catálogo → Configurar detección** en 3 ejercicios de brazo (curl, press militar,
   elevación lateral). Ajustar duración de repetición y sensibilidad, y **Guardar y activar**.
2. Con la watch-app de calibración (IMU-5/IMU-6, pendiente): grabar 15 s y subir las muestras a
   `POST /strength/exercises/{id}/motion-profile/calibrate`.
3. Hacer 5 series de 8–12 reps etiquetadas a mano y comparar con el detector.
4. **Criterio**: ≥90 % de series con error ≤1 rep y ≥90 % de series detectadas. Si no, el conteo
   automático se queda fuera y se mantiene el marcado manual.

## Evidencia que hay que dejar

| Prueba | Qué apuntar | Dónde |
|---|---|---|
| A | `workoutId`, captura del reloj, captura del entreno en Garmin Connect | `ESTADO-AGENTE.md` + captura |
| B | `sent` y comportamiento del calendario | `ESTADO-AGENTE.md` |
| C | `activity_id`, `sets_imported`, `unmapped` | `ESTADO-AGENTE.md` |
| D | error por serie, % detectadas | `research/IMU-CALENDARIO.md` §10.3 |

Hasta que A–C estén hechas, T-30/T-31/T-42 siguen **en curso**, no cerradas.

## Ya preparado (2026-11-05)

- **Editor IMU**: Catálogo → Configurar detección. Perfil versionado, activar/desactivar y
  calibración en seco; falta la captura guiada desde el reloj.
- **Calendario y auto-carga** a las 06:30 implementados y probados con dobles.
- **Actividades**: filtros por deporte/texto, vueltas y detalle completo con gráficas.
- **Envío e importación**: endpoints y UI listos; solo falta la cuenta real.
