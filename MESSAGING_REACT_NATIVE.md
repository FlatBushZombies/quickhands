# Real-time messaging (Socket.IO) — React Native

This backend exposes two-way chat over **Socket.IO**. Conversations are identified by **UUID v4** strings. **CORS** is shared with Express via `CLIENT_ORIGINS` (comma-separated). React Native clients often send **no `Origin` header**; that case is allowed so native apps can connect.

## Server contract

| Item | Value |
|------|--------|
| Transport | Polling + WebSocket (`socket.io-client` default) |
| Auth (current) | `userId` passed as **query** when connecting: `?userId=<your-user-id>` |
| Room naming | Internal: `conv:<conversationId>` — you only use `conversationId` in payloads |

### Client → server events

1. **`join_conversation`** — `{ conversationId: string /* UUID v4 */ }`  
   - Optional **ack**: `(err, { conversationId, room }) => void`

2. **`leave_conversation`** — `{ conversationId: string }`  
   - Optional ack: `(err, { conversationId }) => void`

3. **`send_message`** — `{ conversationId: string, text: string, clientMessageId?: string /* UUID v4 */ }`  
   - Optional ack: `(err, message) => void` — `message` includes server `id` and `createdAt`

### Server → client events

- **`message`** — payload shape:

```json
{
  "id": "uuid",
  "conversationId": "uuid",
  "senderId": "same as query userId",
  "text": "string",
  "createdAt": "ISO-8601",
  "clientMessageId": "optional, echoed if valid uuid"
}
```

### Environment

- **`CLIENT_ORIGINS`**: comma-separated list of allowed browser/dev origins (e.g. Expo web). Use `*` to allow any origin (dev only). Requests with **no** origin (typical for React Native) are still allowed when not using `*`.

### Connection URL

Use your API base **without** a path (Socket.IO attaches to the HTTP server root), for example:

`http://192.168.1.10:3000` or `https://api.example.com`

---

## Install (React Native / Expo)

```bash
npm install socket.io-client
```

---

## Hook: `useMessagingSocket`

Create `hooks/useMessagingSocket.ts` (adjust paths and `User` type to your app):

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export type ServerMessage = {
  id: string;
  conversationId: string;
  senderId: string;
  text: string;
  createdAt: string;
  clientMessageId?: string;
};

type Options = {
  /** e.g. process.env.EXPO_PUBLIC_API_URL or 'http://192.168.x.x:3000' */
  serverUrl: string;
  userId: string;
  conversationId: string;
  enabled?: boolean;
};

export function useMessagingSocket({
  serverUrl,
  userId,
  conversationId,
  enabled = true,
}: Options) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !userId || !conversationId) return;

    const socket = io(serverUrl, {
      query: { userId },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setLastError(null);
      socket.emit('join_conversation', { conversationId }, (err: unknown) => {
        if (err) setLastError(JSON.stringify(err));
      });
    });

    socket.on('disconnect', () => setConnected(false));

    socket.on('connect_error', (e) => {
      setLastError(e.message);
    });

    socket.on('message', (msg: ServerMessage) => {
      setMessages((prev) => {
        const next = [...prev, msg];
        return next;
      });
    });

    return () => {
      socket.emit('leave_conversation', { conversationId });
      socket.removeAllListeners();
      socket.close();
      socketRef.current = null;
    };
  }, [serverUrl, userId, conversationId, enabled]);

  const sendMessage = useCallback(
    (text: string, clientMessageId?: string) => {
      const s = socketRef.current;
      if (!s?.connected) {
        setLastError('Socket not connected');
        return;
      }
      s.emit(
        'send_message',
        { conversationId, text, ...(clientMessageId ? { clientMessageId } : {}) },
        (err: unknown, _msg: ServerMessage) => {
          if (err) setLastError(JSON.stringify(err));
        }
      );
    },
    [conversationId]
  );

  return { connected, messages, sendMessage, lastError, socket: socketRef };
}
```

---

## Screen: `ConversationChatScreen`

Example `screens/ConversationChatScreen.tsx` using the hook (Expo / React Navigation style):

```tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { randomUUID } from 'expo-crypto'; // or import { v4 as uuidv4 } from 'uuid';
import { useMessagingSocket } from '../hooks/useMessagingSocket';

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

type Props = {
  userId: string;
  conversationId: string; // UUID v4 shared by both participants (your app should agree on this)
};

export function ConversationChatScreen({ userId, conversationId }: Props) {
  const [draft, setDraft] = useState('');
  const { connected, messages, sendMessage, lastError } = useMessagingSocket({
    serverUrl: API_URL,
    userId,
    conversationId,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.status}>
        {connected ? 'Connected' : 'Connecting…'}
        {lastError ? ` — ${lastError}` : ''}
      </Text>

      <FlatList
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Text style={styles.meta}>
              {item.senderId === userId ? 'You' : item.senderId} ·{' '}
              {new Date(item.createdAt).toLocaleTimeString()}
            </Text>
            <Text style={styles.text}>{item.text}</Text>
          </View>
        )}
        ListEmptyComponent={
          !connected ? (
            <ActivityIndicator style={{ marginTop: 24 }} />
          ) : (
            <Text style={styles.empty}>No messages yet</Text>
          )
        }
      />

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message"
          placeholderTextColor="#888"
        />
        <Pressable
          style={styles.send}
          onPress={() => {
            const text = draft.trim();
            if (!text) return;
            sendMessage(text, randomUUID());
            setDraft('');
          }}
        >
          <Text style={styles.sendLabel}>Send</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 12, paddingTop: 48 },
  status: { fontSize: 12, marginBottom: 8, color: '#666' },
  row: { marginBottom: 12 },
  meta: { fontSize: 11, color: '#888' },
  text: { fontSize: 16, color: '#111' },
  empty: { textAlign: 'center', marginTop: 24, color: '#888' },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  send: {
    backgroundColor: '#2563eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
  },
  sendLabel: { color: '#fff', fontWeight: '600' },
});
```

### Notes

1. **`conversationId`**: Both users must use the **same** UUID (e.g. created when a thread is opened or returned from your REST API). The server does not persist messages yet; it only routes by room.
2. **LAN testing**: Use your machine’s LAN IP in `EXPO_PUBLIC_API_URL`, not `localhost`, when testing on a physical device.
3. **`userId`**: Align with your backend user identifiers (e.g. Clerk `userId` or internal DB id) so `senderId` in events matches your app’s user model.
