import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NegociosService } from '../src/services/negocios.service';
import { UserContextCacheService } from '../src/services/user-context-cache.service';
import { PlanesService } from '../src/services/planes.service';
import { PrismaService } from '../src/services/prisma.service';
import { SedesService } from '../src/services/sedes.service';
import { limpiar, sembrar, type Semilla } from './helpers/contexto';

describe('Sedes y enrutamiento por teléfono (contra Postgres real)', () => {
  let prisma: PrismaService;
  let sedes: SedesService;
  let cerrar: () => Promise<void>;
  let s: Semilla;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SedesService,
        NegociosService,
        UserContextCacheService,
        PlanesService,
        PrismaService,
      ],
    }).compile();

    prisma = moduleRef.get(PrismaService);
    sedes = moduleRef.get(SedesService);
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

  it('resuelve la sede a partir del número de WhatsApp', async () => {
    const encontradas = await sedes.findAll(
      s.duenoId,
      'CLIENTE',
      undefined,
      '+573001110002',
    );

    expect(encontradas).toHaveLength(1);
    expect(encontradas[0].id).toBe(s.sedeBId);
  });

  it('devuelve vacío si el número no está asignado a ninguna sede', async () => {
    expect(
      await sedes.findAll(s.duenoId, 'CLIENTE', undefined, '+573009999999'),
    ).toHaveLength(0);
  });

  // Buscar por número no puede ser una puerta trasera para leer sedes ajenas.
  it('no encuentra por número una sede de otro negocio', async () => {
    expect(
      await sedes.findAll(s.ajenoId, 'CLIENTE', undefined, '+573001110002'),
    ).toHaveLength(0);
  });

  // Si dos sedes compartieran número, un mensaje entrante sería ambiguo.
  it('no permite asignar el mismo número a dos sedes', async () => {
    await expect(
      sedes.create(s.duenoId, 'CLIENTE', {
        nombre: 'Sede Sur',
        telefono: '+573001110001', // ya es el de la sede A
        negocioId: s.negocioId,
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('tampoco al editar una sede existente', async () => {
    await expect(
      sedes.update(s.sedeBId, s.duenoId, 'CLIENTE', {
        telefono: '+573001110001',
      }),
    ).rejects.toThrow(ConflictException);
  });

  it('permite crear sedes sin teléfono asignado', async () => {
    const sede = await sedes.create(s.duenoId, 'CLIENTE', {
      nombre: 'Bodega',
      negocioId: s.negocioId,
    });

    expect(sede.telefono).toBeNull();
  });

  // El @unique de Postgres admite varios NULL, así que varias sedes pueden estar sin línea.
  it('varias sedes pueden quedar sin teléfono a la vez', async () => {
    await sedes.create(s.duenoId, 'CLIENTE', {
      nombre: 'Bodega 1',
      negocioId: s.negocioId,
    });
    await expect(
      sedes.create(s.duenoId, 'CLIENTE', {
        nombre: 'Bodega 2',
        negocioId: s.negocioId,
      }),
    ).resolves.toBeDefined();
  });
});
