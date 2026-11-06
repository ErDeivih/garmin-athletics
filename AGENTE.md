# Ficha del agente — Carga — panel de entrenamiento y editor de gimnasio

**Id en el panel**: `garmin`
**Ruta**: `F:\Proyectos\garmin`
**Rama de trabajo**: `master`
**Familia de interfaz**: A (panel de datos) + G (editor) — ver `F:\Inforepositorios\indice\RECETAS-UI.md`

## Mision

Sustituir la app de Garmin con algo mejor: ingesta de la cuenta, panel de disposición y un editor de entrenamientos de gimnasio con ejercicios, series y repeticiones mas facil que el oficial.

## Como trabajas

Lee y sigue `F:\EspacioCodigo\_flujo-dsh\PROTOCOLO-AUTONOMIA.md`. En resumen:

- **Nivel 1**: decide solo y ejecuta (refactor, pruebas, docs, rendimiento, accesibilidad).
- **Nivel 2**: decide solo pero lo anotas en `DECISIONES.md` (pantallas ya especificadas, dependencias pequenas, esquema reversible).
- **Nivel 3**: paras y preguntas (alcance, datos, credenciales, dinero, otro proyecto, ramas).
- **Una tarea bloqueada no para la sesion**: la marcas y sigues con la siguiente.

Antes de escribir codigo, lee `ESPECIFICACION.md`. Si no existe o esta vacia, **eso** es la tarea.

## Tu backlog

Vive en `BACKLOG.md`. Nunca puede tener menos de 5 tareas listas. Si baja, generas mas de estas tres fuentes:

1. **Competencia**: que hacen las apps del sector y que nos falta.
2. **Huecos de la especificacion**: pantallas prometidas sin hacer, estados sin cubrir.
3. **Deuda tecnica**: pruebas, duplicacion, dependencias.

## Investigacion inicial encomendada

Garmin Connect, Strava, Hevy, Strong, Fitbod, Apple Fitness. Que hace cada una con el entrenamiento de fuerza, como se crea una rutina en cada una, y que le falta a la de Garmin.

Se deja en `INVESTIGACION.md`: que se ha mirado, que hace la competencia, que nos falta y **una propuesta concreta de tarea**.

## Primera tarea

Inventariar los endpoints del backend (que hay y que devuelve), porque el frontend se rehace desde cero contra el.

## Al terminar cada sesion

Deja `ESTADO-AGENTE.md` actualizado con este formato exacto. De ahi lo lee el panel:

```
titulo: Carga — panel de entrenamiento y editor de gimnasio
estado: en-curso
tarea: lo que estabas haciendo
nivel: 1 | 2 | 3
siguiente: lo proximo que haras
bloqueado: la pregunta de nivel 3, si la hay
fecha: AAAA-MM-DD
```

Y recuerda: **sin commit y sin push, no esta terminado.**


## Consultar el catálogo de repositorios (no busques a mano)

Antes de buscar una librería, una herramienta o una referencia, pregunta al catálogo personal de David: más de 500 fichas documentales y ~1.400 repositorios dentro de recopilaciones, con licencia real, límite y recomendación.

```powershell
python F:\Inforepositorios\consultar.py "<lo que necesitas>" -n 5 --json
```

Devuelve los mejores candidatos con su licencia y la ruta de su ficha. Abre solo esas fichas y mira la sección 9 (cuándo no elegirlo) y la 6 (licencia). Es evidencia documental: nada se ha clonado, instalado ni ejecutado. Guía: `F:\Inforepositorios\RAG.md`. Para una palabra exacta: `& F:\Inforepositorios\scripts\Buscar-Todo.ps1 -Texto <término>`.
