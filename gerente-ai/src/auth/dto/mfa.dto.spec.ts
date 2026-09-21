import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ActivarMfaDto, VerificarMfaDto } from './mfa.dto';

async function errores(clase: new () => object, cuerpo: object) {
  const resultado = await validate(plainToInstance(clase, cuerpo));
  return resultado.map((e) => e.property);
}

describe('DTOs de MFA', () => {
  it('acepta un código de seis dígitos, con o sin espacios', async () => {
    expect(
      await errores(VerificarMfaDto, { mfaToken: 't', codigo: '123456' }),
    ).toEqual([]);
    expect(
      await errores(VerificarMfaDto, { mfaToken: 't', codigo: ' 123 456 ' }),
    ).toEqual([]);
  });

  // Antes el cuerpo era un tipo plano y el ValidationPipe no lo revisaba:
  // un número JSON llegaba a `.trim()` y el servidor respondía 500.
  it('rechaza el código como número', async () => {
    expect(
      await errores(VerificarMfaDto, { mfaToken: 't', codigo: 123456 }),
    ).toEqual(['codigo']);
  });

  it.each(['12345', '1234567', 'abcdef', '12a456', ''])(
    'rechaza el código %p',
    async (codigo) => {
      expect(
        await errores(VerificarMfaDto, { mfaToken: 't', codigo }),
      ).toEqual(['codigo']);
    },
  );

  it('exige el mfaToken como texto no vacío', async () => {
    expect(await errores(ActivarMfaDto, {})).toEqual(['mfaToken']);
    expect(await errores(ActivarMfaDto, { mfaToken: '' })).toEqual([
      'mfaToken',
    ]);
    expect(await errores(ActivarMfaDto, { mfaToken: 42 })).toEqual([
      'mfaToken',
    ]);
    expect(
      await errores(VerificarMfaDto, { codigo: '123456' }),
    ).toEqual(['mfaToken']);
  });
});
