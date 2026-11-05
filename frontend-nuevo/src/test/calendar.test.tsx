import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'pulso.token';
const FLAG_KEY = 'pulso.extended';

const today = new Date();
const localIso = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const todayIso = localIso(today);
const weekday = (today.getDay() + 6) % 7;

const day = (date: string, events: unknown[] = []) => ({
  date,
  events,
  activities: [],
  readiness: null,
});

const calendar = {
  from: todayIso,
  to: todayIso,
  days: Array.from({ length: 14 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    return day(localIso(date));
  }),
};

const templates = { ...f.templates, items: [{ ...f.templates.items[0], weekday }] };

describe('calendario de entrenamientos', () => {
  it('programa una plantilla en un día y la deja lista para el reloj', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    localStorage.setItem(FLAG_KEY, 'true');
    let created = false;
    const api = installFakeApi({
      'GET /api/v1/auth/me': json(f.me),
      'GET /api/v1/strength/templates': json(templates),
      'GET /api/v1/calendar': () =>
        json({
          ...calendar,
          days: calendar.days.map((item, index) =>
            index === 0 && created
              ? { ...item, events: [{
                  id: 'ev-1',
                  title: 'Empuje A',
                  event_type: 'strength',
                  start: `${todayIso}T18:00:00`,
                  duration_min: 60,
                  weekday,
                  template_id: 't-1',
                  is_immovable: false,
                  notes: null,
                }] }
              : item,
          ),
        }),
      'POST /api/v1/calendar/events': () => {
        created = true;
        return json({ status: 'created', id: 'ev-1' }, 201);
      },
    });
    const user = userEvent.setup();
    renderApp('/calendario');

    expect(await screen.findByRole('heading', { name: 'Calendario' })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText(/plantilla/i), 't-1');
    await user.click(screen.getByRole('button', { name: /^programar$/i }));

    expect(await screen.findByText(/entrenamiento semanal guardado/i)).toBeInTheDocument();
    expect(await screen.findByText(/ · empuje a$/i)).toBeInTheDocument();
    const call = api.calls.find((item) => item.method === 'POST' && item.path === '/api/v1/calendar/events');
    const body = typeof call?.body === 'string' ? JSON.parse(call.body) : call?.body;
    expect(body).toMatchObject({ template_id: 't-1', weekday, event_type: 'strength' });
  });
});
