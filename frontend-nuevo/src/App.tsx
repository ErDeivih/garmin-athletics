import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Link, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { useExtendedSections } from './config/features';
import { NAV_ITEMS } from './config/navigation';
import { AppShell } from './components/AppShell';
import { ErrorState, LoadingBlock, PageHeader } from './components/ui';
import { LoginPage } from './pages/LoginPage';
import { SessionPage } from './pages/SessionPage';
import { CatalogPage } from './pages/extended/CatalogPage';
import { UnavailablePage } from './pages/extended/UnavailablePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

function BootScreen() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 text-ink">
      <div className="w-full max-w-sm">
        <p className="mb-6 flex items-baseline gap-2">
          <span className="font-display text-title font-bold uppercase tracking-wide">Garmin</span>
          <span className="text-caption uppercase tracking-widest text-accent">Athletics</span>
        </p>
        <LoadingBlock label="Comprobando la sesión" />
      </div>
    </div>
  );
}

function BootError({ message, onRetry }: { message: string | null; onRetry: () => void }) {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-4 text-ink">
      <div className="w-full max-w-md">
        <ErrorState message={message ?? 'No se pudo comprobar la sesión.'} onRetry={onRetry} />
      </div>
    </div>
  );
}

function Gate({ enabled, children }: { enabled: boolean; children: React.ReactNode }) {
  return enabled ? <>{children}</> : <UnavailablePage />;
}

function NotFoundPage() {
  return (
    <>
      <PageHeader title="Página no encontrada" description="Esa dirección no existe en esta app." />
      <Link to="/" className="text-body font-semibold text-accent underline">
        Volver a Hoy
      </Link>
    </>
  );
}

/** Rutas sin proveedores: así las pruebas las montan con su propio router y caché. */
export function AppRoutes() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}

function AuthGate() {
  const auth = useAuth();
  const extended = useExtendedSections();

  if (auth.status === 'loading') return <BootScreen />;
  if (auth.status === 'error') return <BootError message={auth.error} onRetry={auth.retry} />;
  if (auth.status === 'anonymous') return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppShell />}>
        {NAV_ITEMS.map((item) => {
          const screen = createElement(item.element);
          const element = item.flag === 'extended' ? <Gate enabled={extended}>{screen}</Gate> : screen;
          return item.path === '/' ? (
            <Route key={item.id} index element={element} />
          ) : (
            <Route key={item.id} path={item.path.replace(/^\//, '')} element={element} />
          );
        })}
        <Route path="gimnasio/entrenar" element={<SessionPage />} />
        <Route path="gimnasio/catalogo" element={<CatalogPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
