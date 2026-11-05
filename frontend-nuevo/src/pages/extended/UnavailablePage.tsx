import { Link } from 'react-router-dom';
import { Lock } from 'lucide-react';
import { PageHeader } from '../../components/ui';

export function UnavailablePage() {
  return (
    <>
      <PageHeader title="Sección no disponible" description="Actívala para verla." />
      <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong bg-surface p-4">
        <Lock aria-hidden="true" className="size-6 text-ink-faint" />
        <p className="max-w-prose text-body text-ink-muted">
          Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social se activan desde Ajustes.
        </p>
        <Link to="/ajustes" className="text-body font-semibold text-accent underline">
          Ir a Ajustes
        </Link>
      </div>
    </>
  );
}
