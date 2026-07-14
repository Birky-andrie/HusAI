import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { verifyToken, type AuthUser } from '../middleware/auth.js';

/**
 * WebSocket hub for live meeting sessions (Phase 1 will add the sessions).
 *
 * Handshake: `wss://…/ws?token=<JWT>` — browsers can't set headers on WebSocket,
 * so the token travels as a query param. Bad/missing token → close 4401.
 *
 * Protocol (JSON messages):
 *   server → client on connect:  { type: 'hello', userId }
 *   client → server:             { type: 'ping' }          → { type: 'pong' }
 *   anything else (for now):     { type: 'error', error: 'unknown-message-type' }
 */

const CLOSE_UNAUTHORIZED = 4401;

interface HubClient {
  ws: WebSocket;
  user: AuthUser;
  connectedAt: number;
}

const clients = new Set<HubClient>();

function send(ws: WebSocket, message: object): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message));
}

export function attachWsHub(server: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req: IncomingMessage, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token') || '';
    const user = token ? verifyToken(token) : null;
    if (!user) {
      // Complete the upgrade so we can send a meaningful close code instead of a raw TCP reset.
      wss.handleUpgrade(req, socket, head, (ws) => {
        ws.close(CLOSE_UNAUTHORIZED, 'invalid or missing token');
      });
      return;
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req, user);
    });
  });

  wss.on('connection', (ws: WebSocket, _req: IncomingMessage, user: AuthUser) => {
    const client: HubClient = { ws, user, connectedAt: Date.now() };
    clients.add(client);
    send(ws, { type: 'hello', userId: user.id });

    ws.on('message', (raw) => {
      let message: { type?: string };
      try {
        message = JSON.parse(raw.toString());
      } catch {
        send(ws, { type: 'error', error: 'invalid-json' });
        return;
      }

      switch (message.type) {
        case 'ping':
          send(ws, { type: 'pong' });
          break;
        // Phase 1: 'meeting:start', 'audio:segment', 'vad:event', 'meeting:end'
        default:
          send(ws, { type: 'error', error: 'unknown-message-type' });
      }
    });

    ws.on('close', () => clients.delete(client));
    ws.on('error', () => clients.delete(client));
  });

  return wss;
}

export function connectedClientCount(): number {
  return clients.size;
}
