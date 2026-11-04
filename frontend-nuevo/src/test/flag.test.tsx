import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'garmin-athletics.token';
const FLAG_KEY = 'garmin-athletics.extended';

const apiConSesión = () =>
  installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/metrics/daily': json(f.daily),
    'GET /api/v1/alerts': json(f.alerts),
    'GET /api/v1/sync/status': json(f.syncStatus),
    'GET /api/v1/activities': json(f.activities, 200, { 'X-Total-Count': '1' }),
  });

describe('secciones ampliadas detrás de bandera', () => {
  it('están ocultas por defecto y aparecen al encender la bandera en Ajustes', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiConSesión();
    const user = userEvent.setup();
    renderApp('/');

    expect(await screen.findByRole('heading', { name: 'Hoy' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Actividades' })).toBeNull();

    await user.click(screen.getByRole('link', { name: 'Ajustes' }));
    await user.click(await screen.findByRole('checkbox', { name: /secciones ampliadas/i }));

    expect(await screen.findByRole('link', { name: 'Actividades' })).toBeInTheDocument();
    expect(localStorage.getItem(FLAG_KEY)).toBe('true');

    await user.click(screen.getByRole('link', { name: 'Actividades' }));
    expect(await screen.findByRole('heading', { name: 'Actividades' })).toBeInTheDocument();
    expect(await screen.findByText('Rodaje suave')).toBeInTheDocument();
  });

  it('una ruta ampliada sin la bandera encendida no se abre a escondidas', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiConSesión();
    renderApp('/actividades');

    expect(await screen.findByRole('heading', { name: /sección no disponible/i })).toBeInTheDocument();
  });
});
