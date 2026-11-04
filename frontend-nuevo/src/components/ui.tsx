import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw } from 'lucide-react';

/* Primitivas de la interfaz. Los valores salen de los tokens del sistema de
 * diseño (src/styles/tokens.generated.css): ni un color ni un tamaño se
 * inventan en la pantalla. */

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: 'bg-accent text-on-accent hover:brightness-110',
  secondary: 'bg-raised border border-line-strong text-ink hover:border-accent',
  ghost: 'text-ink-muted hover:text-ink hover:bg-raised',
  danger: 'bg-danger-soft border border-danger text-danger hover:brightness-110',
};

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return (
    <button
      type={type}
      className={`focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-body font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${BUTTON_STYLES[variant]} ${className}`}
      {...props}
    />
  );
}

type Tone = 'go' | 'warn' | 'stop' | 'info' | 'idle';

const TONE_STYLES: Record<Tone, string> = {
  go: 'bg-success-soft text-success',
  warn: 'bg-warn-soft text-warn',
  stop: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  idle: 'bg-raised text-ink-muted',
};

export function Badge({ tone = 'idle', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold uppercase tracking-wider ${TONE_STYLES[tone]}`}
    >
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag className={`rounded-lg border border-line bg-surface p-4 shadow-sm ${className}`}>{children}</Tag>
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-title font-display uppercase tracking-wide text-ink">{title}</h1>
        {description ? <p className="mt-1 text-body text-ink-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  label,
  value,
  unit,
  delta,
  deltaTone = 'muted',
  foot,
  hero = false,
}: {
  label: string;
  value: string | number;
  unit?: string;
  delta?: string;
  deltaTone?: 'up' | 'down' | 'muted';
  foot?: string;
  hero?: boolean;
}) {
  const deltaClass =
    deltaTone === 'up' ? 'text-success' : deltaTone === 'down' ? 'text-danger' : 'text-ink-muted';
  return (
    <article
      className={`flex flex-col gap-2 rounded-lg border bg-surface p-4 shadow-sm ${hero ? 'border-line-strong' : 'border-line'}`}
    >
      <span className="text-caption uppercase tracking-wider text-ink-muted">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className="tnum font-display text-hero font-bold text-ink">{value}</span>
        {unit ? <span className="text-caption text-ink-muted">{unit}</span> : null}
      </span>
      {delta ? <span className={`text-caption ${deltaClass}`}>{delta}</span> : null}
      {foot ? <span className="text-caption text-ink-faint">{foot}</span> : null}
    </article>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-line-strong bg-surface p-6">
      <Inbox aria-hidden="true" className="size-6 text-ink-faint" />
      <h2 className="text-heading text-ink">{title}</h2>
      <p className="max-w-prose text-body text-ink-muted">{description}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-3 rounded-lg border border-danger bg-danger-soft p-4">
      <div className="flex items-center gap-2 text-danger">
        <AlertTriangle aria-hidden="true" className="size-5" />
        <h2 className="text-heading">No se han podido cargar los datos</h2>
      </div>
      <p className="text-body text-ink">{message}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="size-4" />
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div role="status" aria-busy="true" className="space-y-3">
      <span className="sr-only">{label}</span>
      <div className="h-6 w-40 animate-pulse rounded-sm bg-raised" />
      <div className="h-24 w-full animate-pulse rounded-lg bg-raised" />
      <div className="h-24 w-full animate-pulse rounded-lg bg-raised" />
    </div>
  );
}

export function SectionTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <h2 className="text-heading text-ink">{children}</h2>
      {hint ? <span className="text-caption text-ink-faint">{hint}</span> : null}
    </div>
  );
}

export function Field({
  label,
  hint,
  error,
  id,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  const describedBy = [hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ');
  return (
    <div className={`flex flex-col gap-2 ${error ? 'text-danger' : ''}`}>
      <label htmlFor={id} className="text-body font-semibold text-ink">
        {label}
      </label>
      <input
        id={id}
        aria-describedby={describedBy || undefined}
        aria-invalid={error ? true : undefined}
        className={`focus-ring min-h-11 rounded-md border bg-raised px-3 text-body text-ink placeholder:text-ink-faint ${error ? 'border-danger' : 'border-line-strong'}`}
        {...props}
      />
      {hint ? (
        <span id={`${id}-hint`} className="text-caption text-ink-faint">
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${id}-error`} className="text-caption text-danger">
          {error}
        </span>
      ) : null}
    </div>
  );
}
