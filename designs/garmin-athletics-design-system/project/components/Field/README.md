# Field

Campo de formulario con etiqueta visible, input de 44 px, ayuda y error. La etiqueta no desaparece nunca.

## Usa

- `ga-field__label` siempre visible, asociada con `for`/`id`.
- `ga-field__hint` para el formato esperado («kg, con decimales si hace falta»).
- `ga-field--invalid` + `ga-field__error` cuando falla la validación; el error se anuncia con `aria-describedby` y el foco vuelve al campo.
- En el gimnasio, el input numérico usa `inputmode="decimal"` y botones de incremento de 44 px a los lados.

## No uses

- Placeholder como etiqueta: desaparece al escribir.
- Borde rojo sin texto de error.
- Un error que sustituya la ayuda: ambos pueden convivir.
