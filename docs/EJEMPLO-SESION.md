# Sesión de ejemplo, de principio a fin

Esta es una sesión real ejecutada contra la app desplegada en la instancia de
verificación (copia desechable de la base, sin credencial Garmin), guardada aquí con sus
capturas y su exportación. Sirve como **prueba reproducible** de los tres criterios de la
tanda: serie enfocada, planificado vs real y CSV por serie.

- Fecha de la sesión: **2026-11-11**
- Usuario temporal: `ejemplo+…@example.com` (instancia desechable, ya retirada)
- Script que la reproduce: [`frontend-nuevo/scripts/ejemplo-sesion.mjs`](../frontend-nuevo/scripts/ejemplo-sesion.mjs)

## Cómo se reproduce

```powershell
ssh servidor "~/lyfta/deploy/instancia-verificacion.sh up"
cd frontend-nuevo
node scripts/ejemplo-sesion.mjs http://192.168.1.139:8011
ssh servidor "~/lyfta/deploy/instancia-verificacion.sh down"
```

El script crea la cuenta y la plantilla, siembra una marca de la semana anterior (para que
aparezca «Anterior»), ejecuta la sesión en el navegador a 390 × 844, corrige la serie 1 y
exporta la sesión. Deja en esta carpeta las capturas, el CSV y el JSON.

## El plan

| Serie | Peso objetivo | Reps objetivo |
|---|---|---|
| 1 | 60 kg | 8 |
| 2 | 65 kg | 8 |
| 3 | 70 kg | 6 |

Marca anterior: **82,5 kg × 6** (semana previa) → se muestra «Anterior» bajo cada serie.

## La ejecución

1. Se abre **Entrenar** desde el gimnasio y se pulsa **Modo enfocado**: serie actual grande,
   peso objetivo, ±2,5 kg, «Anterior: 82,5 kg × 6», discos y «Serie hecha». Captura
   [`01-serie-enfocada.png`](ejemplo-sesion/01-serie-enfocada.png).
2. «Serie hecha» abre el **registro rápido** (reps reales + RPE 8); la serie se completa y
   arranca el descanso **sin cambiar de pantalla**. Captura
   [`02-registro-rapido.png`](ejemplo-sesion/02-registro-rapido.png).
3. Tras la tercera serie, **sesión completada** con nota; captura
   [`03-sesion-completada.png`](ejemplo-sesion/03-sesion-completada.png).
4. En el historial se **corrige el peso real de la serie 1** de 60 a **62,5 kg**. El detalle
   muestra **`60 → 62,5 kg × 8 reps de plan`** con **+2,5 kg** resaltado. Captura
   [`04-planificado-vs-real.png`](ejemplo-sesion/04-planificado-vs-real.png).
5. La lista del historial queda con la sesión guardada. Captura
   [`05-historial.png`](ejemplo-sesion/05-historial.png).

## Planificado vs real (lo que quedó guardado)

| Serie | Plan | Real | Reps plan | Reps reales | Diferencia | RPE |
|---|---|---|---|---|---|---|
| 1 | 60 kg | **62,5 kg** | 8 | 8 | **+2,5 kg** | 8 |
| 2 | 65 kg | 65 kg | 8 | 8 | igual | 8 |
| 3 | 70 kg | 70 kg | 6 | 6 | igual | 8 |

Volumen de la sesión: **1440 kg** (62,5·8 + 65·8 + 70·6).

## CSV por serie (tal cual lo genera la app)

Archivo completo: [`sesion-ejemplo.csv`](ejemplo-sesion/sesion-ejemplo.csv).

```
fecha,sesion_id,sesion,ejercicio,grupo_muscular,serie,unidad,peso_previsto,peso_real,reps_previstas,reps_reales,dif,rpe,calentamiento,duracion_min,volumen_sesion
2026-11-11,fab9406e-…,Empuje ejemplo,Press de banca con barra,pecho,1,kg,60,62.5,8,8,2.5,8,no,0,1440
2026-11-11,fab9406e-…,Empuje ejemplo,Press de banca con barra,pecho,2,kg,65,65,8,8,0,8,no,0,1440
2026-11-11,fab9406e-…,Empuje ejemplo,Press de banca con barra,pecho,3,kg,70,70,6,6,0,8,no,0,1440
```

**Tres series → tres filas**, con sesión (`sesion_id` y nombre), unidad, previsto, real,
diferencia y RPE. El JSON completo de la exportación está en
[`sesion-ejemplo.json`](ejemplo-sesion/sesion-ejemplo.json).

## Qué demuestra y qué no

- **Demuestra**: el flujo real de punta a punta (plan → sesión → guardado → corrección →
  exportación), que el peso por serie se conserva, que la corrección posterior se marca y
  que el CSV sale con una fila por serie.
- **No demuestra**: el envío real a Garmin ni la lectura en el Forerunner 255 (requiere el
  reloj y el 2FA; pendiente en `PENDIENTE-PRUEBA-RELOJ.md`). La instancia de verificación
  no tiene credencial Garmin.
- `duracion_min` sale **0** porque la sesión de ejemplo se ejecuta en menos de un minuto;
  es un dato real, no un fallo.
