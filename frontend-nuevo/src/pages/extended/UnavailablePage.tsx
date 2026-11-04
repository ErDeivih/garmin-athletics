import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { PageHeader } from '../../components/ui';

/** Se pide una ruta ampliada sin la bandera: no se abre por la puerta de atrás. */
export function UnavailablePage() {
  return (
    <>
      <PageHeader title="Sección no disponible" description="Esta pantalla existe, pero la bandera está apagada." />
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong bg-surface p-6">
        <Lock aria-hidden="true" className="size-6 text-ink-faint" />
        <p className="max-w-prose text-body text-ink-muted">
          Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social se encienden desde Ajustes. No se
          muestran por defecto para que el primer arranque sea Hoy, Gimnasio y Ajustes, como se decidió.
        </p>
        <Link to="/ajustes" className="text-body font-semibold text-accent underline">
          Ir a Ajustes para activarlas
        </Link>
      </div>
    </>
  );
}
