# Button

La acción de una pantalla, en cuatro intenciones. Altura mínima 44 px, texto en `body` 600, foco siempre visible con `focus-ring`.

## Usa

- `ga-btn ga-btn--primary` para la acción que el atleta viene a hacer: «Empezar sesión», «Guardar», «Iniciar sesión». Una sola por pantalla.
- `ga-btn ga-btn--secondary` para la alternativa: «Cancelar», «Buscar», «Elegir plantilla». Borde `line-strong`, no `line`.
- `ga-btn ga-btn--ghost` para acciones terciarias dentro de una cabecera o una fila («Ver historial»).
- `ga-btn ga-btn--danger` para lo irreversible («Borrar sesión», «Desvincular Garmin»). Nunca es la acción primaria de la pantalla y siempre pide confirmación.

## No uses

- Dos primarios juntos: compiten y el atleta duda.
- Un botón como enlace de navegación: para navegar, un enlace.
- Texto que no quepa en una línea en móvil: el botón crece a 48 px de alto, no parte el texto.
- El estado deshabilitado como sustituto de explicar qué falta: si el botón no se puede usar, se dice por qué al lado.

## Accesibilidad

- `aria-label` cuando el texto no está visible; el icono nunca va solo.
- No se quita el anillo de foco. En `prefers-reduced-motion` se mantiene igual: el foco no es animación.
