import { NavLink, Outlet } from 'react-router-dom';
import { EXTENDED_NAV, PRIMARY_NAV, type NavItem } from '../config/navigation';
import { useExtendedSections } from '../config/features';
import { useMediaQuery } from '../lib/useMediaQuery';
import { useAuth } from '../auth/AuthContext';

const linkBase =
  'focus-ring flex min-h-11 items-center gap-2 rounded-md px-3 text-body transition-colors';

function linkClass(active: boolean, tone: 'desktop' | 'mobile'): string {
  if (tone === 'mobile') {
    return `${linkBase} flex-1 flex-col justify-center gap-1 py-1 text-caption ${
      active ? 'text-accent' : 'text-ink-muted hover:text-ink'
    }`;
  }
  return `${linkBase} ${active ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-raised hover:text-ink'}`;
}

function NavItemLink({ item, tone }: { item: NavItem; tone: 'desktop' | 'mobile' }) {
  const Icon = item.icon;
  return (
    <NavLink to={item.path} end={item.path === '/'} className={({ isActive }) => linkClass(isActive, tone)}>
      <Icon aria-hidden="true" className={tone === 'mobile' ? 'size-5' : 'size-5'} />
      <span>{item.label}</span>
    </NavLink>
  );
}

function Brand() {
  return (
    <div className="flex items-baseline gap-2">
      <span className="font-display text-title font-bold uppercase tracking-wide text-ink">Garmin</span>
      <span className="text-caption uppercase tracking-widest text-accent">Athletics</span>
    </div>
  );
}

function UserChip() {
  const { user } = useAuth();
  const initial = (user?.display_name ?? user?.username ?? '?').trim().charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-raised px-3 py-2">
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-full bg-accent-soft text-caption font-semibold text-accent"
      >
        {initial}
      </span>
      <span className="min-w-0">
        <span className="block truncate text-body text-ink">{user?.display_name ?? 'Atleta'}</span>
        <span className="block truncate text-caption text-ink-faint">{user?.email ?? ''}</span>
      </span>
    </div>
  );
}

/** Marco común: barra lateral en escritorio, pestañas abajo en móvil. */
export function AppShell() {
  const extended = useExtendedSections();
  const isDesktop = useMediaQuery('(min-width: 1024px)');

  return (
    <div className="min-h-dvh bg-bg text-ink">
      {isDesktop ? (
        <aside className="fixed inset-y-0 left-0 flex w-[var(--ga-space-sidebar)] flex-col gap-6 border-r border-line bg-surface px-3 py-6">
          <div className="px-2">
            <Brand />
          </div>
          <nav aria-label="Secciones" className="flex flex-col gap-1">
            {PRIMARY_NAV.map((item) => (
              <NavItemLink key={item.id} item={item} tone="desktop" />
            ))}
          </nav>
          {extended ? (
            <nav aria-label="Secciones ampliadas" className="flex flex-col gap-1">
              <span className="px-3 text-caption uppercase tracking-widest text-ink-faint">Ampliado</span>
              {EXTENDED_NAV.map((item) => (
                <NavItemLink key={item.id} item={item} tone="desktop" />
              ))}
            </nav>
          ) : (
            <p className="px-3 text-caption text-ink-faint">
              Actividades, Calendario, Tendencias, Rendimiento, Rutas y Social se encienden en Ajustes.
            </p>
          )}
          <div className="mt-auto">
            <UserChip />
          </div>
        </aside>
      ) : null}

      <div className={isDesktop ? 'pl-[var(--ga-space-sidebar)]' : ''}>
        {!isDesktop ? (
          <header className="sticky top-0 z-20 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur">
            <Brand />
          </header>
        ) : null}

        {!isDesktop && extended ? (
          <nav
            aria-label="Secciones ampliadas"
            className="flex gap-2 overflow-x-auto border-b border-line bg-surface px-4 py-2"
          >
            {EXTENDED_NAV.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) =>
                    `focus-ring flex min-h-11 shrink-0 items-center gap-1 rounded-full border px-3 py-1 text-caption ${
                      isActive
                        ? 'border-accent bg-accent-soft text-accent'
                        : 'border-line-strong text-ink-muted hover:text-ink'
                    }`
                  }
                >
                  <Icon aria-hidden="true" className="size-4" />
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        ) : null}

        <main className="mx-auto w-full max-w-[var(--ga-space-content)] px-4 py-6 pb-[var(--ga-space-bottom-nav)] lg:px-8 lg:py-8 lg:pb-8">
          <Outlet />
        </main>
      </div>

      {!isDesktop ? (
        <nav
          aria-label="Navegación principal"
          className="fixed inset-x-0 bottom-0 z-20 flex border-t border-line bg-surface px-2 pb-[env(safe-area-inset-bottom)]"
        >
          {PRIMARY_NAV.map((item) => (
            <NavItemLink key={item.id} item={item} tone="mobile" />
          ))}
        </nav>
      ) : null}
    </div>
  );
}
