import { Controller, Get, Header } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';

const VERSION = '1.0.0';

@Controller()
export class AppController {
  // La raiz la abren personas, no programas: se responde una pagina en vez del
  // 404 "Cannot GET /", que hace parecer que el servicio esta caido.
  @Get()
  @Header('Content-Type', 'text/html; charset=utf-8')
  inicio() {
    return paginaDeEstado();
  }

  // El que consulta Render para el health check, y el que deben usar los
  // servicios: responde JSON y no toca ni la base de datos ni la IA.
  // Lo consulta la plataforma de despliegue, no una persona: sin límite.
  @SkipThrottle()
  @Get('health')
  health() {
    return {
      success: true,
      status: 'online',
      service: 'Business AI API',
      version: VERSION,
      timestamp: new Date().toISOString(),
    };
  }
}

function paginaDeEstado(): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>GerenteAI API</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh;
    display: flex; align-items: center; justify-content: center;
    background: #0d0f14; color: #e6e8ee;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 2rem;
  }
  main { width: 100%; max-width: 34rem; }
  .estado {
    display: inline-flex; align-items: center; gap: .5rem;
    font-size: .8125rem; letter-spacing: .04em; text-transform: uppercase;
    color: #4ade80; margin-bottom: 1.25rem;
  }
  .punto {
    width: .5rem; height: .5rem; border-radius: 50%; background: #4ade80;
    box-shadow: 0 0 0 .25rem rgba(74,222,128,.15);
  }
  h1 { margin: 0 0 .4rem; font-size: 1.75rem; letter-spacing: -.02em; }
  p.sub { margin: 0 0 2rem; color: #8b93a7; font-size: .9375rem; line-height: 1.6; }
  ul { list-style: none; margin: 0; padding: 0; border-top: 1px solid #1e2230; }
  li { border-bottom: 1px solid #1e2230; }
  a, span.ruta {
    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
    padding: .875rem .25rem; text-decoration: none; color: inherit;
  }
  a:hover { background: #141821; }
  code {
    font-family: ui-monospace, "SF Mono", Menlo, monospace;
    font-size: .875rem; color: #c4b5fd;
  }
  .desc { color: #6b7385; font-size: .8125rem; text-align: right; }
  footer { margin-top: 2rem; color: #545b6d; font-size: .8125rem; }
</style>
</head>
<body>
<main>
  <div class="estado"><span class="punto"></span> En funcionamiento</div>
  <h1>GerenteAI API</h1>
  <p class="sub">
    API REST del backend. No tiene interfaz propia: la consumen el dashboard y la
    capa de IA. Estas son las rutas que se pueden abrir desde el navegador.
  </p>
  <ul>
    <li><a href="/health"><code>GET /health</code><span class="desc">Estado del servicio</span></a></li>
    <li><a href="/ai/status"><code>GET /ai/status</code><span class="desc">Proveedor de IA activo</span></a></li>
    <li><a href="/negocios"><code>GET /negocios</code><span class="desc">Negocios registrados</span></a></li>
    <li><a href="/productos"><code>GET /productos</code><span class="desc">Inventario</span></a></li>
    <li><span class="ruta"><code>POST /auth/login</code><span class="desc">Requiere cuerpo JSON</span></span></li>
    <li><span class="ruta"><code>POST /ai/interpret</code><span class="desc">Requiere x-api-key</span></span></li>
  </ul>
  <footer>v${VERSION}</footer>
</main>
</body>
</html>`;
}
