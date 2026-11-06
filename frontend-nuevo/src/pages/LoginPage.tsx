import { NOMBRE_APP } from '../config/marca';
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { Button, Field } from '../components/ui';

/** La única puerta de entrada. No hay registro en la app: la cuenta se crea en la API. */
export function LoginPage() {
  const { login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await login(email.trim(), password);
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo entrar.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 py-10 text-ink">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-baseline gap-2">
          <span className="font-display text-title font-bold uppercase tracking-wide">{NOMBRE_APP}</span>
          <span className="text-caption uppercase tracking-widest text-accent">Entrena</span>
        </div>
        <h1 className="mb-2 font-display text-title uppercase tracking-wide">Entra en {NOMBRE_APP}</h1>
        <p className="mb-6 text-body text-ink-muted">
          Tu entrenamiento y su análisis, en un solo sitio.
        </p>
        {sessionExpired ? (
          <p role="status" className="mb-4 rounded-md border border-warn bg-warn-soft px-3 py-2 text-body text-warn">
            La sesión ha caducado. Vuelve a entrar para seguir donde estabas.
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field
            id="email"
            label="Correo"
            type="email"
            autoComplete="username"
            inputMode="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Field
            id="password"
            label="Contraseña"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          {error ? (
            <p role="alert" className="rounded-md border border-danger bg-danger-soft px-3 py-2 text-body text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" variant="primary" disabled={pending || email.length === 0 || password.length === 0}>
            {pending ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>
      </div>
    </div>
  );
}
