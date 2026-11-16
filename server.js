/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require('fs');
const path = require('path');
const http = require('http');
const { parse } = require('url');

// 1. Corrector automático de permisos de Linux en la carpeta .next
function fixDirectoryPermissions(dir) {
  try {
    fs.chmodSync(dir, 0o755);
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      try {
        if (entry.isDirectory()) {
          fixDirectoryPermissions(fullPath);
        } else {
          fs.chmodSync(fullPath, 0o644);
        }
      } catch (e) {}
    }
  } catch (e) {}
}

const nextDir = path.join(__dirname, '.next');
if (fs.existsSync(nextDir)) {
  fixDirectoryPermissions(nextDir);
}

// 2. Next.js forzado en MODO PRODUCCIÓN (dev: false para no requerir Turbopack)
const next = require('next');
const dev = false;
const app = next({ dev, dir: __dirname });
const handle = app.getRequestHandler();

let isReady = false;
const preparePromise = app.prepare().then(() => {
  isReady = true;
  console.log('> Next.js app lista y cargada con éxito en modo Producción');
}).catch((err) => {
  console.error('> Error fatal en Next.js app.prepare():', err);
});

// 3. Servidor HTTP para Phusion Passenger
const server = http.createServer(async (req, res) => {
  try {
    if (!isReady) {
      await preparePromise;
    }
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  } catch (err) {
    console.error('Error procesando request:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Error interno: ' + (err.message || err));
  }
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`> Servidor Node.js escuchando en ${port}`);
});