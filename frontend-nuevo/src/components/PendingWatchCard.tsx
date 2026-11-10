import { Card, SectionTitle } from './ui';

/**
 * Aviso temporal: la app ya envía el entreno, pero no está comprobada en el
 * reloj físico. Se pinta como tarjeta visible en el gimnasio, no como mensaje
 * escondido, porque es la única cosa que impide dar el flujo por cerrado.
 *
 * Se apaga con `AVISO_RELOJ_REAL = false` en `config/features.ts` cuando la
 * prueba física esté hecha (WALL.md, `PENDIENTE-PRUEBA-RELOJ.md`).
 */
export function PendingWatchCard() {
  return (
    <section aria-label="Reloj real pendiente" className="mt-3">
      <Card className="border-accent/40 bg-accent-soft/30">
        <SectionTitle hint="pendiente">Reloj real</SectionTitle>
        <p className="text-body text-ink">
          La app ya envía el entreno, pero todavía no está probado en un Forerunner 255.
        </p>
        <ol className="mt-2 flex flex-col gap-1 text-caption text-ink-muted">
          <li>1. Reloj cargado, emparejado y sincronizado en Garmin Connect.</li>
          <li>2. Código 2FA de Garmin delante la primera vez que vincules la cuenta.</li>
          <li>3. «Enviar al reloj», abrir el entreno en el reloj y hacer una serie.</li>
        </ol>
      </Card>
    </section>
  );
}
