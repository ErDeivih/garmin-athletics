# Guion de prueba con el reloj real (Forerunner 255)

Lista de una pasada para cuando David tenga el reloj y el móvil delante. El 2FA lo
introduce David; el agente no lo pide ni lo guarda. No se activan GitHub Actions.

## Checklist

| # | Acción | Debe verse | Si falla |
|---|---|---|---|
| 1 | Backend con la cuenta real y **Ajustes → Vincular cuenta** | «Vinculado» | Apuntar el mensaje, sin contraseña ni código |
| 2 | **Gimnasio → Editar pesos** y ajustar una serie con − / + | El peso cambia y se guarda solo | Apuntar la serie y el plan |
| 3 | **Gimnasio → Enviar al reloj** | «Enviado al reloj» | Apuntar el texto y si el reloj está sincronizado |
| 4 | Abrir el entreno en el reloj | Ejercicio, serie, peso objetivo y reps; no pide escribir peso | Captura y pantalla exacta |
| 5 | Pulsar **Empezar** y hacer una serie | La serie se guarda y avanza sin pulsar OK | Hora, modelo y qué se vio |
| 6 | Sincronizar el reloj | La actividad aparece en Lyfta / Garmin | Esperar y sincronizar; apuntar hora |
| 7 | Importar o comprobar la actividad | Series con peso y reps en el historial | `sets_imported`, `unmapped`, id |
| 8 | **Gimnasio → Últimas sesiones → Corregir pesos** | Cambiar una serie con − / + y guardar | Captura del error |
| 9 | **Calendario → Preparar los próximos 7 días** | `sent > 0`, sin duplicados | Apuntar `sent` y el error |

## Antes de empezar

- Backend real con los tokens de David; no cerrar la sesión de Garmin.
- Reloj **Forerunner 255** cargado y emparejado. Abrir Garmin Connect una vez y
  arrastrar hacia abajo para sincronizar si el entrenamiento no aparece.
- Una plantilla con 2–3 ejercicios, series, pesos y descansos.
- La app abierta en el móvil; no hace falta crear el entrenamiento en Garmin Connect.

## Prueba A — Del móvil al reloj (T-31)

1. **Gimnasio → Editar pesos**. Cada serie tiene su peso; se cambia con **−** y **+**.
   Si no hay peso, se usa la última serie registrada de ese ejercicio.
2. **Gimnasio → Enviar al reloj**. El botón está siempre visible; no hay que
   preparar nada ni marcar casillas.
3. Estado esperado: **«Enviado al reloj»**. Si aparece **«No se pudo enviar»**,
   acercar el reloj, sincronizar y pulsar **Reintentar**.
4. En el reloj, abrir el entreno de hoy. Debe mostrar el peso objetivo de cada serie.
   El usuario **no escribe pesos**.
5. Pulsar **Empezar** y ejecutar una serie. La app propia cierra la serie sola cuando
   detecta el reposo; no hace falta pulsar OK ni configurar nada.
6. El reloj devuelve la serie al backend; en el móvil aparece en **Últimas sesiones**.

## Prueba B — Calendario y auto-carga (T-42)

1. **Calendario → Programar entrenamiento**: plantilla, repetición semanal y hora.
2. **Preparar los próximos 7 días**: `sent > 0` para los días con entreno.
3. Repetir el mismo día: `sent: 0`, sin duplicados.
4. Dos entrenos el mismo día: aparecen los dos y se puede quitar uno sin borrar el otro.

## Prueba C — Series de vuelta y corrección (T-30)

1. Terminar una actividad de fuerza y sincronizar.
2. Importar la actividad o esperar la sincronización de Lyfta.
3. Comprobar en **Últimas sesiones** que están las series con peso y reps.
4. **Corregir pesos**: abrir la sesión y cambiar el peso real con **− / +**. Al guardar
   se recalcula el volumen.
5. Repetir la importación: no debe duplicar la sesión.

## Prueba D — Detección automática (watch-app)

La detección nueva vive en la **watch-app de Lyfta**, no en el entreno nativo de Garmin.
El detector está en pausa hasta cerrar la interfaz móvil; cuando se retome:

1. Instalar la watch-app en el fr255.
2. Abrir Lyfta en el reloj; debe cargar el entreno de hoy.
3. Hacer 8–12 reps en press y curl. No pulsar nada más que **Empezar**.
4. Debe cerrar la serie tras el reposo y enviar las reps al backend.
5. Criterio: ≥95 % de series con error ≤1 rep y ningún cierre prematuro. Si no se
   cumple, se deja el conteo manual.

## Prueba E — Watch-app propia

1. Instalar `build/lyfta-fr255.prg` con el flujo de desarrollador.
2. Configurar la URL del backend y el token en los ajustes de la watch-app.
3. Abrir **Lyfta** en el reloj.
4. Debe verse: «Lyfta», el nombre del entreno, «Ejercicio 1/N», el ejercicio,
   «Serie 1/N», «Peso (kg)» con el objetivo, «Objetivo x N» y las reps detectadas.
5. La serie se cierra sola; no hay que pulsar OK ni meter pesos. No vibra.
6. El móvil recibe `/watch/sets`; la misma serie dos veces devuelve `duplicate: true`.

## Prueba F — Ruta en el reloj (T-35)

1. **Rutas** → generar ruta con pasos, altitud y esfuerzo.
2. Descargar GPX y llevarlo al reloj.
3. En el reloj debe abrirse el recorrido con su perfil de elevación.

## Evidencia

| Prueba | Qué apuntar |
|---|---|
| A | Captura del plan con pesos, estado del envío, captura del reloj |
| B | `sent`, días enviados, dos entrenos el mismo día |
| C | `activity_id`, `sets_imported`, `unmapped`, captura del historial corregido |
| D/E | Reps por serie, % de aciertos, capturas de la watch-app |
| F | Captura del recorrido y del perfil |

## Ya preparado (2026-11-08)

- Pesos por serie al planificar y después de entrenar, con botones − / + y guardado automático.
- Envío desde Lyfta con estado «Enviado al reloj» / «No se pudo enviar».
- Series guardadas con peso y reps; historial y corrección desde el móvil.
- Watch-app con peso objetivo por serie, cierre automático y envío de series al backend.
- La captura del simulador espera el primer fotograma real; si la ventana sigue apagada,
  falla y no guarda una imagen negra.
