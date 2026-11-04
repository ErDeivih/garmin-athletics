import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { installFakeApi, json } from './fakeApi';
import { renderApp } from './renderApp';
import * as f from './fixtures';

const TOKEN_KEY = 'garmin-athletics.token';
const DRAFT_PREFIX = 'garmin-athletics.session';

const apiSesion = () =>
  installFakeApi({
    'GET /api/v1/auth/me': json(f.me),
    'GET /api/v1/strength/templates/t-1': json(f.templates.items[0]),
    'GET /api/v1/strength/last-marks': json(f.lastMarks),
    'POST /api/v1/strength/sessions': json(f.sessionDetail),
  });

describe('registrar una sesión de gimnasio', () => {
  it('precarga la última marca, marca la serie, arranca el descanso y sobrevive a recargar', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    apiSesion();
    const user = userEvent.setup();
    const first = renderApp('/gimnasio/entrenar?template=t-1');

    expect(await screen.findByRole('heading', { name: 'Entrenar' })).toBeInTheDocument();
    expect(await screen.findByText(/anterior: 82,5 kg × 6/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/peso serie 1 de press de banca/i)).toHaveValue('82.5');

    await user.click(screen.getByRole('checkbox', { name: /serie 1 de press de banca/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/descanso/i);
    expect(localStorage.getItem(`${DRAFT_PREFIX}.u-1.t-1`)).toContain('"done":true');

    // Recargar: se desmonta y se vuelve a montar con el mismo almacenamiento.
    first.unmount();
    renderApp('/gimnasio/entrenar?template=t-1');

    const weight = await screen.findByLabelText(/peso serie 1 de press de banca/i);
    expect(weight).toHaveValue('82.5');
    expect(screen.getByRole('checkbox', { name: /serie 1 de press de banca/i })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('status')).toHaveTextContent(/descanso/i);
  });

  it('corrige peso y RPE, termina la sesión y manda las series con Bearer', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    const api = apiSesion();
    const user = userEvent.setup();
    renderApp('/gimnasio/entrenar?template=t-1');

    const weight = await screen.findByLabelText(/peso serie 1 de press de banca/i);
    // Marca primero y corrige después: una serie ya hecha se puede editar sin
    // desmarcarla ni tocar las demás.
    await user.click(screen.getByRole('checkbox', { name: /serie 1 de press de banca/i }));
    await user.clear(weight);
    await user.type(weight, '82,5');
    const repsInput = screen.getByLabelText(/reps serie 1 de press de banca/i);
    await user.clear(repsInput);
    await user.type(repsInput, '8');
    await user.selectOptions(screen.getByLabelText(/rpe serie 1 de press de banca/i), '8');
    expect(screen.getByRole('checkbox', { name: /serie 1 de press de banca/i })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getAllByRole('button', { name: /terminar sesión/i })[0]!);

    expect(await screen.findByRole('heading', { name: /sesión terminada/i })).toBeInTheDocument();
    expect(screen.getAllByText(/660 kg/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/pecho/i)).toBeInTheDocument();
    expect(localStorage.getItem(`${DRAFT_PREFIX}.u-1.t-1`)).toBeNull();

    const created = api.calls.find(
      (call) => call.method === 'POST' && call.path === '/api/v1/strength/sessions',
    );
    expect(created).toBeTruthy();
    expect(created?.headers.authorization ?? created?.headers.Authorization).toBe('Bearer test-token');
    const body = created?.body as { template_id: string; sets: { weight_kg: number; reps: number; rpe: number; set_number: number }[] };
    expect(body.template_id).toBe('t-1');
    expect(body.sets[0]).toMatchObject({ weight_kg: 82.5, reps: 8, rpe: 8, set_number: 1 });
  });

  it('sin plantilla explica qué hacer en vez de abrir una sesión vacía', async () => {
    localStorage.setItem(TOKEN_KEY, 'test-token');
    installFakeApi({ 'GET /api/v1/auth/me': json(f.me) });
    renderApp('/gimnasio/entrenar');

    expect(await screen.findByText(/sin plantilla seleccionada/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /ir a gimnasio/i })).toBeInTheDocument();
  });
});
