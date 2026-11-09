import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { NegociosService } from './negocios.service';
import { PlanesService } from './planes.service';
import { normalizarNombreDeProducto } from '../modules/finance-ai/domain/texto-producto';
import { CreateProductoDto } from '../dto/productos/create-producto.dto';
import { UpdateProductoDto } from '../dto/productos/update-producto.dto';

@Injectable()
export class ProductosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly negociosService: NegociosService,
    private readonly planes: PlanesService,
  ) {}

  /**
   * El inventario es de planes pagos.
   *
   * Se comprueba contra el plan VIGENTE, no el contratado: `PlanesService`
   * hace caer un plan vencido a Asistente, asi que una suscripcion que expira
   * pierde el acceso sola, sin logica aparte que mantener en dos sitios.
   *
   * Lo que ya esta registrado NO se toca. Un negocio que paso por un plan de
   * pago conserva sus productos; lo que pierde es poder gestionarlos, y los
   * recupera intactos al renovar.
   *
   * MASTER no pasa por aqui, igual que no pasa por la comprobacion de
   * permisos: es soporte, no un cliente con plan.
   */
  private async exigirInventario(sedeId: string, rolGlobal: string) {
    if (rolGlobal === 'MASTER') return;

    const sede = await this.prisma.sede.findUnique({
      where: { id: sedeId },
      select: { negocio: { select: { plan: true, planVenceEl: true } } },
    });

    if (!sede) {
      throw new NotFoundException('La sede indicada no existe');
    }

    if (
      this.planes.tieneFuncionalidad(
        sede.negocio.plan,
        sede.negocio.planVenceEl,
        'inventario',
      )
    ) {
      return;
    }

    throw new ForbiddenException(
      this.porQueNoHayInventario(sede.negocio.plan, sede.negocio.planVenceEl),
    );
  }

  /**
   * Por qué este negocio no tiene inventario, dicho para que se entienda.
   *
   * Distingue los dos casos porque al usuario le importan de forma muy
   * distinta: uno nunca ha pagado y el otro pagó y se le venció. A ese segundo
   * hay que decirle que no ha perdido nada.
   */
  private porQueNoHayInventario(
    plan: number,
    planVenceEl: Date | null,
  ): string {
    const estado = this.planes.estado(plan, planVenceEl);

    return estado.vencido
      ? `Tu plan ${estado.contratado.nombre} está vencido, así que el inventario no está disponible. Tus productos siguen guardados y los recuperas al renovar.`
      : `El inventario es una función de los planes pagos. Con el plan ${estado.vigente.nombre} puedes registrar tus ventas y gastos, pero no llevar catálogo de productos.`;
  }

  /**
   * Registra un nuevo producto cumpliendo los criterios de negocio:
   * - Los 4 campos (nombre, categoría, costo de compra y precio de venta) son obligatorios.
   * - Cantidad entera >= 0 (default 0 si no se indica).
   * - Costo de compra y precio de venta > 0.
   */
  async create(userId: string, rolGlobal: string, dto: CreateProductoDto) {
    const nombre = normalizarEspacios(dto.nombre);
    const categoria = normalizarEspacios(dto.categoria);
    const precioCompraNum =
      dto.costoCompra !== undefined ? dto.costoCompra : dto.precioCompra;
    const precioVentaNum = dto.precioVenta;
    const cantidadNum =
      dto.cantidad !== undefined ? dto.cantidad : (dto.stock ?? 0);

    // Criterio 1: Los 4 campos son obligatorios; no se guarda un producto incompleto.
    if (!nombre) {
      throw new BadRequestException('El nombre del producto es obligatorio');
    }
    if (!categoria) {
      throw new BadRequestException('La categoría del producto es obligatoria');
    }
    if (precioCompraNum === undefined || precioCompraNum === null) {
      throw new BadRequestException('El costo de compra es obligatorio');
    }
    if (precioVentaNum === undefined || precioVentaNum === null) {
      throw new BadRequestException('El precio de venta es obligatorio');
    }

    // Criterio 2: Cantidad entera >= 0; costo y precio numéricos > 0.
    if (
      typeof cantidadNum !== 'number' ||
      !Number.isInteger(cantidadNum) ||
      cantidadNum < 0
    ) {
      throw new BadRequestException(
        'La cantidad debe ser un número entero mayor o igual a 0',
      );
    }
    if (
      typeof precioCompraNum !== 'number' ||
      isNaN(precioCompraNum) ||
      precioCompraNum <= 0
    ) {
      throw new BadRequestException(
        'El costo de compra debe ser un número mayor a 0',
      );
    }
    if (
      typeof precioVentaNum !== 'number' ||
      isNaN(precioVentaNum) ||
      precioVentaNum <= 0
    ) {
      throw new BadRequestException(
        'El precio de venta debe ser un número mayor a 0',
      );
    }

    this.verificarMargen(
      precioVentaNum,
      precioCompraNum,
      dto.aceptoVenderConPerdida,
    );

    if (!dto.sedeId) {
      throw new BadRequestException('La sede es obligatoria');
    }

    const sede = await this.prisma.sede.findUnique({
      where: { id: dto.sedeId },
    });
    if (!sede) {
      throw new NotFoundException('La sede indicada no existe');
    }
    await this.negociosService.verificarAccesoSede(userId, sede, rolGlobal, {
      escritura: true,
    });
    await this.exigirInventario(dto.sedeId, rolGlobal);
    const alias = limpiarAlias(dto.alias, nombre);
    await this.verificarNombreYAliasLibres(dto.sedeId, nombre, alias);

    return this.prisma.producto.create({
      data: {
        nombre,
        categoria: await this.unificarCategoria(categoria, dto.sedeId),
        stock: cantidadNum,
        stockMinimo: dto.stockMinimo ?? 0,
        precioCompra: new Prisma.Decimal(precioCompraNum),
        precioVenta: new Prisma.Decimal(precioVentaNum),
        alias,
        sedeId: dto.sedeId,
      },
    });
  }

  /**
   * Consulta el catálogo de productos con soporte para filtros por sede, categoría y búsqueda.
   */
  async findAll(
    userId: string,
    rolGlobal: string,
    filtros: {
      sedeId?: string;
      categoria?: string;
      search?: string;
      stockBajo?: boolean;
    } = {},
  ) {
    /*
     * Consultar el catálogo NO depende del plan, y es deliberado.
     *
     * El repositorio ya fija esa regla en `aislamiento.e2e-spec`: "leer nunca
     * depende del plan; un negocio con el plan vencido conserva el histórico
     * de todas sus sedes". Si vencer una suscripción escondiera lo que el
     * tendero registró, el castigo por dejar de pagar sería perder de vista su
     * propia contabilidad, que es justo lo contrario de lo que se busca.
     *
     * Lo que sí exige plan es ESCRIBIR: registrar, editar y borrar. Y el panel
     * no le pinta el inventario a un plan gratuito, así que tampoco lo ve por
     * ahí; lo que queda abierto es el dato suyo, no la funcionalidad.
     */
    const visibles = await this.negociosService.filtroDeSedes(
      userId,
      rolGlobal,
      filtros.sedeId,
    );

    const where: Prisma.ProductoWhereInput = {
      sedeId: visibles,
    };

    if (filtros.categoria?.trim()) {
      where.categoria = {
        equals: filtros.categoria.trim(),
        mode: 'insensitive',
      };
    }

    /*
     * Lo que hay que reponer: existencias por debajo (o justo en) el minimo
     * que fijo el tendero.
     *
     * `stockMinimo` llevaba desde SCRUM-27 siendo una columna decorativa: se
     * guardaba y ni una linea del backend la leia. La cuenta la hacia el panel
     * en el navegador, asi que el bot no podia avisar de nada.
     *
     * La comparacion es entre dos columnas de la misma fila, que Prisma sabe
     * hacer desde la 5 con `fields`. Sin eso habria que bajar a SQL crudo.
     */
    if (filtros.stockBajo) {
      where.stock = { lte: this.prisma.producto.fields.stockMinimo };
    }

    if (filtros.search?.trim()) {
      const term = filtros.search.trim();
      where.OR = [
        { nombre: { contains: term, mode: 'insensitive' } },
        { alias: { has: term } },
      ];
    }

    return this.prisma.producto.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Consulta un producto específico por ID verificando permisos multitenant sobre la sede.
   */
  async findOne(id: string, userId: string, rolGlobal: string) {
    const producto = await this.cargar(id);
    await this.verificarAccesoAlProducto(producto.sedeId, userId, rolGlobal);
    return producto;
  }

  /**
   * Actualiza los datos de un producto aplicando las mismas reglas de validación numérica.
   */
  async update(
    id: string,
    userId: string,
    rolGlobal: string,
    dto: UpdateProductoDto,
  ) {
    const producto = await this.cargar(id);
    await this.verificarAccesoAlProducto(producto.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    const data: Prisma.ProductoUpdateInput = {};
    let nombreNuevo: string | undefined;

    if (dto.nombre !== undefined) {
      const nombre = normalizarEspacios(dto.nombre);
      if (!nombre) {
        throw new BadRequestException(
          'El nombre del producto no puede estar vacío',
        );
      }
      data.nombre = nombre;
      nombreNuevo = nombre;
    }

    if (dto.categoria !== undefined) {
      const categoria = normalizarEspacios(dto.categoria);
      if (!categoria) {
        throw new BadRequestException(
          'La categoría del producto no puede estar vacía',
        );
      }
      data.categoria = await this.unificarCategoria(categoria, producto.sedeId);
    }

    const cantidadNum = dto.cantidad !== undefined ? dto.cantidad : dto.stock;
    if (cantidadNum !== undefined) {
      if (
        typeof cantidadNum !== 'number' ||
        !Number.isInteger(cantidadNum) ||
        cantidadNum < 0
      ) {
        throw new BadRequestException(
          'La cantidad debe ser un número entero mayor o igual a 0',
        );
      }
      data.stock = cantidadNum;
    }

    const costoNum =
      dto.costoCompra !== undefined ? dto.costoCompra : dto.precioCompra;
    if (costoNum !== undefined) {
      if (typeof costoNum !== 'number' || isNaN(costoNum) || costoNum <= 0) {
        throw new BadRequestException(
          'El costo de compra debe ser un número mayor a 0',
        );
      }
      data.precioCompra = new Prisma.Decimal(costoNum);
    }

    if (dto.precioVenta !== undefined) {
      if (
        typeof dto.precioVenta !== 'number' ||
        isNaN(dto.precioVenta) ||
        dto.precioVenta <= 0
      ) {
        throw new BadRequestException(
          'El precio de venta debe ser un número mayor a 0',
        );
      }
      data.precioVenta = new Prisma.Decimal(dto.precioVenta);
    }

    // El margen se mide sobre el par que queda DESPUÉS de editar: tocar solo
    // el precio de venta puede dejarlo por debajo del costo ya guardado.
    //
    // Y solo se comprueba si se toca alguno de los dos. Si no, un producto que
    // ya se vendía a pérdida no dejaría ni corregirle el stock.
    if (costoNum !== undefined || dto.precioVenta !== undefined) {
      this.verificarMargen(
        dto.precioVenta ?? Number(producto.precioVenta),
        costoNum ?? Number(producto.precioCompra),
        dto.aceptoVenderConPerdida,
      );
    }

    if (dto.stockMinimo !== undefined) {
      data.stockMinimo = dto.stockMinimo;
    }

    let aliasNuevos: string[] | undefined;
    if (dto.alias !== undefined) {
      aliasNuevos = limpiarAlias(dto.alias, nombreNuevo ?? producto.nombre);
      data.alias = aliasNuevos;
    }

    /*
     * Renombrar o cambiar los alias tampoco puede chocar con otro producto de
     * la sede. Se mide sobre el par que QUEDA: cambiar solo el nombre tiene
     * que comprobarse junto a los alias que ya estaban guardados.
     *
     * Y solo se comprueba si se toca alguno de los dos. Si no, un producto que
     * arrastre un choque de antes —de cuando esto no se validaba— quedaria
     * bloqueado para cualquier edicion, incluso para arreglarlo.
     */
    if (nombreNuevo !== undefined || aliasNuevos !== undefined) {
      await this.verificarNombreYAliasLibres(
        producto.sedeId,
        nombreNuevo ?? producto.nombre,
        aliasNuevos ?? producto.alias,
        id,
      );
    }

    return this.prisma.producto.update({
      where: { id },
      data,
    });
  }

  /**
   * Saca un producto del catálogo.
   *
   * Un producto que ya se vendió o se compró NO se puede borrar: su historial
   * lo referencia y la base lo impide (las relaciones de DetalleVenta y
   * DetalleCompra no declaran onDelete, así que Prisma aplica Restrict).
   *
   * Eso está bien —el historial de ventas no se toca—, pero antes salía como
   * un 500 sin explicación: el tendero le daba a borrar y recibía "error
   * interno del servidor". Ahora se le dice qué pasa y qué puede hacer.
   */
  async remove(id: string, userId: string, rolGlobal: string) {
    const producto = await this.cargar(id);
    await this.verificarAccesoAlProducto(producto.sedeId, userId, rolGlobal, {
      escritura: true,
    });

    const [ventas, compras] = await Promise.all([
      this.prisma.detalleVenta.count({ where: { productoId: id } }),
      this.prisma.detalleCompra.count({ where: { productoId: id } }),
    ]);
    if (ventas + compras > 0) {
      throw new ConflictException(
        `No se puede eliminar "${producto.nombre}": ya tiene movimientos registrados (${movimientos(ventas, compras)}). Si dejaste de venderlo, pon su cantidad en 0.`,
      );
    }

    try {
      return await this.prisma.producto.delete({ where: { id } });
    } catch (error) {
      // Red de seguridad: entre el conteo de arriba y este borrado puede
      // haberse registrado una venta. La base lo frena con P2003, y aquí se
      // traduce en vez de dejarlo salir como un 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new ConflictException(
          `No se puede eliminar "${producto.nombre}": acaba de registrarse un movimiento que lo usa.`,
        );
      }
      throw error;
    }
  }

  /**
   * Devuelve la categoría tal como ya se escribe en la sede.
   *
   * La categoría es texto libre en la base y el catálogo de SCRUM-29 se armó
   * en el frontend, leyendo las categorías de los productos que ya existen.
   * Resultado: "Abarrotes", "abarrotes" y "Abarrotes " eran tres categorías
   * distintas, y el filtro por categoría las separaba.
   *
   * Sin una tabla de catálogo no se puede validar contra una lista cerrada,
   * pero sí evitar que se multipliquen: si la sede ya usa esa categoría, se
   * reutiliza su escritura exacta. La primera vez que entra, entra como la
   * escribió el tendero.
   */
  private async unificarCategoria(categoria: string, sedeId: string) {
    const yaUsada = await this.prisma.producto.findFirst({
      where: {
        sedeId,
        categoria: { equals: categoria, mode: 'insensitive' },
      },
      select: { categoria: true },
    });
    return yaUsada?.categoria ?? categoria;
  }

  /**
   * Vender por debajo del costo se permite, pero nunca por accidente.
   *
   * La regla vivía solo en el navegador —un `window.confirm` en el panel—, así
   * que quien llamara al API directo registraba la pérdida en silencio y el
   * margen entraba al revés sin que nadie se enterara.
   *
   * No se bloquea: hay quien vende a pérdida a propósito (sacar lo que está
   * por vencerse, un gancho para traer gente). Es el mismo criterio que el
   * flujo de WhatsApp de SCRUM-28, que avisa del margen en el resumen y deja
   * confirmar. Aquí ese "sí, lo sé" es el campo `aceptoVenderConPerdida`.
   */
  private verificarMargen(
    precioVenta: number,
    precioCompra: number,
    aceptado?: boolean,
  ) {
    if (precioVenta >= precioCompra || aceptado) return;
    throw new BadRequestException(
      `El precio de venta (${pesos(precioVenta)}) es menor que el costo (${pesos(precioCompra)}): registrarías el producto con pérdida. Si es a propósito, reenvía la petición con "aceptoVenderConPerdida": true.`,
    );
  }

  /**
   * Comprueba que ni el nombre ni los alias choquen con otro producto de la
   * sede.
   *
   * Dos productos que el bot ve igual lo dejan sin salida: al decir "vendí 2
   * arroz" encuentra dos candidatos, responde "indica el nombre exacto", y el
   * nombre exacto es el mismo para los dos. No hay respuesta que lo resuelva y
   * el producto queda inservible por WhatsApp para siempre.
   *
   * Dos decisiones que importan:
   *
   * 1. Se compara con `normalizarNombreDeProducto`, el MISMO normalizador que
   *    usa el bot al resolver. No con `mode: 'insensitive'`, que era lo que
   *    había antes y se queda corto: Postgres ve "Arroz" y "Arróz" como
   *    distintos, el bot los ve como el mismo, y por esa rendija entraba justo
   *    el duplicado que esto quiere evitar.
   * 2. Se compara contra nombre Y alias, porque el bot resuelve por los dos.
   *    Un alias repetido deja el producto igual de inservible que un nombre
   *    repetido.
   *
   * Se traen los productos de la sede y se comparan en memoria, como ya hace
   * el propio bot: los operadores de arrays de Postgres distinguen mayúsculas
   * y acentos, así que no hay consulta que haga esta comparación. El catálogo
   * de una tienda son decenas de filas.
   *
   * Sigue siendo leer-y-luego-escribir: dos peticiones simultáneas pueden
   * colarse las dos. Cerrarlo del todo pide un @@unique([sedeId, nombre]) en
   * la base, que no está en nuestras manos.
   */
  private async verificarNombreYAliasLibres(
    sedeId: string,
    nombre: string,
    alias: string[],
    excluyendoId?: string,
  ) {
    const otros = await this.prisma.producto.findMany({
      where: {
        sedeId,
        ...(excluyendoId ? { id: { not: excluyendoId } } : {}),
      },
      select: { nombre: true, alias: true },
    });

    // Cada texto por el que el bot puede llegar a otro producto, y por cuál
    // de ellos llega.
    const ocupados = new Map<string, { producto: string; esAlias: boolean }>();
    for (const otro of otros) {
      ocupados.set(normalizarNombreDeProducto(otro.nombre), {
        producto: otro.nombre,
        esAlias: false,
      });
      for (const suyo of otro.alias) {
        const clave = normalizarNombreDeProducto(suyo);
        if (!ocupados.has(clave)) {
          ocupados.set(clave, { producto: otro.nombre, esAlias: true });
        }
      }
    }

    const choque = (valor: string) =>
      ocupados.get(normalizarNombreDeProducto(valor));

    const porElNombre = choque(nombre);
    if (porElNombre) {
      throw new ConflictException(
        porElNombre.esAlias
          ? `"${nombre}" ya es un alias del producto "${porElNombre.producto}" en esta sede`
          : `Ya tienes un producto llamado "${porElNombre.producto}" en esta sede`,
      );
    }

    for (const propio of alias) {
      const porElAlias = choque(propio);
      if (porElAlias) {
        throw new ConflictException(
          porElAlias.esAlias
            ? `El alias "${propio}" ya lo usa el producto "${porElAlias.producto}" en esta sede`
            : `El alias "${propio}" es el nombre del producto "${porElAlias.producto}" en esta sede`,
        );
      }
    }
  }

  /** Carga interna del producto por ID */
  private async cargar(id: string) {
    const producto = await this.prisma.producto.findUnique({ where: { id } });
    if (!producto) {
      throw new NotFoundException(`Producto con id ${id} no encontrado`);
    }
    return producto;
  }

  private async verificarAccesoAlProducto(
    sedeId: string,
    userId: string,
    rolGlobal: string,
    opciones: { escritura?: boolean } = {},
  ) {
    const sede = await this.prisma.sede.findUnique({ where: { id: sedeId } });
    if (!sede) {
      throw new NotFoundException(
        'La sede asociada a este producto ya no existe',
      );
    }
    await this.negociosService.verificarAccesoSede(
      userId,
      sede,
      rolGlobal,
      opciones,
    );

    // Solo al escribir: ver un producto que ya existe no es gestionar el
    // inventario, y esconderle a alguien lo que registró no arregla nada.
    if (opciones.escritura) {
      await this.exigirInventario(sedeId, rolGlobal);
    }
  }
}

/**
 * Deja los alias en limpio: sin espacios de sobra, sin vacíos, sin repetidos y
 * sin el propio nombre del producto.
 *
 * Un alias vacío o repetido no rompe nada, pero ensucia el catálogo y hace que
 * los mensajes de choque hablen de cosas que el tendero no escribió. El que
 * coincide con el nombre se descarta porque no añade ninguna forma nueva de
 * llegar al producto.
 */
function limpiarAlias(alias: string[] | undefined, nombre: string): string[] {
  if (alias === undefined) return [];
  const vistos = new Set([normalizarNombreDeProducto(nombre)]);
  const limpios: string[] = [];
  for (const bruto of alias) {
    const valor = normalizarEspacios(bruto);
    if (!valor) continue;
    const clave = normalizarNombreDeProducto(valor);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    limpios.push(valor);
  }
  return limpios;
}

/**
 * Un solo espacio entre palabras y ninguno en los extremos.
 *
 * Sin esto, "Arroz  Diana" y "Arroz Diana" son dos productos distintos para la
 * base y para el bot, y la comprobacion de duplicados no los ve iguales.
 */
function normalizarEspacios(valor: string | undefined): string | undefined {
  return typeof valor === 'string' ? valor.replace(/\s+/g, ' ').trim() : valor;
}

/** "$3.500", como lo lee un tendero. */
function pesos(valor: number): string {
  return `$${valor.toLocaleString('es-CO')}`;
}

/** "2 ventas y 1 compra", en singular o plural segun el caso. */
function movimientos(ventas: number, compras: number): string {
  const partes: string[] = [];
  if (ventas > 0) partes.push(`${ventas} ${ventas === 1 ? 'venta' : 'ventas'}`);
  if (compras > 0) {
    partes.push(`${compras} ${compras === 1 ? 'compra' : 'compras'}`);
  }
  return partes.join(' y ');
}
