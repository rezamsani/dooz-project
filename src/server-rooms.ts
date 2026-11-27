import { randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocket, WebSocketServer } from 'ws';
import { RoomCoordinator, RoomPeer } from './app/game/room-coordinator';
import { RivalryStore } from './server-rivalries';

export class OnlineRoomManager {
  private readonly rooms: RoomCoordinator;
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 4096 });

  constructor(dataDirectory: string) {
    this.rooms = new RoomCoordinator(new RivalryStore(dataDirectory), randomBytes);
    this.wss.on('connection', socket => {
      const peer: RoomPeer = {
        send: payload => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload));
        },
      };
      this.rooms.connect(peer);
      socket.on('message', raw => this.rooms.receive(peer, raw.toString()));
      socket.on('close', () => this.rooms.disconnect(peer));
    });
  }

  handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): void {
    this.wss.handleUpgrade(req, socket, head, ws => this.wss.emit('connection', ws, req));
  }
}
