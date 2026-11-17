import type http from 'http';
import type { Duplex } from 'stream';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyAuthToken } from './auth.ts';

export type ChatRoomType = 'dm' | 'group' | 'global';

interface ClientMeta {
  uid: string;
  username: string;
  role: 'member' | 'founder';
  roomKey: string;
  isAlive: boolean;
}

const uidSockets = new Map<string, Set<WebSocket>>();
const roomSockets = new Map<string, Set<WebSocket>>();
const clientMeta = new WeakMap<WebSocket, ClientMeta>();

let wssInstance: WebSocketServer | null = null;

function subscribeSocketToRoom(ws: WebSocket, nextRoomKey: string) {
  const meta = clientMeta.get(ws);
  if (!meta) return;

  if (meta.roomKey && meta.roomKey !== nextRoomKey) {
    const oldSet = roomSockets.get(meta.roomKey);
    if (oldSet) {
      oldSet.delete(ws);
      if (oldSet.size === 0) roomSockets.delete(meta.roomKey);
    }
  }

  meta.roomKey = nextRoomKey;
  if (!nextRoomKey) return;

  let nextSet = roomSockets.get(nextRoomKey);
  if (!nextSet) {
    nextSet = new Set();
    roomSockets.set(nextRoomKey, nextSet);
  }
  nextSet.add(ws);
}

function cleanupSocket(ws: WebSocket) {
  const meta = clientMeta.get(ws);
  if (!meta) return;

  const uSet = uidSockets.get(meta.uid);
  if (uSet) {
    uSet.delete(ws);
    if (uSet.size === 0) uidSockets.delete(meta.uid);
  }

  if (meta.roomKey) {
    const rSet = roomSockets.get(meta.roomKey);
    if (rSet) {
      rSet.delete(ws);
      if (rSet.size === 0) roomSockets.delete(meta.roomKey);
    }
  }
}

function sendJson(ws: WebSocket, payload: unknown) {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // Ignore transient closed-socket write errors
  }
}

function dispatchToTargets(
  payload: unknown,
  options: { roomKey?: string; targetUids?: string[]; excludeUid?: string }
) {
  const recipients = new Set<WebSocket>();

  if (options.roomKey) {
    const rSet = roomSockets.get(options.roomKey);
    if (rSet) {
      for (const ws of rSet) recipients.add(ws);
    }
  }

  if (options.targetUids && options.targetUids.length > 0) {
    for (const uid of options.targetUids) {
      if (!uid) continue;
      const uSet = uidSockets.get(uid);
      if (uSet) {
        for (const ws of uSet) recipients.add(ws);
      }
    }
  }

  if (recipients.size === 0) return;

  const serialized = JSON.stringify(payload);
  for (const ws of recipients) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    const meta = clientMeta.get(ws);
    if (options.excludeUid && meta?.uid === options.excludeUid) continue;
    try {
      ws.send(serialized);
    } catch {
      // Ignore write error on closing socket
    }
  }
}

export function attachChatWebSocketServer(httpServer: http.Server): void {
  if (wssInstance) return;

  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  const heartbeatInterval = setInterval(() => {
    for (const ws of wss.clients) {
      const meta = clientMeta.get(ws);
      if (!meta) continue;
      if (!meta.isAlive) {
        cleanupSocket(ws);
        ws.terminate();
        continue;
      }
      meta.isAlive = false;
      try {
        ws.ping();
      } catch {
        // Ignore ping error
      }
    }
  }, 25000);

  wss.on('close', () => {
    clearInterval(heartbeatInterval);
  });

  httpServer.on('upgrade', (request: http.IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const parsed = new URL(request.url || '/', 'http://localhost');
      if (parsed.pathname !== '/ws/chat') {
        return;
      }

      const token = String(parsed.searchParams.get('token') || '').trim();
      const authUser = token ? verifyAuthToken(token) : null;
      if (!authUser) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        const meta: ClientMeta = {
          uid: authUser.uid,
          username: authUser.username,
          role: authUser.role,
          roomKey: '',
          isAlive: true,
        };
        clientMeta.set(ws, meta);

        let uSet = uidSockets.get(authUser.uid);
        if (!uSet) {
          uSet = new Set();
          uidSockets.set(authUser.uid, uSet);
        }
        uSet.add(ws);

        sendJson(ws, { type: 'chat:connected', uid: authUser.uid, ts: Date.now() });

        ws.on('pong', () => {
          const m = clientMeta.get(ws);
          if (m) m.isAlive = true;
        });

        ws.on('message', (raw) => {
          const m = clientMeta.get(ws);
          if (!m) return;
          m.isAlive = true;

          let msg: any;
          try {
            msg = JSON.parse(String(raw));
          } catch {
            return;
          }

          if (!msg || typeof msg !== 'object') return;

          if (msg.type === 'ping') {
            sendJson(ws, { type: 'pong', ts: Date.now() });
            return;
          }

          if (msg.type === 'subscribe') {
            const roomKey = String(msg.roomKey || '').trim().slice(0, 120);
            subscribeSocketToRoom(ws, roomKey);
            return;
          }

          if (msg.type === 'typing') {
            const roomType = String(msg.roomType || '') as ChatRoomType;
            const roomKey = String(msg.roomKey || '').trim().slice(0, 120);
            const peerUid = String(msg.peerUid || '').trim().slice(0, 60);
            const name = String(msg.name || m.username || 'User').trim().slice(0, 50);
            const isTyping = Boolean(msg.isTyping);
            if (!roomKey) return;

            const payload = {
              type: 'chat:typing',
              roomType,
              roomKey,
              uid: m.uid,
              name,
              isTyping,
              ts: Date.now(),
            };

            dispatchToTargets(payload, {
              roomKey,
              targetUids: roomType === 'dm' && peerUid ? [peerUid] : undefined,
              excludeUid: m.uid,
            });
          }
        });

        ws.on('close', () => cleanupSocket(ws));
        ws.on('error', () => cleanupSocket(ws));
      });
    } catch {
      socket.destroy();
    }
  });
}

export function broadcastChatMessage(
  roomType: ChatRoomType,
  roomKey: string,
  message: Record<string, any>,
  targetUids?: string[]
) {
  dispatchToTargets(
    {
      type: 'chat:message',
      roomType,
      roomKey,
      message,
      ts: Date.now(),
    },
    { roomKey, targetUids }
  );
}

export function broadcastChatReaction(
  roomType: ChatRoomType,
  roomKey: string,
  messageId: string,
  reactions: Record<string, string[]>,
  targetUids?: string[]
) {
  dispatchToTargets(
    {
      type: 'chat:reaction',
      roomType,
      roomKey,
      messageId,
      reactions,
      ts: Date.now(),
    },
    { roomKey, targetUids }
  );
}

export function broadcastChatEdit(
  roomType: ChatRoomType,
  roomKey: string,
  messageId: string,
  text: string,
  editedAt: string,
  targetUids?: string[]
) {
  dispatchToTargets(
    {
      type: 'chat:edit',
      roomType,
      roomKey,
      messageId,
      text,
      editedAt,
      ts: Date.now(),
    },
    { roomKey, targetUids }
  );
}

export function broadcastChatDelete(
  roomType: ChatRoomType,
  roomKey: string,
  messageId: string,
  targetUids?: string[]
) {
  dispatchToTargets(
    {
      type: 'chat:delete',
      roomType,
      roomKey,
      messageId,
      ts: Date.now(),
    },
    { roomKey, targetUids }
  );
}

export function broadcastDmRead(
  conversationId: string,
  readerUid: string,
  peerUid: string,
  readAt: string
) {
  const roomKey = `dm:${conversationId}`;
  dispatchToTargets(
    {
      type: 'chat:read',
      roomType: 'dm',
      roomKey,
      conversationId,
      readerUid,
      peerUid,
      readAt,
      ts: Date.now(),
    },
    { roomKey, targetUids: [peerUid, readerUid] }
  );
}
