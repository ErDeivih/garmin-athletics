import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

/** Monta la app entera con un router en memoria y una caché de consultas limpia. */
/**
 * Monta la app entera con un router en memoria y una caché de consultas limpia.
 * `onboarding: false` deja la introducción pendiente (solo para su prueba).
 */
export function renderApp(initialEntry = '/', { onboarding = true }: { onboarding?: boolean } = {}) {
  if (onboarding) {
    // En el resto de pruebas la introducción ya está vista: se entra al panel.
    try {
      window.localStorage.setItem('lyfta.onboarding', 'visto');
    } catch {
      // sin almacenamiento en el entorno de pruebas
    }
  }
  const queryClient = new QueryClient({
    defaultOptions: {
      // Mismos valores que la app: staleTime 30 s hace visible un fallo de
      // aislamiento de caché entre usuarios (si no se limpia, no hay refetch).
      queries: { retry: false, gcTime: 0, staleTime: 30_000 },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
