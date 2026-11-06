# Rutas y biblioteca: qué hacen las apps que funcionan

Fecha: 2026-11-05. Fuentes públicas consultadas; no se ha copiado interfaz ni datos.

## Rutas

- **Strava Routes** permite construir recorridos por puntos de paso, ver distancia y desnivel y
  elegir el deporte antes de salir. La referencia útil es el flujo *punto de paso → perfil → guardar*,
  no la capa social. ([ayuda de Strava](https://support.strava.com/pt/articles/15401971-como-posso-criar-e-gerir-rotas-no-site-do-strava))
- **Komoot** insiste en el perfil de elevación, los puntos de interés y el deporte concreto
  (correr, bici de carretera, BTT). La lección: una ruta no es una lista de coordenadas; el desnivel
  y el tipo de terreno cambian el esfuerzo. ([Komoot](https://www.komoot.es/plan))

**Decisión Lyfta:** el generador parte de un inicio y hasta 12 puntos de paso, calcula distancia,
desnivel y pérdida, propone un perfil de elevación y reparte el ritmo por kilómetro según deporte y
esfuerzo. Se puede descargar en GPX para llevarlo al reloj. No se promete navegación giro a giro:
el reloj nativo reproduce el track que recibe.

## Biblioteca de entrenamientos

- **Hevy** y **Strong** coinciden en lo que hace usable una rutina: ejercicios con nombre reconocible,
  grupo muscular, equipo, series, reps y peso; historial por ejercicio y plantillas por día. La
  diferencia está en los detalles de ejecución y en cómo se agrupan las plantillas, no en un listado
  plano. ([comparativa Hevy/Strong](https://www.volm.app/blog/hevy-vs-strong),
  [Hardy](https://hardy.app/articles/hevy-vs-strong))

**Decisión Lyfta:** la biblioteca agrupa por foco (empuje, tirón, pierna, cuerpo completo) y muestra
cada rutina en tres fases: activación, bloque principal y cierre. Cada ejercicio enseña series × reps,
peso, descanso y una explicación breve. El objetivo es que se pueda distinguir una rutina de otra de
un vistazo, no solo acumular plantillas.

## Lo que no se copia

- No se usan mapas ni datos propietarios de Strava o Komoot.
- No se copian textos, iconos ni flujos cerrados.
- La ruta se genera con nuestros propios puntos y el perfil es una estimación; el reloj recibe el GPX.
