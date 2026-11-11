import { repartirDiscos } from '../lib/discos';

describe('calculadora de discos', () => {
  it('reparte pesos redondos por lado con barra de 20 kg', () => {
    expect(repartirDiscos(60).porLado).toEqual([20]);
    expect(repartirDiscos(60).texto).toBe('20 por lado');
    expect(repartirDiscos(100).porLado).toEqual([25, 15]);
    expect(repartirDiscos(65).porLado).toEqual([20, 2.5]);
  });

  it('usa los discos pequeños para pesos con decimales', () => {
    expect(repartirDiscos(62.5).porLado).toEqual([20, 1.25]);
    expect(repartirDiscos(61).porLado).toEqual([20, 0.5]);
    expect(repartirDiscos(60.5).porLado).toEqual([20, 0.25]);
  });

  it('avisa cuando el inventario no llega al objetivo', () => {
    const reparto = repartirDiscos(60, 20, [25, 20, 10]);
    expect(reparto.porLado).toEqual([20]);
    expect(reparto.restoPorLadoKg).toBe(0);
    expect(reparto.alcanzableKg).toBe(60);

    const corto = repartirDiscos(60, 25, [10]);
    expect(corto.porLado).toEqual([10]);
    expect(corto.restoPorLadoKg).toBe(7.5);
    expect(corto.alcanzableKg).toBe(45);
    expect(corto.texto).toContain('faltan 7.5 kg por lado');
  });

  it('cubre la barra, el caso sin peso y el peso menor que la barra', () => {
    expect(repartirDiscos(20).texto).toBe('Solo barra (20 kg)');
    expect(repartirDiscos(0).texto).toBe('Sin peso objetivo');
    expect(repartirDiscos(15).texto).toContain('Menos que la barra');
  });
});
