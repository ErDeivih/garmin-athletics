titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: tanda repetida por tercera vez (caso, exportar CSV y resumen semanal ya entregados); verificada, sin cambios pendientes
nivel: 2
siguiente: David entrega el resultado de la prueba del reloj o una tarea distinta; si no, no hay nada que hacer en esta tanda
bloqueado: repetición del mismo encargo ya entregado + prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-10
resumen: Caso de portfolio (arquitectura PWA + Connect IQ, 69/69 y 24/24, pendiente reloj), exportación CSV y resumen semanal por grupo con adherencia ya están entregados y desplegados; la tanda ha vuelto a llegar repetida.

## Bloqueo

**Situación (2026-11-10, 22:55):** llega por tercera vez una tanda ya entregada. Las tres
tareas están cerradas y comprobadas ahora mismo; no rehago lo mismo en silencio.

**(a) Dónde me quedé.** Verificado contra el repositorio y el despliegue:
- `docs/CASO-GARMIN.md` con arquitectura PWA + Connect IQ, qué demuestra, tres capturas clave y
  pendiente del reloj; cifras actualizadas a **69/69** frontend (33 ficheros) y **24/24** backend
  (commit `b5648ad`, actualizado en `a03e871`).
- **Exportar historial** CSV/JSON: `GET /api/v1/strength/export` responde **401** (existe y pide
  sesión) y la captura `24-exportar-historial.png` está en el repo (entrega `5ae6a0b`).
- **Resumen semanal** con volumen, series por grupo muscular y adherencia al plan:
  `GET /api/v1/strength/stats` responde **401** y `25-resumen-semanal.png` está en el repo
  (entrega `5ae6a0b`).
- Árbol limpio, `master` = `origin/master`, suites verdes en la última pasada (69/69 y 24/24).

**(b) Qué falta revisar.**
1. La **prueba física del fr255** (envío, peso por serie en el reloj, vuelta de una serie real y
   medición del detector de repeticiones): único pendiente real del producto.
2. El encargo vuelve a citar **65/65 y 23/23**, que son cifras de una tanda anterior; las reales
   son **69/69** y **24/24**. No las cambio a las antiguas sin confirmación.
3. Confirmar el **sufijo del tailnet** (`servidor.tail4263a0.ts.net` funciona; `ta4283ad.ts.net`
   no resuelve).

**(c) Qué necesito de David u otro chat.** El resultado de la prueba del reloj (o una tarea
distinta y concreta); y que confirme si mantengo las cifras reales en el README y en el caso.

**(d) Siguiente paso concreto.** No hay cambios que aplicar sin información nueva: en cuanto
llegue el resultado del reloj, importo la actividad, contrasto `sets_imported`/`unmapped` y apago
el aviso «Reloj real»; si prefiere, ejecuto cualquier ajuste de texto que pida sobre el caso.
