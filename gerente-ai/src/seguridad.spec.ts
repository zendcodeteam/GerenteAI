import express from 'express';
import helmet from 'helmet';
import request from 'supertest';

import { OPCIONES_DE_HELMET } from './seguridad';

/**
 * Las cabeceras se comprueban sobre una aplicacion Express minima y no sobre
 * la de Nest, porque levantar la de Nest exige base de datos y estas pruebas
 * tienen que correr en cualquier maquina.
 *
 * Lo que se verifica es lo unico que importa: que cabeceras salen de verdad
 * en la respuesta. Una politica que solo se revisa leyendo el codigo se rompe
 * el dia que alguien toca un valor sin entenderlo.
 */
function servidorDePrueba() {
  const app = express();
  app.use(helmet(OPCIONES_DE_HELMET));

  app.get('/json', (_peticion, respuesta) => {
    respuesta.json({ ok: true });
  });

  app.get('/pagina', (_peticion, respuesta) => {
    respuesta
      .type('html')
      .send('<html><head><style>body{color:red}</style></head></html>');
  });

  return app;
}

describe('Cabeceras de seguridad HTTP', () => {
  it('manda las cinco cabeceras del hallazgo', async () => {
    const respuesta = await request(servidorDePrueba()).get('/json');

    expect(respuesta.headers['strict-transport-security']).toBeDefined();
    expect(respuesta.headers['x-content-type-options']).toBe('nosniff');
    expect(respuesta.headers['x-frame-options']).toBe('DENY');
    expect(respuesta.headers['content-security-policy']).toBeDefined();
    expect(respuesta.headers['referrer-policy']).toBe('no-referrer');
  });

  it('el HSTS dura un año e incluye subdominios, pero sin preload', async () => {
    // `preload` es practicamente irreversible: entrar en la lista de los
    // navegadores es facil y salir tarda meses.
    const respuesta = await request(servidorDePrueba()).get('/json');
    const hsts = respuesta.headers['strict-transport-security'];

    expect(hsts).toContain('max-age=31536000');
    expect(hsts).toContain('includeSubDomains');
    expect(hsts).not.toContain('preload');
  });

  it('nadie puede meter la API dentro de un iframe', async () => {
    // Dos candados: CSP para los navegadores modernos y X-Frame-Options para
    // los que no la leen.
    const respuesta = await request(servidorDePrueba()).get('/json');

    expect(respuesta.headers['content-security-policy']).toContain(
      "frame-ancestors 'none'",
    );
    expect(respuesta.headers['x-frame-options']).toBe('DENY');
  });

  it('no permite scripts, objetos ni formularios hacia fuera', async () => {
    const csp = (await request(servidorDePrueba()).get('/json')).headers[
      'content-security-policy'
    ];

    expect(csp).toContain("script-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'none'");
    expect(csp).toContain("base-uri 'none'");
  });

  it('deja pasar los estilos en linea de la pagina de estado', async () => {
    // La raiz sirve una pagina con su CSS dentro del HTML. Con la politica por
    // defecto de helmet se veria sin ningun formato, y el equipo pensaria que
    // el servicio esta roto.
    const csp = (await request(servidorDePrueba()).get('/pagina')).headers[
      'content-security-policy'
    ];

    expect(csp).toContain("style-src 'self' 'unsafe-inline'");
  });

  it("'unsafe-inline' vale SOLO para los estilos", async () => {
    // Si algun dia se cuela en script-src, la proteccion contra XSS se cae
    // entera. Esta prueba existe para que ese cambio no pase inadvertido.
    const csp = (await request(servidorDePrueba()).get('/json')).headers[
      'content-security-policy'
    ];

    const directivaDeScripts = csp
      .split(';')
      .map((parte) => parte.trim())
      .find((parte) => parte.startsWith('script-src'));

    expect(directivaDeScripts).not.toContain('unsafe-inline');
  });
});
