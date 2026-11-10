titulo: Lyfta — entrenamiento, reloj y análisis
estado: producto completo y desplegado; en-espera de la prueba física del reloj
tarea: tanda repetida (README+capturas, ajustes y caso técnico ya entregados); verificada y sin cambios que hacer
nivel: 2
siguiente: David confirma cifras/formato del README o entrega el resultado de la prueba del reloj; si no, la tanda está cerrada
bloqueado: repetición del mismo encargo ya entregado + prueba física del fr255 (2FA/reloj de David)
fecha: 2026-11-10
resumen: README de portfolio con 3 capturas, ajustes de unidades/tema/offline y caso técnico con 3 capturas clave ya están entregados (68/68 y 24/24 reales); la tanda ha llegado repetida y solo falta la prueba física del reloj.

## Bloqueo

**Situación (2026-11-10, 19:30):** ha llegado otra vez la misma tanda de esta tarde. Las tres
tareas ya están entregadas y verificadas; repetirlas sería reescribir lo mismo. Lo dejo escrito
en vez de rehacerlo en silencio.

**(a) Dónde me quedé.** Las tres cerradas y comprobadas ahora mismo: `README.md` con tres
capturas, diagrama Mermaid, pruebas y pendiente del reloj (commit `b5648ad`); Ajustes con
unidades kg/lb, tema claro/oscuro y tarjeta «funciona sin conexión» (commit `57c858a`, verificado
en `SettingsPage.tsx`); `docs/CASO-GARMIN.md` §7 con las tres capturas clave. Árbol limpio,
`master` = `origin/master`.

**(b) Qué falta revisar.**
1. La **prueba física del fr255**, que sigue siendo el único pendiente real.
2. El encargo cita «65/65 y 23/23», que son cifras de una tanda anterior: hoy son **68/68**
   frontend y **24/24** backend. Hay que decidir si el README mantiene las reales (recomendado)
   o añade una nota histórica.
3. Si quiere **otra variante del README** (más corto para reclutador, en inglés, u otra
   selección de capturas).
4. Confirmar el **sufijo del tailnet**: el servidor anuncia `servidor.tail4263a0.ts.net` y
   `ta4283ad.ts.net` aún no resuelve.

**(c) Qué necesito de David u otro chat.**
- El resultado de la prueba del reloj, o una tarea distinta para no repetir esta.
- Confirmación de si mantengo las cifras reales (68/68 y 24/24) en el README.
- Si quiere cambios de formato o idioma en `README.md` / `docs/CASO-GARMIN.md`.

**(d) Siguiente paso concreto.** En cuanto confirme cifras/formato, aplico los ajustes de texto
en README y CASO (unos minutos) y dejo commit. Si prefiere seguir por el reloj, ejecuto la
importación y la medición del detector con los datos que me pase del fr255.
