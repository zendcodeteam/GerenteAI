import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateDeudaProveedorDto } from './create-deuda-proveedor.dto';
import { ModalidadDeudaProveedor, EstadoDeudaProveedor } from '@prisma/client';

async function validar(cuerpo: object) {
  const instancia = plainToInstance(CreateDeudaProveedorDto, cuerpo);
  const errores = await validate(instancia);
  return errores.map((e) => e.property);
}

describe('CreateDeudaProveedorDto - Modelo de datos de deuda con proveedor', () => {
  const payloadBaseValido = {
    proveedorId: 'prov-uuid-1',
    sedeId: 'sede-uuid-1',
    suministro: 'Harina de trigo y levadura',
    montoTotal: 1500000,
    fechaLimite: '2026-12-15T00:00:00.000Z',
    modalidad: ModalidadDeudaProveedor.UNICO,
    aplicaInteres: false,
    estado: EstadoDeudaProveedor.PENDIENTE,
  };

  describe('Criterio 1: Parámetros estructurados', () => {
    it('acepta una deuda estructurada de pago único sin cuotas y sin interés', async () => {
      const errores = await validar(payloadBaseValido);
      expect(errores).toEqual([]);
    });

    it('acepta una deuda estructurada en cuotas con interés y estado específico', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        modalidad: ModalidadDeudaProveedor.CUOTAS,
        numeroCuotas: 6,
        aplicaInteres: true,
        porcentajeInteres: 3.5,
        estado: EstadoDeudaProveedor.PENDIENTE,
      });
      expect(errores).toEqual([]);
    });

    it('exige proveedorId, sedeId, suministro, montoTotal, fechaLimite, modalidad y aplicaInteres', async () => {
      const errores = await validar({});
      expect(errores).toContain('proveedorId');
      expect(errores).toContain('sedeId');
      expect(errores).toContain('suministro');
      expect(errores).toContain('montoTotal');
      expect(errores).toContain('fechaLimite');
      expect(errores).toContain('modalidad');
      expect(errores).toContain('aplicaInteres');
    });
  });

  describe('Criterio 2: Si aplica interés, el porcentaje es obligatorio', () => {
    it('rechaza si aplicaInteres es true y no se envía porcentajeInteres', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        aplicaInteres: true,
      });
      expect(errores).toContain('porcentajeInteres');
    });

    it('rechaza si aplicaInteres es true y porcentajeInteres es null o undefined', async () => {
      const erroresNull = await validar({
        ...payloadBaseValido,
        aplicaInteres: true,
        porcentajeInteres: null,
      });
      expect(erroresNull).toContain('porcentajeInteres');
    });

    it('rechaza si aplicaInteres es true y porcentajeInteres es negativo', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        aplicaInteres: true,
        porcentajeInteres: -2.5,
      });
      expect(errores).toContain('porcentajeInteres');
    });

    it('acepta si aplicaInteres es true y porcentajeInteres es un número válido (incluso 0)', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        aplicaInteres: true,
        porcentajeInteres: 5.0,
      });
      expect(errores).toEqual([]);
    });

    it('acepta si aplicaInteres es false y no se especifica porcentajeInteres', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        aplicaInteres: false,
      });
      expect(errores).toEqual([]);
    });
  });

  describe('Criterio 3: Si es en cuotas, el número de cuotas es obligatorio (>= 2)', () => {
    it('rechaza si modalidad es CUOTAS y numeroCuotas es omitido', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        modalidad: ModalidadDeudaProveedor.CUOTAS,
      });
      expect(errores).toContain('numeroCuotas');
    });

    it('rechaza si modalidad es CUOTAS y numeroCuotas es menor a 2 (ej: 1)', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        modalidad: ModalidadDeudaProveedor.CUOTAS,
        numeroCuotas: 1,
      });
      expect(errores).toContain('numeroCuotas');
    });

    it('rechaza si modalidad es CUOTAS y numeroCuotas es 0 o negativo', async () => {
      const erroresCero = await validar({
        ...payloadBaseValido,
        modalidad: ModalidadDeudaProveedor.CUOTAS,
        numeroCuotas: 0,
      });
      expect(erroresCero).toContain('numeroCuotas');

      const erroresNegativo = await validar({
        ...payloadBaseValido,
        modalidad: ModalidadDeudaProveedor.CUOTAS,
        numeroCuotas: -3,
      });
      expect(erroresNegativo).toContain('numeroCuotas');
    });

    it('acepta si modalidad es CUOTAS y numeroCuotas es 2 (mínimo permitido)', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        modalidad: ModalidadDeudaProveedor.CUOTAS,
        numeroCuotas: 2,
      });
      expect(errores).toEqual([]);
    });

    it('acepta si modalidad es CUOTAS y numeroCuotas es mayor a 2 (ej: 4, 12, 24)', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        modalidad: ModalidadDeudaProveedor.CUOTAS,
        numeroCuotas: 12,
      });
      expect(errores).toEqual([]);
    });

    it('acepta si modalidad es UNICO sin especificar numeroCuotas', async () => {
      const errores = await validar({
        ...payloadBaseValido,
        modalidad: ModalidadDeudaProveedor.UNICO,
      });
      expect(errores).toEqual([]);
    });
  });
});
