# Caso de uso real: un día de empuje con tres pesos distintos

Caso contado como lo usaría su dueño: planificar una sesión con **tres pesos distintos**
(60 / 65 / 70 kg), entrenarla con una mano, corregir lo que pasó de verdad y sacar los datos.
Está ejecutado de principio a fin y guardado aquí con sus capturas y su exportación.

- Fecha: **2026-11-11**
- Dónde: app desplegada en la instancia de verificación (copia desechable de la base)
- Artefactos: [`docs/ejemplo-sesion/`](ejemplo-sesion/) (5 capturas a 390 px, CSV y JSON)
- Reproducible con: [`frontend-nuevo/scripts/ejemplo-sesion.mjs`](../frontend-nuevo/scripts/ejemplo-sesion.mjs)

## El contexto

Toca empuje (press de banca con barra). La semana anterior se cerró con una serie de
**82,5 kg × 6**; esta semana toca subir el trabajo por series sin perder técnica. En Garmin
Connect habría que crear el entreno en el móvil, esperar la sincronización y acabar tecleando
el peso en la muñeca. Aquí el plan se hace en la app y el peso de cada serie viaja con él.

## El plan

| Serie | Objetivo | Reps | Descanso | Referencia |
|---|---|---|---|---|
| 1 | 60 kg | 8 | 45 s | aproximación |
| 2 | 65 kg | 8 | 45 s | trabajo |
| 3 | 70 kg | 6 | 45 s | tope del día |

La pantalla de entrenar arranca con esos objetivos y muestra **«Anterior: 82,5 kg × 6»** bajo
cada serie, para no perder la referencia de la semana pasada.

## Cómo transcurre

1. **Planificar** — plantilla «Empuje ejemplo» con tres objetivos distintos (60/65/70).
2. **Entrenar** — desde Gimnasio se pulsa «Empezar sesión» y luego **Modo enfocado**. La serie
   actual se ve grande con el peso objetivo, **±2,5 kg**, **±1 rep**, los discos por lado y el
   botón «Serie hecha». Captura
   [`01-serie-enfocada.png`](ejemplo-sesion/01-serie-enfocada.png).
3. **Registrar y descansar** — «Serie hecha» abre el registro rápido (reps reales + RPE 8) y
   arranca el temporizador **sin salir de la pantalla**; captura
   [`02-registro-rapido.png`](ejemplo-sesion/02-registro-rapido.png) y
   [`03-sesion-completada.png`](ejemplo-sesion/03-sesion-completada.png).
4. **Corregir** — al llegar a casa, la serie 1 se ajusta de 60 a **62,5 kg**; el historial
   muestra **`60 → 62,5 kg × 8 reps de plan`** con **+2,5 kg**. Captura
   [`04-planificado-vs-real.png`](ejemplo-sesion/04-planificado-vs-real.png).
5. **Guardar y exportar** — la sesión queda en el historial
   ([`05-historial.png`](ejemplo-sesion/05-historial.png)) y sale a CSV con una fila por serie.

## Resultado (lo que quedó registrado)

| Serie | Plan | Real | Reps | Diferencia | RPE |
|---|---|---|---|---|---|
| 1 | 60 kg | **62,5 kg** | 8 | **+2,5 kg** | 8 |
| 2 | 65 kg | 65 kg | 8 | igual | 8 |
| 3 | 70 kg | 70 kg | 6 | igual | 8 |

Volumen de la sesión: **1440 kg** (62,5·8 + 65·8 + 70·6).

```csv
fecha,sesion_id,sesion,ejercicio,grupo_muscular,serie,unidad,peso_previsto,peso_real,reps_previstas,reps_reales,dif,rpe,calentamiento,duracion_min,volumen_sesion
2026-11-11,fab9406e-…,Empuje ejemplo,Press de banca con barra,pecho,1,kg,60,62.5,8,8,2.5,8,no,0,1440
2026-11-11,fab9406e-…,Empuje ejemplo,Press de banca con barra,pecho,2,kg,65,65,8,8,0,8,no,0,1440
2026-11-11,fab9406e-…,Empuje ejemplo,Press de banca con barra,pecho,3,kg,70,70,6,6,0,8,no,0,1440
```

Archivo completo: [`sesion-ejemplo.csv`](ejemplo-sesion/sesion-ejemplo.csv). Exportación JSON:
[`sesion-ejemplo.json`](ejemplo-sesion/sesion-ejemplo.json).

## Qué se puede concluir

- Los **tres pesos distintos** llegan al plan, a la sesión y al CSV sin perderse.
- La app se usa **con una mano**: la serie se completa sin cambiar de pantalla y el descanso
  no bloquea la siguiente.
- La **corrección posterior** queda marcada, no escondida: `60 → 62,5 kg` con `+2,5 kg`.
- El CSV es análisis directo: tres series, tres filas, con sesión, unidad, plan, real y RPE.

## Límites del caso

- **No incluye el envío real a Garmin ni la lectura en el Forerunner 255**: la instancia de
  verificación no tiene credencial Garmin. Ese paso sigue pendiente en
  [`PENDIENTE-PRUEBA-RELOJ.md`](../PENDIENTE-PRUEBA-RELOJ.md), y la vía oficial/plan B está
  documentada en [`ENVIO-AL-RELOJ.md`](ENVIO-AL-RELOJ.md).
- `duracion_min` sale **0** porque el caso se ejecuta en menos de un minuto: es el dato real,
  no un fallo.
- La cuenta es temporal y de la instancia desechable; no se toca la base real del dueño.
