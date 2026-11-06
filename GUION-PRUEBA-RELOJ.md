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
| 4 | **Calendario → Programar entrenamiento** (semanal) → **Preparar los próximos 7 días** | Entrenos de hoy y próximos días enviados | Apuntar `sent` y el error |
| 5 | Repetir el paso 4 el mismo día | `sent: 0`, sin duplicar | Comprobar que no hay dos entrenos |
| 6 | Terminar una serie en el reloj y sincronizar | La actividad aparece en la app | Hora, modelo y captura |
| 7 | Importar la actividad: `POST /strength/import-garmin/{id}` | `sets_imported > 0` | Apuntar `unmapped` y el `id` |
| 8 | **Catálogo → Detección** y activar la detección automática | «Detección activada.» | Revisar el 422 |
| 9 | Watch-app Lyfta en el reloj | Ejercicio, serie, peso, reps detectadas y fuerza | Ver Prueba E |

## Antes de empezar

- Backend levantado contra la **cuenta real** de David (no la copia), con sus tokens.
- Reloj **Forerunner 255** cargado y emparejado con Garmin Connect; abrir la app de Garmin Connect
  una vez.
- Una plantilla con 2–3 ejercicios, series, pesos, reps y descansos reales.
- Una actividad con GPS ya sincronizada, para comprobar el detalle y las vueltas.
- Una ruta generada en **Rutas** y descargada en GPX, para llevarla al reloj.
- El guion no necesita GitHub Actions.

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

1. **Calendario → Programar entrenamiento**: elegir plantilla, «Se repite cada semana», uno o varios
   días y la hora. Debe aparecer en «Tus entrenamientos semanales».
2. **Preparar los próximos 7 días**. Debe devolver `sent > 0` para los días que tengan entreno.
3. Alternativa automática: esperar al job de las **06:30**.
4. **Reloj**: el entreno de hoy debe estar en el calendario y abrirse como en A.
5. Ejecutarlo otra vez el mismo día: `sent: 0`, sin duplicar (idempotencia).
6. **Casos raros**: programa dos entrenos el mismo día (uno por la mañana y otro por la tarde); deben
   aparecer los dos y poder quitar uno sin borrar el otro. Programa un entreno futuro y comprueba
   que no aparece antes de su primera fecha.

## Prueba C — Importar las series reales (T-30)

1. Terminar una actividad de fuerza en el reloj.
2. Sincronizar en Garmin Connect y esperar a que aparezca.
3. Llamar `POST /api/v1/strength/import-garmin/{activity_id}` con el token.
4. **Debe volver**: `sets_imported > 0`, `unmapped` vacío si todo está en el catálogo y la sesión en
   el historial con peso/reps.
5. Repetir: `409 already_imported`, sin duplicar.

## Prueba D — Detección automática de repeticiones (T-43)

1. En la app: **Catálogo → Detección** en 3 ejercicios de brazo (curl, press militar, elevación
   lateral). Pulsar **Activar detección automática**. No hay que configurar duración ni inicio de
   serie; el ajuste fino queda plegado.
2. En la watch-app, abrir el entreno y hacer 5 series de 8–12 reps.
3. **Debe verse**: reps detectadas, velocidad de ejecución y fuerza estimada; al terminar, 1RM
   estimado.
4. **Criterio**: ≥90 % de series con error ≤1 rep y ≥90 % de series detectadas. Si no, el conteo
   automático se queda fuera y se mantiene el marcado manual.

## Prueba E — Watch-app propia (T-32)

Depende de tener el `.prg` firmado y la instalación de desarrollador en el fr255 (Nivel 3). El
proyecto está en `watch/lyfta-watch/`.

1. Instalar `build/lyfta-fr255.prg` en el reloj con el flujo de desarrollador.
2. En Garmin Connect → app Lyfta → Ajustes, poner la dirección del backend y el token de David.
3. Abrir **Lyfta** en el reloj. Debe pedir el entreno de hoy.
4. **Debe verse**: «Lyfta», el nombre del entreno, «Ejercicio 1/N», el ejercicio, «Serie 1/N»,
   «Peso», «Objetivo × reps», «Reps detectadas», velocidad y fuerza.
5. Pulsar OK: la serie se guarda y avanza; el backend recibe `/watch/sets` (misma serie dos veces =
   `duplicate: true`, no dos filas).
6. Apagar el móvil/reloj o dejar sin red y marcar otra serie: debe verse «1 por enviar» al terminar y
   enviarse al recuperar la conexión.
7. **No se promete instalación desde aquí**: si falla el sideload, apuntar el error y seguir con A–D.

## Prueba F — Ruta en el reloj (T-35)

1. En **Rutas**, generar una ruta de carrera o bici con al menos un paso, altitud y esfuerzo.
2. Comprobar el perfil de elevación y el ritmo por kilómetro en la app.
3. Descargar el GPX y llevarlo al reloj por el flujo de Garmin Connect que use David.
4. **En el reloj**: debe abrirse el recorrido y verse el perfil de elevación nativo. La app no
   promete navegación giro a giro: entrega el track.

## Evidencia que hay que dejar

| Prueba | Qué apuntar | Dónde |
|---|---|---|
| A | `workoutId`, captura del reloj, captura del entreno en Garmin Connect | `ESTADO-AGENTE.md` + captura |
| B | `sent`, días enviados, dos entrenos el mismo día y recorte | `ESTADO-AGENTE.md` |
| C | `activity_id`, `sets_imported`, `unmapped` | `ESTADO-AGENTE.md` |
| D | error por serie, % detectadas, fuerza/1RM | `research/IMU-CALENDARIO.md` §10.3 |
| E | capturas de las pantallas de la watch-app | `watch/lyfta-watch/` |
| F | captura del recorrido y del perfil en el reloj | `ESTADO-AGENTE.md` |

Hasta que A–C estén hechas, T-30/T-31/T-42 siguen **en curso**, no cerradas.

## Ya preparado (2026-11-06)

- **Detección automática**: activar desde Catálogo → Detección; sin configurar duración ni inicio.
  La watch-app detecta con el acelerómetro y estima fuerza/1RM.
- **Calendario**: siete días en una fila, recurrencia semanal, quitar desde fecha, día concreto y
  auto-carga de hoy + 7 días a las 06:30.
- **Rutas**: generador con pasos, altitud, perfil, esfuerzo, ritmo por km y GPX.
- **Actividades**: velocidad, ritmo, altitud, FC, cadencia, potencia, zancada, desnivel/zancada,
  oscilación, contacto, sudor y temperatura.
- **Envío e importación**: endpoints y UI listos; solo falta la cuenta real.
