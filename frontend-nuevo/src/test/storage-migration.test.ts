import { migrateLegacyStorage } from '../lib/storageMigration';

describe('migración de datos locales a Lyfta', () => {
  beforeEach(() => localStorage.clear());

  it('mueve token, tema, bandera y borradores sin pisar lo nuevo', () => {
    localStorage.setItem('carga.token', 'token-carga');
    localStorage.setItem('pulso.theme', 'light');
    localStorage.setItem('carga.extended', 'true');
    localStorage.setItem('carga.session.u1.t1', '{"version":1}');
    localStorage.setItem('lyfta.extended', 'false');

    migrateLegacyStorage();

    expect(localStorage.getItem('lyfta.token')).toBe('token-carga');
    expect(localStorage.getItem('lyfta.theme')).toBe('light');
    expect(localStorage.getItem('lyfta.extended')).toBe('false');
    expect(localStorage.getItem('lyfta.session.u1.t1')).toBe('{"version":1}');
    expect(localStorage.getItem('carga.token')).toBeNull();
    expect(localStorage.getItem('pulso.theme')).toBeNull();
  });

  it('no toca claves ajenas y es idempotente', () => {
    localStorage.setItem('otra.app', 'se queda');
    localStorage.setItem('pulso.token', 'token-pulso');
    migrateLegacyStorage();
    migrateLegacyStorage();
    expect(localStorage.getItem('lyfta.token')).toBe('token-pulso');
    expect(localStorage.getItem('otra.app')).toBe('se queda');
  });
});
