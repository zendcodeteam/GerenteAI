import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateProductoDto } from './create-producto.dto';

describe('CreateProductoDto', () => {
  const baseValido = {
    nombre: 'Arroz Diana 1kg',
    categoria: 'Abarrotes',
    precioCompra: 3500,
    precioVenta: 4200,
    stock: 20,
    sedeId: 'sede-uuid-1',
  };

  it('debe aceptar un producto completo con datos válidos', async () => {
    const dto = plainToInstance(CreateProductoDto, baseValido);
    const errores = await validate(dto);
    expect(errores.length).toBe(0);
  });

  it('debe aceptar cantidad y costoCompra como alias válidos', async () => {
    const dto = plainToInstance(CreateProductoDto, {
      nombre: 'Aceite Premier 1L',
      categoria: 'Abarrotes',
      costoCompra: 9000,
      precioVenta: 11500,
      cantidad: 15,
      sedeId: 'sede-uuid-1',
    });
    const errores = await validate(dto);
    expect(errores.length).toBe(0);
  });

  describe('Criterio 1: Los 4 campos son obligatorios; no se guarda un producto incompleto', () => {
    it('debe fallar si falta el nombre', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        nombre: undefined,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'nombre')).toBe(true);
    });

    it('debe fallar si el nombre está vacío', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        nombre: '   ',
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'nombre')).toBe(true);
    });

    it('debe fallar si falta la categoría', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        categoria: undefined,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'categoria')).toBe(true);
    });

    it('debe fallar si la categoría está vacía', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        categoria: '   ',
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'categoria')).toBe(true);
    });

    it('debe fallar si falta el costo de compra (precioCompra y costoCompra ausentes)', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        precioCompra: undefined,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'precioCompra')).toBe(true);
    });

    it('debe fallar si falta el precio de venta', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        precioVenta: undefined,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'precioVenta')).toBe(true);
    });
  });

  describe('Criterio 2: Cantidad entera >= 0; costo y precio numéricos > 0', () => {
    it('debe permitir stock / cantidad igual a 0', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        stock: 0,
      });
      const errores = await validate(dto);
      expect(errores.length).toBe(0);
    });

    it('debe rechazar cantidad/stock negativo', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        stock: -1,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'stock')).toBe(true);
    });

    it('debe rechazar cantidad no entera (decimal)', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        stock: 3.5,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'stock')).toBe(true);
    });

    it('debe rechazar alias cantidad negativo', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        cantidad: -5,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'cantidad')).toBe(true);
    });

    it('debe rechazar costo de compra igual a 0', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        precioCompra: 0,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'precioCompra')).toBe(true);
    });

    it('debe rechazar costo de compra negativo', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        precioCompra: -100,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'precioCompra')).toBe(true);
    });

    it('debe rechazar precio de venta igual a 0', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        precioVenta: 0,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'precioVenta')).toBe(true);
    });

    it('debe rechazar precio de venta negativo', async () => {
      const dto = plainToInstance(CreateProductoDto, {
        ...baseValido,
        precioVenta: -50,
      });
      const errores = await validate(dto);
      expect(errores.some((e) => e.property === 'precioVenta')).toBe(true);
    });
  });
});
