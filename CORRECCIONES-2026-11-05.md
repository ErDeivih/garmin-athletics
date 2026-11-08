# Correcciones de David — 2026-11-05

Este documento deja escritas las correcciones del lote del 5 de noviembre y lo que se ha
aplicado. Manda `DOCTRINA-CALIDAD.md` §8 y §9.

## 1. Nombre: Lyfta

- Nombre de producto: **Lyfta**. Paquete `lyfta-frontend`; título `Lyfta`; clave de
  almacenamiento `lyfta.*`.
- Se elimina «Garmin Athletics» de cabecera, login, `index.html`, `package.json`, título de la API y
  documentación. «Garmin» solo queda donde es la **cuenta o el reloj del usuario** (conectar la
  cuenta, enviar al reloj), nunca como nombre de la app.
- Decisión D-17 en `DECISIONES.md`. Si David prefiere otro nombre, el cambio es de una constante de
  marca; no bloquea.

## 2. La interfaz no habla de cómo está hecha (§8)

Borrado, sin sustituir por otro texto:

| Dónde | Qué se ha quitado |
|---|---|
| Login | «El token dura 30 días…» |
| Ajustes | última sincronización con actividades/TSS, «atajo de desarrollo» y clave de la bandera, explicación de la contraseña y los tokens |
| Hoy | desglose de «cómo se compone» la disposición, ATL/CTL/TSB en las etiquetas, mensajes de error con detalles del backend |
| Tendencias | «Foster 1998», «ATL fatiga · CTL forma», nota de estimación de 1RM, nota del ratio empuje/tirón, mensajes de API |
| Actividades | TSS, tipo técnico (`lap_swimming`), «con track», textos de «cuando Garmin sincronice…» |
| Gimnasio | «mapeo», «catálogo Garmin», «API», referencias a tareas, errores internos |
| Sesión | TSS del resumen, «el borrador se ha borrado de este navegador», RPE como jerga (ahora «esfuerzo») |
| Rutas/Social/Rendimiento/Calendario | promesas de tareas futuras, TSS/CTL, «sin readiness», notas internas |
| Catálogo | enums de Garmin y «sin enum» |

Se conservan y se explican las medidas que ayudan a decidir: «Carga aguda: lo que has entrenado esta
semana», «Forma: lo acumulado en semanas», «Frescura: positivo, descansado; negativo, cargado»,
«HRV: variación entre latidos», etc.

## 3. Móvil: más densidad y color

- `Card` pasa a `p-3` en móvil y `p-4` en escritorio; `StatCard` reduce tipografía y añade
  explicación breve (`hint`).
- Hoy: disposición compacta sin el desglose de cálculo; métricas en **dos columnas**; carga y Body
  Battery a ancho completo; avisos compactos.
- Gimnasio: se elimina la tarjeta «Tus números» que repetía datos; envío al reloj compacto y sin
  listado de mapeo; sesiones en filas densas.
- Tendencias: todas las tarjetas a `mt-3`/`gap-3`; periódicos y métricas compactos; menos texto
  técnico.
- Catálogo: tarjetas a dos columnas con dibujo compacto; se quita el enum.
- Actividades: lista compacta con distancia, FC y desnivel; detalle con rejilla de 2 columnas.
- Calendario: formulario compacto, semana en tarjetas de 2 columnas en móvil.
- Login y Ajustes: menos altura muerta y menos párrafos.

Contraste AA se mantiene: los tokens no cambian. La puerta `check-contrast.mjs` sigue en verde.

## 4. Actividades: bloque propio

- Nueva ruta `/actividades/:id` con: resumen (distancia, duración, ritmo, FC media/máx, desnivel,
  calorías, carga), zonas de FC, recorrido GPS en SVG, series de FC/ritmo/altitud/velocidad y
  parciales por kilómetro.
- Reutiliza endpoints existentes (`/activities/{id}`, `/streams`, `/splits`, `/track`): **no hay
  backend nuevo** para el detalle básico.
- La lista enlaza cada actividad y muestra solo lo útil; sin TSS ni «con track».
- Investigación y propuesta completa: `research/ACTIVIDADES-COMPETENCIA.md` (T-35 a T-39).
- Pendiente: vueltas, meteo, botón «Actualizar», filtros/paginación en servidor (T-37/T-38) y
  altitud rellenada (T-39).

## 5. Calendario y reloj

- Backend: `CalendarEvent` gana `template_id`, `garmin_workout_id` y `last_scheduled_date`
  (migración aditiva).
- Endpoints nuevos: `POST /calendar/events/{id}/preview`, `POST /calendar/events/{id}/send` y
  `POST /calendar/sync-today`. Construyen el workout tipado con la plantilla y lo programan en
  Garmin Connect (`upload_strength_workout` + `schedule_workout`).
- UI: programar una plantilla en varios días de la semana (se repite), ver los entrenos semanales,
  previsualizar y enviar; botón «Cargar el de hoy en el reloj». El calendario distingue **Plan**
  de **Hecho**.
- **Pendiente**: el job automático diario que recorre las reglas y empuja el entreno del día sin
  pulsar nada (CAL-1/CAL-2 del informe IMU), y la prueba real en el fr255 (Nivel 3).
- Diseño de detección IMU por ejercicio y calendario: `research/IMU-CALENDARIO.md` (esquema
  `exercise_motion_profiles`, calibración de 10–15 s, tareas IMU-1..8 y CAL-1..3).

**Actualización de la mañana del 2026-11-05:** el job de auto-carga ya existe (06:30, idempotente,
`tests/test_calendar_auto.py`); el perfil IMU tiene modelo, API de versiones, calibración y detector
en seco (`tests/test_motion_profile.py`, 5/5 reps con señal sintética). El guion para el día del
reloj está en `GUION-PRUEBA-RELOJ.md`.

## 5.1 Guion de la prueba real

`GUION-PRUEBA-RELOJ.md`: pasos A (envío), B (calendario), C (importación) y D (POC IMU), con lo que
debe verse en el reloj y lo que debe volver al backend. El 2FA lo introduce David; el agente no lo
pide ni lo guarda.

## 6. Evidencia de esta sesión

- Frontend: **33/33** pruebas en 13 ficheros; typecheck y build limpios.
- Backend: **13/13** scripts en verde (incluye calendario con plantilla/preview, auto-carga y perfil
  IMU en seco).
- Humo real: 16 capturas 390×844, 0 errores de consola.
- Sin GitHub Actions; push selectivo al final de la sesión.

## 7. Segundo lote de correcciones (noche del 2026-11-05)

1. **Marca Lyfta.** Sustituye la marca anterior en cabecera, `index.html`, `package.json`, login, Ajustes,
   `designs/lyfta-design-system`, almacenamiento local y watch-app. No quedan restos de la marca anterior en
   archivos versionados.
2. **Capturas.** Se borraron las anteriores y se regeneraron 18 nuevas, numeradas de `01` a `18`.
3. **Detección automática.** El editor ya no pide duración de repetición ni inicio de serie: activa
   un perfil automático y deja el ajuste fino plegado. La watch-app escucha el acelerómetro, detecta
   picos, mide velocidad y estima fuerza y 1RM.
4. **Rutas.** Generador con inicio, hasta 12 pasos, distancia objetivo, deporte, esfuerzo, perfil de
   elevación, recorrido y ritmo por kilómetro; guarda y exporta GPX para el reloj.
5. **Calendario.** Semana completa en una fila, modo semanal o día concreto, `recurrence_until`,
   «Quitar desde aquí», auto-carga de hoy y próximos 7 días (`/sync-upcoming`) y job de las 06:30.
6. **Actividades.** Se extraen y pintan cadencia, potencia, temperatura, zancada, desnivel por
   zancada, oscilación vertical, contacto y sudor cuando el reloj los trae.
7. **Biblioteca.** Rutas agrupadas por foco y fases (activación, bloque principal, cierre), con
   series × reps, peso, descanso y explicación breve.
8. **Privacidad.** Se retira la tarjeta de borrado y el texto de biometría/datos de salud; no se
   ofrece eliminar los datos desde la app.
9. **Investigación.** `research/RUTAS-BIBLIOTECA.md` con Strava, Komoot, Hevy y Strong.

**Evidencia:** frontend **41/41** pruebas en 18 ficheros; backend **19/19** scripts; 24 capturas
390×844 sin errores de consola; contrato ampliado con `/watch/today` y `/routes/generate`.
