import { createServer } from 'node:http';
import { OnlineRoomManager } from './server-rooms';

const rooms = new OnlineRoomManager();
const server = createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

server.on('upgrade', (req, socket, head) => {
  if (req.url === '/api/ws') {
    rooms.handleUpgrade(req, socket, head);
  } else {
    socket.destroy();
  }
});

server.on('error', (error) => {
  console.error('Online server failed to start:', error);
  process.exit(1);
});

server.listen(Number(process.env['DOOZ_ONLINE_PORT'] ?? 4201), '127.0.0.1', () => {
  const address = server.address();
  if (address && typeof address !== 'string') {
    console.log(`Online server listening on http://127.0.0.1:${address.port}`);
    process.send?.({ type: 'ready', port: address.port });
  }
});
