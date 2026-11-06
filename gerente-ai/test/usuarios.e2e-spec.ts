import { BadRequestException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { AuthService } from '../src/auth/auth.service';
import { MailService } from '../src/auth/mail/mail.service';
import { NegociosService } from '../src/services/negocios.service';
import { UserContextCacheService } from '../src/services/user-context-cache.service';
import { PlanesService } from '../src/services/planes.service';
import { PrismaService } from '../src/services/prisma.service';
import { limpiar, sembrar, type Semilla } from './helpers/contexto';

// AuthService inyecta JwtService y MailService, pero los endpoints de perfil y
// búsqueda no los usan: se pasan dobles para no firmar tokens ni enviar correos.
const jwtFalso = { sign: () => 'token-falso', verify: () => ({}) };
const mailFalso = {
  sendVerificationEmail: () => Promise.resolve(),
  sendPasswordResetEmail: () => Promise.resolve(),
  sendEmailChangeConfirmation: () => Promise.resolve(),
};

describe('Usuarios (contra Postgres real)', () => {
  let prisma: PrismaService;
  let auth: AuthService;
  let cerrar: () => Promise<void>;
  let s: Semilla;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        PrismaService,
        NegociosService,
        UserContextCacheService,
        PlanesService,
        { provide: JwtService, useValue: jwtFalso },
        { provide: MailService, useValue: mailFalso },
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    auth = moduleRef.get(AuthService);
    await prisma.$connect();
    cerrar = async () => {
      await prisma.$disconnect();
      await moduleRef.close();
    };
  });

  afterAll(async () => {
    await limpiar(prisma);
    await cerrar();
  });

  beforeEach(async () => {
    await limpiar(prisma);
    s = await sembrar(prisma);
  });

  describe('getPerfil', () => {
    it('devuelve el perfil sin exponer la contraseña', async () => {
      const perfil = await auth.getPerfil(s.duenoId);

      expect(perfil.email).toBe('dueno@test.local');
      expect(perfil).not.toHaveProperty('password');
    });

    it('el dueño ve su negocio y ninguna sede vinculada directamente', async () => {
      const perfil = await auth.getPerfil(s.duenoId);

      expect(perfil.negocios).toHaveLength(1);
      expect(perfil.negocios[0].negocio.id).toBe(s.negocioId);
      expect(perfil.sedes).toHaveLength(0);
    });

    it('el admin de sede ve su sede y ningún negocio', async () => {
      const perfil = await auth.getPerfil(s.adminSedeAId);

      expect(perfil.sedes).toHaveLength(1);
      expect(perfil.sedes[0].sede.id).toBe(s.sedeAId);
      expect(perfil.negocios).toHaveLength(0);
    });

    it('falla con 404 si el usuario no existe', async () => {
      await expect(
        auth.getPerfil('00000000-0000-0000-0000-000000000000'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('buscarPorEmail', () => {
    it('encuentra por correo exacto y devuelve solo id y nombre', async () => {
      const encontrado = await auth.buscarPorEmail('admin-a@test.local');

      expect(encontrado).toEqual({
        id: s.adminSedeAId,
        nombre: 'Admin Sede A',
      });
    });

    it('no hace búsqueda parcial', async () => {
      await expect(auth.buscarPorEmail('admin-a')).rejects.toThrow(
        NotFoundException,
      );
      await expect(auth.buscarPorEmail('@test.local')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('exige el parámetro email', async () => {
      await expect(auth.buscarPorEmail(undefined)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('updateUsuario', () => {
    it('actualiza nombre y teléfono', async () => {
      const actualizado = await auth.updateUsuario(s.duenoId, {
        nombre: 'José Pérez',
        telefono: '+573009998877',
      });

      expect(actualizado.nombre).toBe('José Pérez');
      expect(actualizado.telefono).toBe('+573009998877');
    });

    it('deja intacto lo que no se envía', async () => {
      await auth.updateUsuario(s.duenoId, { telefono: '+573001234567' });
      const perfil = await auth.getPerfil(s.duenoId);

      expect(perfil.nombre).toBe('Dueño');
      expect(perfil.telefono).toBe('+573001234567');
    });
  });

  // El flujo completo que antes era imposible: el dueño busca a su encargado por
  // correo, obtiene el id y lo vincula a la sede.
  describe('flujo de asignar el encargado de una sede', () => {
    it('el dueño puede resolver el id del encargado a partir de su correo', async () => {
      const encargado = await auth.buscarPorEmail('ajeno@test.local');

      await prisma.usuarioSede.create({
        data: { usuarioId: encargado.id, sedeId: s.sedeBId },
      });

      const perfil = await auth.getPerfil(encargado.id);
      expect(perfil.sedes).toHaveLength(1);
      expect(perfil.sedes[0].sede.id).toBe(s.sedeBId);
    });
  });
});
