# Carga Watch — diseño de la watch-app Connect IQ (T-32)

Basado en `INVESTIGACION-AMPLIACION.md` §3.4 (camino B) y en el WALL bloque 1. Es una app
**propia** de Carga, no la app nativa de Garmin: sirve para cuando el camino A (workout nativo) no
llegue. No puede escribir las series dentro de la actividad nativa de Garmin; las manda a nuestro
backend y, aparte, graba una actividad para que el reloj tenga el entreno.

## Alcance de esta primera versión

- Objetivo físico: **Forerunner 255** (260×260 MIP), compilación con `monkeyc`.
- Compatibilidad amplia: `minSdkVersion 3.3.0`, productos del catálogo (fr255/fr265/fr965/fenix7/
  venu3/fr245/fenix6…). Sin APIs nuevas del SDK.
- **Se puede probar sin reloj**: compila y se ejecuta en el simulador. La instalación real necesita
  la clave/reloj de David (Nivel 3).
- Textos mínimos (§8): solo lo que el atleta necesita para decidir o actuar. Nada de tokens, URLs ni
  estados internos.

## Pantallas

| Pantalla | Qué enseña | Botones |
|---|---|---|
| **Cargando** | «Carga» y «Buscando entreno». Si falla: «Sin conexión» y «Reintentar». | OK reintenta |
| **Entreno** | Nombre del entreno, «Ejercicio 2/4», nombre del ejercicio, «Serie 1/3», **peso × reps** en grande, progreso de series. | OK = serie hecha; ABAJO = siguiente ejercicio; ATRÁS = salir |
| **Fin** | «Entreno terminado», series hechas y cuántas quedan por enviar. | OK cierra |
| **Sin entreno** | «Hoy no toca fuerza». | OK cierra |

No hay menús ni pantallas de configuración dentro del reloj. La URL y el token se configuran una vez
en los ajustes de la app desde Garmin Connect (propiedades `apiUrl` y `token`), y la mano del reloj
se preguntará en una versión posterior.

## Cómo recibe el entrenamiento del día

1. La app arranca y lee de `Application.Storage` la cola de series pendientes.
2. Pide `GET {apiUrl}/watch/today` con `Authorization: Bearer {token}`.
3. El backend elige, por este orden: el evento de hoy del calendario con plantilla, la plantilla del
   día, o devuelve `no_workout`.
4. Respuesta:

```json
{
  "workout_id": "calendario:2026-11-05",
  "name": "Empuje A",
  "exercises": [
    {
      "exercise_id": "e-1",
      "name": "Press de banca",
      "position": 0,
      "sets": 4,
      "reps": 8,
      "weight_kg": 80,
      "rest_seconds": 150
    }
  ]
}
```

5. La app pinta el primer ejercicio/serie. Si no hay red o no hay token, usa una rutina de
   demostración **solo en el simulador**, para que la pantalla se pueda revisar sin cuenta real.

## Cómo muestra ejercicio, serie, peso y reps

- Cabecera «Carga», nombre del entreno y contador `Ejercicio n/N`.
- Nombre del ejercicio en una línea (se recorta si no cabe; no se inventa).
- Contador `Serie s/S`.
- Peso y reps en el centro: `80 kg` y `× 8`.
- Barra de progreso de series hechas.
- Pie: `OK hecha` y `ABAJO siguiente`.
- Al terminar la última serie de un ejercicio, OK pasa al siguiente; al terminar el último, pantalla
  de fin.

## Cómo devuelve las series hechas

Cada OK crea un registro local antes de tocar la red:

```json
{
  "client_set_id": "<uuid-local>",
  "workout_id": "calendario:2026-11-05",
  "exercise_id": "e-1",
  "set_number": 1,
  "weight_kg": 80,
  "reps": 8,
  "completed_at": "2026-11-05T18:05:00Z"
}
```

- Se guarda en `Application.Storage` (`pending_sets`) y se intenta `POST {apiUrl}/watch/sets`.
- Si falla, se queda en la cola; la app la reintenta al arrancar y al volver a primer plano.
- El backend deduplica por `client_set_id`: reintentar no duplica la serie.
- La app graba una actividad de fuerza (`ActivityRecording`) para que el reloj tenga el entreno; al
  cerrar, la guarda. Es independiente de las series que manda al backend.

## Backend necesario

- `GET /api/v1/watch/today` — devuelve el entreno de hoy o `no_workout`.
- `POST /api/v1/watch/sets` — acepta una serie, crea/reutiliza la sesión del día y deduplica por
  `client_set_id`.
- Autenticación: Bearer normal en esta versión; el emparejamiento con código de 6 dígitos y token de
  dispositivo queda como evolución (la app no puede teclear credenciales).

## Estados y fallos

- Sin red: se puede seguir marcando; la cola crece y se ve «N por enviar» en la pantalla de fin.
- Sin entreno: mensaje claro y salir.
- Token inválido: «Sin conexión»; no se borra la cola.
- Serie duplicada: el backend responde `duplicate: true`; la app la quita de la cola.

## Detección de movimiento en el reloj

- Al abrir el entreno, la app escucha el acelerómetro a 25 Hz. No pide duración de repetición ni
  inicio de serie.
- Un pico por encima de ~1,25 g marca el final de una repetición; el tiempo entre picos da la
  velocidad de ejecución.
- Con el peso de la serie, la app calcula una **fuerza estimada** (`peso × 9,81 × factor de
  velocidad`) y un **1RM estimado** (Epley). Es una estimación de POC, no una medición de laboratorio.
- La pantalla enseña reps detectadas, velocidad y fuerza mientras se ejecuta la serie; al pulsar OK
  se guarda la serie con esos valores.

## Qué NO hace esta versión

- No detecta la mano del reloj automáticamente; se usará el brazo del reloj por defecto.
- No crea ni agenda workouts nativos: eso es el camino A.
- No se instala en el reloj real desde aquí: `monkeydo` es solo simulador; falta la instalación con
  David.
- No promete precisión de conteo: el POC IMU-5/6 mide el error real antes de prometerlo.

## Criterios de aceptación

1. Compila para **fr255** y para al menos fr245/fenix6 con el mínimo API.
2. En el simulador se ven las pantallas de entreno, serie marcada y fin.
3. La app no se cae si no hay red; la cola queda guardada.
4. Los textos son los mínimos; no hay detalles técnicos visibles.
5. El backend devuelve el entreno de hoy y acepta series sin duplicar (prueba de contrato).
