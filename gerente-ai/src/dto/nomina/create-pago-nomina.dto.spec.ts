import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreatePagoNominaDto } from './create-pago-nomina.dto';

describe('CreatePagoNominaDto', () => {
  const baseValido = {
    nombreTrabajador: 'Carlos Pérez',
    porcentajePago: 50,
    montoExacto: 1200000,
    sedeId: 'sede-uuid-1',
  };

  it('debe aceptar un pago de nómina completo y válido', async () => {
    const dto = plainToInstance(CreatePagoNominaDto, baseValido);
    const errores = await validate(dto);
    expect(errores.length).toBe(0);
  });

  it('debe aceptar fechaPago en formato ISO válido', async () => {
    const dto = plainToInstance(CreatePagoNominaDto, {
      ...baseValido,
      fechaPago: '2026-11-04T12:00:00.000Z',
    });
    const errores = await validate(dto);
    expect(errores.length).toBe(0);
  });

  describe('Criterio 1: Los 3 campos de la especificación son obligatorios', () => {
    it('debe rechazar si falta el nombre del trabajador', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        nombreTrabajador: undefined,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'nombreTrabajador')).toBe(true);
    });

    it('debe rechazar si el nombre del trabajador está vacío', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        nombreTrabajador: '   ',
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'nombreTrabajador')).toBe(true);
    });

    it('debe rechazar si falta el porcentaje de pago', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        porcentajePago: undefined,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'porcentajePago')).toBe(true);
    });

    it('debe rechazar si falta el monto exacto', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        montoExacto: undefined,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'montoExacto')).toBe(true);
    });
  });

  describe('Criterio 2: Porcentaje entre 0 y 100; monto > 0', () => {
    it('debe permitir porcentaje de pago igual a 0', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        porcentajePago: 0,
      });
      const errores = await validate(dto);
      expect(errores.length).toBe(0);
    });

    it('debe permitir porcentaje de pago igual a 100', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        porcentajePago: 100,
      });
      const errores = await validate(dto);
      expect(errores.length).toBe(0);
    });

    it('debe rechazar porcentaje de pago menor a 0', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        porcentajePago: -0.01,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'porcentajePago')).toBe(true);
    });

    it('debe rechazar porcentaje de pago mayor a 100', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        porcentajePago: 100.01,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'porcentajePago')).toBe(true);
    });

    it('debe rechazar monto exacto igual a 0', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        montoExacto: 0,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'montoExacto')).toBe(true);
    });

    it('debe rechazar monto exacto negativo', async () => {
      const dto = plainToInstance(CreatePagoNominaDto, {
        ...baseValido,
        montoExacto: -150000,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'montoExacto')).toBe(true);
    });
  });
});
