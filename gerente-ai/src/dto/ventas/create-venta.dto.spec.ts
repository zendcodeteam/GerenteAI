import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateVentaDto } from './create-venta.dto';

describe('CreateVentaDto · plazo del fiado', () => {
  const dtoConPlazo = (diasCredito: number) =>
    plainToInstance(CreateVentaDto, {
      sedeId: 'sede-1',
      tipo: 'FIADO',
      clienteId: 'cliente-1',
      diasCredito,
      detalles: [{ productoId: 'producto-1', cantidad: 1 }],
    });

  it.each([1, 15, 365])('acepta un plazo de %i días', async (diasCredito) => {
    const errores = await validate(dtoConPlazo(diasCredito));

    expect(errores).toHaveLength(0);
  });

  it.each([0, -1, 366, 1.5])('rechaza un plazo de %s días', async (diasCredito) => {
    const errores = await validate(dtoConPlazo(diasCredito));

    expect(errores.some((error) => error.property === 'diasCredito')).toBe(true);
  });
});
