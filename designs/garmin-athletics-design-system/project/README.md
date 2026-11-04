# Garmin Athletics — sistema de diseño

Panel de disposición y registro de fuerza para un atleta. Oscuro por defecto, datos primero, una mano en el gimnasio. El sistema existe para que dos pantallas distintas parezcan la misma app: mismos tokens, mismas escalas, mismos estados.

## Voz

- Habla claro y corto. «Sincroniza», «Empieza la sesión», «Faltan 3 sesiones». Nada de «¡Vamos allá!» ni de bienvenidas.
- Tutea al atleta. Los datos personales se nombran sin adornos: «FC en reposo», «Body Battery», «Tonelaje».
- Sin emoji. Sin signos de exclamación. Sin promesas que el dato no respalde: si no hay dato, se dice «sin dato», no se pinta un cero.
- Cifras siempre con unidad y con el mismo formato: kg (una decimal cuando toca), minutos enteros, fechas `DD MMM`. El atleta no debería aprender dos formatos para el mismo número.

## Color

Dos temas, mismo contrato: el tema oscuro es el primario y el claro hereda la misma estructura. El color nunca decora: significa.

- `bg` es el fondo de pantalla; `surface` para tarjetas; `raised` para lo que está por encima (inputs, menús, filas con hover).
- `ink` para el texto principal, `ink-muted` para lo secundario, `ink-faint` para metadatos. Los tres son AA sobre `bg`, `surface` y `raised` en los dos temas.
- `accent` es la señal de marca: enlaces, navegación activa, foco y relleno del botón primario. Sobre relleno de `accent` se escribe `on-accent`, nunca blanco ni negro a ojo.
- `success` / `warn` / `danger` / `info` son estados de salud y de sistema (readiness VERDE/AMARILLO/ROJO, avisos, errores). No se usan para decorar tarjetas ni para «dar alegría». Cada estado lleva siempre palabra además de color.
- `line` es una hairline decorativa. `line-strong` es la frontera de un control y cumple 3:1 en los dos temas.
- El contraste AA está calculado, no estimado: `frontend-nuevo/scripts/check-contrast.mjs` comprueba los pares declarados aquí y falla si alguno baja de 4.5:1 (3:1 para marcas y bordes).

## Tipografía

Dos familias, cinco pasos tipográficos. Todo lo que es número usa `hero` o `title` de la familia display con cifras tabulares: el dígito no debe bailar.

- `hero` (Barlow Condensed 700, 48/48): una sola cifra por pantalla, la que importa. Readiness, tonelaje, series de la sesión.
- `title` (Barlow Condensed 700, 28/32): el título de la pantalla. Nunca dos títulos de este tamaño en la misma vista.
- `heading` (Barlow 600, 18/24): título de tarjeta y de sección.
- `body` (Barlow 400, 15/22): párrafo, etiqueta, botón, fila.
- `caption` (Barlow 500, 12/16, `0.02em`): micro-etiqueta en mayúsculas, unidad, hora, eje. Nunca párrafos largos.

No hay tamaños intermedios: si algo no encaja, se elige el más cercano o se quita.

Las dos familias (Barlow y Barlow Condensed) se distribuyen con **SIL Open Font License 1.1** y llegan al proyecto vía `@fontsource`; los ficheros `woff2` están en `fonts/`.

## Espaciado, radios y sombras

- Escala `4 / 8 / 12 / 16 / 24 / 32 / 48`. El `16` es el padding de tarjeta y el margen lateral de la pantalla a 400 px.
- Radios `6 / 10 / 16 / 9999`: controles pequeños, tarjetas, hojas, y solo puntos de estado o avatares con el completo.
- Dos elevaciones (`shadow-sm` para reposo, `shadow-lg` para lo que flota). El foco es un anillo sólido de 2 px de `accent` separado 2 px del control; se aplica con `:focus-visible` y nunca se quita.
- Ningún control táctil mide menos de 44 × 44 px. Los objetivos principales, 48 px.

## Movimiento

- 120 ms para cambios de estado pequeños (hover, activo, aparición de un aviso); 220 ms para abrir una hoja o desplegar un resumen. Nada más largo.
- La animación explica un cambio, no lo decora. Sin rebotes, sin giros.
- `prefers-reduced-motion: reduce` desactiva toda transición no esencial: el interfaz tiene que ser igual de usable y de inmediato sin movimiento.
- El temporizador de descanso no es una animación decorativa: es una cuenta que se lee de un vistazo, con el número estable.

## Iconografía

- `lucide-react` como único juego de iconos, trazo 1.75, tamaños 20 y 24 px. Un icono hereda el color del texto que acompaña (`currentColor`).
- Todo icono con significado va con etiqueta o `aria-label`; ninguno es la única señal de una acción.
- No hay logotipo: la marca se escribe en tipografía, `title` o `hero`, y no se reconstruye ningún símbolo de Garmin ni de otra app. Si algún día entra un logo, entra como asset propio con su licencia.

## Fundamentos de las pantallas

- Una métrica héroe por pantalla y 3-4 secundarias en tarjetas. La tarjeta cuenta una idea: etiqueta, número, unidad, delta y una frase de contexto.
- Cuatro estados en toda pantalla que lee datos: vacío (explica qué falta y qué hacer), cargando (silueta del contenido, no spinner infinito), error (qué falló y botón de reintento) y sin permiso (qué credencial falta). Un cero nunca sustituye a un vacío.
- Fecha, origen y frescura del dato visibles cuando el dato puede estar viejo: «sincronizado hace 2 min».
- Móvil real a 400 px: una columna, sin scroll horizontal, acciones al alcance del pulgar. Escritorio: contenido centrado a 960 px como máximo.

## Componentes

- `Button` — acción primaria, secundaria, fantasma y destructiva. Altura 44 px; el destructivo nunca es la acción primaria de una pantalla.
- `StatCard` — la tarjeta de dato: etiqueta, cifra, unidad, delta y pie. Es la unidad del panel «Hoy».
- `Badge` — estado de una palabra con punto de color; siempre lleva texto.
- `Field` — etiqueta visible, input de 44 px, ayuda y error debajo. El error no sustituye a la etiqueta.

Los consume `frontend-nuevo`; sus valores salen de `tokens.json` (una sola fuente, `npm run tokens` en el frontend).
