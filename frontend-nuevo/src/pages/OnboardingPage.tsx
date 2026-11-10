import { useNavigate } from 'react-router-dom';
import { ArrowRight, CalendarCheck, Check, Send, Watch } from 'lucide-react';
import { Button, Card, PageHeader } from '../components/ui';
import { markOnboardingSeen } from '../lib/onboarding';

const PASOS = [
  {
    icono: CalendarCheck,
    texto: '1. Planifica la sesión con el peso de cada serie y su descanso.',
    detalle: 'Aproximación a 60, trabajo a 65 y tope a 70: cada serie con su objetivo.',
  },
  {
    icono: Send,
    texto: '2. Envíalo al reloj Garmin desde la app, sin tocar Garmin Connect.',
    detalle: 'El reloj recibe el entreno y muestra el peso objetivo de cada serie.',
  },
  {
    icono: Check,
    texto: '3. Entrena, guarda la sesión y corrige después los pesos reales.',
    detalle: 'El historial compara lo planificado con lo que levantaste de verdad.',
  },
];

export function OnboardingPage({ onDone }: { onDone?: () => void }) {
  const navigate = useNavigate();

  const empezar = () => {
    markOnboardingSeen();
    onDone?.();
    navigate('/', { replace: true });
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <PageHeader
        title="Cómo funciona"
        description="Lyfta lleva tus entrenamientos de fuerza del plan al reloj y de vuelta al historial."
      />

      <div className="flex flex-col gap-3">
        {PASOS.map((paso) => {
          const Icono = paso.icono;
          return (
            <Card key={paso.texto} className="flex items-start gap-3">
              <span className="mt-0.5 rounded-md bg-accent-soft p-2 text-accent">
                <Icono aria-hidden="true" className="size-5" />
              </span>
              <div>
                <p className="text-body font-semibold text-ink">{paso.texto}</p>
                <p className="mt-1 text-caption text-ink-muted">{paso.detalle}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4">
        <p className="flex items-start gap-2 text-body text-ink">
          <Watch aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />
          <span>
            Necesitas un reloj Garmin compatible (probado con <strong>Forerunner 255</strong>) y
            vincular tu cuenta de Garmin con el 2FA delante la primera vez.
          </span>
        </p>
        <p className="mt-2 text-caption text-ink-muted">
          La app funciona sin conexión una vez instalada: el entrenamiento en curso se guarda en el móvil.
        </p>
      </Card>

      <Button variant="primary" className="mt-4 min-h-12 w-full" onClick={empezar}>
        Empezar
        <ArrowRight aria-hidden="true" className="size-5" />
      </Button>
      <p className="mt-2 text-center text-caption text-ink-faint">
        Puedes volver a ver esta introducción desde Ajustes.
      </p>
    </div>
  );
}
