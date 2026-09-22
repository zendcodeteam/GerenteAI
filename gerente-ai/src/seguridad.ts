import type { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';

/**
 * Cabeceras de seguridad HTTP.
 *
 * Vive aparte de `main.ts` para que se pueda probar: lo que se configura en el
 * arranque no lo ve ninguna prueba, y una politica de seguridad que nadie
 * verifica se rompe sin que nadie se entere.
 *
 * ---------------------------------------------------------------------------
 * SOBRE LA CSP
 *
 * Esto es una API que responde JSON, pero NO solo eso: la raiz sirve una
 * pagina de estado con sus estilos escritos dentro del propio HTML
 * (`AppController.inicio`). La politica por defecto de helmet prohibe los
 * estilos en linea, asi que esa pagina se veria sin ningun formato.
 *
 * Por eso la politica se escribe entera aqui en vez de heredar la de helmet:
 * asi se ve de un vistazo que lo unico que se permite de mas son los estilos,
 * y solo porque ese HTML es fijo y no mezcla nada que venga del usuario. Si
 * algun dia esa pagina muestra datos de la base, hay que quitar
 * 'unsafe-inline' y pasar los estilos a un archivo aparte.
 * ---------------------------------------------------------------------------
 */
export const OPCIONES_DE_HELMET: Parameters<typeof helmet>[0] = {
  contentSecurityPolicy: {
    // Sin herencia: la politica es exactamente esta lista y no cambia sola
    // cuando helmet actualice sus valores por defecto.
    useDefaults: false,
    directives: {
      defaultSrc: ["'self'"],
      // El unico permiso de mas, y es por la pagina de estado. Ver arriba.
      styleSrc: ["'self'", "'unsafe-inline'"],
      // No hay ni una linea de JavaScript en lo que sirve este backend.
      scriptSrc: ["'none'"],
      imgSrc: ["'self'"],
      objectSrc: ["'none'"],
      // Nadie puede meter esta API dentro de un iframe: es lo que impide el
      // clickjacking en los navegadores modernos.
      frameAncestors: ["'none'"],
      // Que no se pueda reescribir la base de las rutas relativas ni enviar
      // formularios a otro sitio.
      baseUri: ["'none'"],
      formAction: ["'none'"],
    },
  },

  // La version vieja de la anterior, para los navegadores que no leen CSP.
  xFrameOptions: { action: 'deny' },

  /**
   * No se manda la URL de origen a ningun sitio.
   *
   * Importa mas de lo que parece: las rutas de esta API llevan identificadores
   * de negocio y de movimiento, y una cabecera Referer los filtraria a
   * cualquier enlace externo.
   */
  referrerPolicy: { policy: 'no-referrer' },

  /**
   * HSTS: un anio, incluyendo subdominios.
   *
   * Sin `preload` a proposito. Entrar en la lista de precarga de los
   * navegadores es practicamente irreversible, y no es una decision que deba
   * tomarse de lado mientras se arregla otra cosa.
   */
  strictTransportSecurity: {
    maxAge: 31_536_000,
    includeSubDomains: true,
    preload: false,
  },

  /**
   * `crossOriginResourcePolicy` se queda en su valor por defecto
   * (`same-origin`), que es el mas estricto.
   *
   * No estorba al frontend: las peticiones con `fetch` y CORS no las gobierna
   * esta cabecera. Si algun dia un endpoint devuelve un archivo que el
   * navegador cargue como recurso —una imagen, un PDF incrustado—, habra que
   * ponerlo en `cross-origin` o el navegador lo bloqueara sin explicacion.
   */
};

/** Aplica las cabeceras a la aplicacion. */
export function aplicarCabecerasDeSeguridad(app: NestExpressApplication): void {
  app.use(helmet(OPCIONES_DE_HELMET));
}
