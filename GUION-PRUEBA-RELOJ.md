# Guion de prueba con el reloj real (fr255)

Para el día que David pueda dar el 2FA y el reloj. El objetivo es que esa sesión sea **un solo
paso**: seguir esta lista, apuntar lo que se ve y decidir. No promete que funcione: comprueba.

## Antes de empezar

- Backend levantado contra la **cuenta real** de David (no la copia), con `garmin_tokens` de su
  usuario.
- Reloj **Forerunner 255** cargado, emparejado con la cuenta de Garmin Connect y con la app de
  Garmin Connect abierta al menos una vez.
- Una plantilla de gimnasio con 2–3 ejercicios y series/pesos/reps reales.
- 2FA a mano: el código lo introduce David; el agente no lo pide ni lo guarda.

## Prueba A — Enviar un entrenamiento al reloj (T-31)

1. En la app: **Ajustes → Vincular cuenta**. Introducir correo, contraseña y el código 2FA.
   Debe quedar «Vinculado».
2. **Gimnasio → Enviar al reloj → Preparar envío**.
   Debe verse `N ejercicios · ~N min` y ningún aviso de «No se pueden enviar».
3. Marcar «Lo revisaré en el reloj» y pulsar **Enviar al reloj**.
4. **Qué debe volver al backend**: respuesta `status: sent`, un `workoutId` de Garmin y
   `pushed_to_device`. En los logs, ni `502` ni `400`.
5. **Qué debe verse en el reloj**: el entrenamiento en el calendario de Garmin Connect para hoy;
   al abrirlo, los ejercicios, series, peso y repeticiones. Si el reloj no lo muestra, apuntar
   exactamente qué muestra (lista vacía, entreno sin nombre, error) y en qué pantalla.
6. Pulsar **Empezar** en el reloj y completar una serie. Debe quedar registrada en el reloj y
   aparecer en Garmin Connect.

**Si falla**: anotar el `detail` del backend (sin contraseña), la hora y el modelo. No reintentar
en bucle: un envío repetido puede duplicar el entreno.

## Prueba B — Calendario y auto-carga (T-42)

1. **Calendario → Programar entrenamiento**: elegir la plantilla, el día de hoy y la hora.
   Debe aparecer en «Tus entrenamientos semanales».
2. **Cargar el de hoy en el reloj**. Debe devolver `sent: 1`.
3. Alternativa automática: esperar al job de las 06:30 o ejecutar el endpoint
   `POST /api/v1/calendar/sync-today` con el token de David.
4. **En el reloj**: el entreno de hoy debe estar en el calendario y abrirse como en la Prueba A.
5. Ejecutarlo de nuevo el mismo día: debe responder `sent: 0` y **no duplicar** (idempotencia).

## Prueba C — Importar las series reales (T-30)

1. Terminar una actividad de fuerza en el reloj (puede ser la de la Prueba A).
2. Sincronizar en Garmin Connect y esperar a que aparezca la actividad.
3. Llamar `POST /api/v1/strength/import-garmin/{activity_id}` con el token.
4. **Qué debe volver**: `sets_imported > 0`, `unmapped` vacío si todos los ejercicios están en el
   catálogo; la sesión en el historial con peso/reps.
5. Repetir la llamada: debe responder `409 already_imported`, sin duplicar.

## Prueba D — Patrón IMU por ejercicio (T-43, solo diseño/POC)

No hay watch-app instalada todavía. Para el día del reloj:

1. Elegir 3 ejercicios de brazo (curl, press militar, elevación lateral).
2. Grabar con la watch-app de calibración 15 s (IMU-5/IMU-6, pendiente) o con el simulador.
3. Subir las muestras a `POST /strength/exercises/{id}/motion-profile/calibrate`.
4. Repetir 5 series de 8–12 reps etiquetadas a mano y comparar con el detector.
5. **Criterio**: ≥90 % de series con error ≤1 rep y ≥90 % de series detectadas. Si no, el conteo
   automático se queda fuera y se mantiene el marcado manual.

## Evidencia que hay que dejar

| Prueba | Qué apuntar | Dónde |
|---|---|---|
| A | `workoutId`, captura del reloj, captura del entreno en Garmin Connect | `ESTADO-AGENTE.md` + captura |
| B | `sent` y comportamiento del calendario | `ESTADO-AGENTE.md` |
| C | `activity_id`, `sets_imported`, `unmapped` | `ESTADO-AGENTE.md` |
| D | error por serie, % detectadas | `research/IMU-CALENDARIO.md` §10.3 |

Hasta que A–C estén hechas, T-30/T-31/T-42 siguen **en curso**, no cerradas.
