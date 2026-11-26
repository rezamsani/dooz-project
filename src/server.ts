import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import { createServer } from 'node:http';
import { join } from 'node:path';
import { OnlineRoomManager } from './server-rooms';
import { createProjectZipArchive } from './server-zip';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine();
const roomManager = new OnlineRoomManager();

/**
 * Handle WebSocket upgrades for live multiplayer rooms before Angular SSR intercepts them.
 */
app.use('/api', (req, _res, next) => {
  if (req.path === '/ws' && req.headers.upgrade?.toLowerCase() === 'websocket') {
    roomManager.handleUpgrade(req, req.socket, Buffer.alloc(0));
    return;
  }
  next();
});

/**
 * Download safe allowlisted project source code as a standard ZIP archive.
 */
app.get('/api/download-project', (_req, res) => {
  try {
    const archive = createProjectZipArchive();
    if (!archive) {
      res.status(404).json({ error: 'فایل‌های پروژه در دسترس نیستند.' });
      return;
    }
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename="dooz-project.zip"');
    res.setHeader('Cache-Control', 'no-store');
    res.send(archive);
  } catch {
    res.status(500).json({ error: 'خطا در ساخت فایل فشرده پروژه.' });
  }
});

/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 4000;
  const server = createServer(app);
  server.on('upgrade', (req, socket, head) => {
    if (req.url === '/api/ws') {
      roomManager.handleUpgrade(req, socket, head);
    } else {
      socket.destroy();
    }
  });
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);
