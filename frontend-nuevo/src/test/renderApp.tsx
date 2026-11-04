import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AppRoutes } from '../App';

/** Monta la app entera con un router en memoria y una caché de consultas limpia. */
export function renderApp(initialEntry = '/') {
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
