# Real-time messaging (Socket.IO) — React Native + Clerk

## Why you see “socket not connected” on Vercel

The API at [https://quickhands-api.vercel.app/](https://quickhands-api.vercel.app/) is deployed as **Vercel serverless functions**. Socket.IO needs a **long‑lived HTTP server** and sticky connections; **serverless invocations do not keep WebSocket / Engine.IO sessions alive** between requests, so connections fail or drop even if routes point at `api/index.js`.

**What to do**

1. **Run the same Node app on a long‑running host** (e.g. [Railway](https://railway.app/), [Render](https://render.com/), [Fly.io](https://fly.io/), a VPS) using `node src/index.js` (or your start command), and set **`EXPO_PUBLIC_SOCKET_URL`** (and API URL) to that origin **without a trailing slash**, e.g. `https://your-socket-host.example.com`.
2. Keep **REST + DB** on Vercel if you want; only the **Socket.IO process** must be on a traditional server.
3. For local dev, `npm run dev` works; use your LAN IP from a device, not `localhost`.

Until you deploy sockets separately, expect **`connect_error`** / **`missing_auth_token`** / disconnects against the Vercel URL.

---

## REST API (Clerk Bearer token)

Use the same **`Authorization: Bearer <Clerk JWT>`** as your other protected routes.

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/messaging/users?q=&limit=` | List registered users (excludes you); optional search on name/email |
| `GET` | `/api/messaging/conversation-with/:otherClerkId` | Returns **`conversationId`** (deterministic UUID v5 for the pair) and **`otherUser`** |

Flow: list users → pick one → call **`conversation-with/:otherClerkId`** → open chat with returned **`conversationId`**.

---

## Socket.IO auth (required)

Connections **must** send a **Clerk session JWT** (not `userId` in query):

```ts
io(serverUrl, {
  auth: { token: await getToken() },
  transports: ['websocket', 'polling'],
});
```

Optional dev-only bypass: set **`ALLOW_SOCKET_QUERY_USER=true`** on the server and pass **`query: { userId }`** — **do not use in production**.

---

## Server contract

| Item | Value |
|------|--------|
| Transport | Polling + WebSocket |
| Auth | **`auth.token`** = Clerk JWT (`sub` = Clerk user id) |
| `conversationId` | Any standard **UUID** (DM ids from the API are **v5**) |
| Room (internal) | `conv:<conversationId>` |

### Client → server

- **`join_conversation`** — `{ conversationId }` — ack `(err, { conversationId, room })`
- **`leave_conversation`** — `{ conversationId }`
- **`send_message`** — `{ conversationId, text, clientMessageId? }`

### Server → client

- **`message`** — `{ id, conversationId, senderId, text, createdAt, clientMessageId? }` — `senderId` is the Clerk user id

### Environment (backend)

- **`CLIENT_ORIGINS`**: comma-separated origins for browser/Expo web; React Native often sends **no** `Origin` (still allowed).
- **`CLERK_SECRET_KEY`**: required to verify socket JWTs.

### Connection URL

Use the **socket host base URL** with **no trailing slash**:

`https://your-api.example.com` — Socket.IO uses path `/socket.io` automatically.

---

## Install (React Native / Expo)

```bash
npm install socket.io-client
```

Use **`@clerk/clerk-expo`** (or your Clerk RN SDK) for **`getToken`**.

---

## Hook: `useMessagingSocket`

`hooks/useMessagingSocket.ts`:

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
  /** Long-running Node host (not Vercel serverless for production) */
  serverUrl: string;
  getToken: () => Promise<string | null>;
  conversationId: string;
  enabled?: boolean;
};

export function useMessagingSocket({
  serverUrl,
  getToken,
  conversationId,
  enabled = true,
}: Options) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [messages, setMessages] = useState<ServerMessage[]>([]);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !conversationId) return;

    let cancelled = false;
    let socket: Socket | null = null;

    (async () => {
      const token = await getToken();
      if (!token || cancelled) {
        setLastError('Not signed in');
        return;
      }

      socket = io(serverUrl, {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on('connect', () => {
        setConnected(true);
        setLastError(null);
        socket!.emit('join_conversation', { conversationId }, (err: unknown) => {
          if (err) setLastError(JSON.stringify(err));
        });
      });

      socket.on('disconnect', () => setConnected(false));

      socket.on('connect_error', (e: Error) => {
        setLastError(e.message);
      });

      socket.on('message', (msg: ServerMessage) => {
        setMessages((prev) => [...prev, msg]);
      });
    })();

    return () => {
      cancelled = true;
      if (socket) {
        socket.emit('leave_conversation', { conversationId });
        socket.removeAllListeners();
        socket.close();
      }
      socketRef.current = null;
    };
  }, [serverUrl, getToken, conversationId, enabled]);

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
        (err: unknown) => {
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

## Hook: `useMessagingUsers`

`hooks/useMessagingUsers.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';

export type ChatUser = {
  clerkId: string;
  displayName: string;
  email: string;
  imageUrl: string | null;
  skills: string | null;
};

type Options = {
  apiUrl: string;
  getToken: () => Promise<string | null>;
};

export function useMessagingUsers({ apiUrl, getToken }: Options) {
  const [users, setUsers] = useState<ChatUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) {
        setError('Not signed in');
        return;
      }
      const base = apiUrl.replace(/\/$/, '');
      const res = await fetch(`${base}/api/messaging/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load users');
      setUsers(data.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [apiUrl, getToken]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { users, loading, error, refresh };
}
```

---

## Screen: `ChatUsersScreen`

Pick a user, resolve `conversationId`, navigate to chat.

`screens/ChatUsersScreen.tsx`:

```tsx
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Pressable,
  ActivityIndicator,
  StyleSheet,
  TextInput,
} from 'react-native';
import { useAuth } from '@clerk/clerk-expo';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

type Props = {
  onOpenChat: (params: {
    conversationId: string;
    otherUser: { clerkId: string; displayName: string };
  }) => void;
};

export function ChatUsersScreen({ onOpenChat }: Props) {
  const { getToken } = useAuth();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<
    { clerkId: string; displayName: string; email: string }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) {
        setErr('Not signed in');
        return;
      }
      const qs = q.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
      const res = await fetch(`${API_URL}/api/messaging/users${qs}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to load');
      setUsers(data.users || []);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, [getToken, q]);

  React.useEffect(() => {
    load();
  }, [load]);

  const startChat = async (otherClerkId: string, displayName: string) => {
    const token = await getToken();
    if (!token) return;
    const res = await fetch(
      `${API_URL}/api/messaging/conversation-with/${encodeURIComponent(otherClerkId)}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!res.ok) {
      setErr(data.message || 'Could not open chat');
      return;
    }
    onOpenChat({
      conversationId: data.conversationId,
      otherUser: { clerkId: otherClerkId, displayName: data.otherUser?.displayName ?? displayName },
    });
  };

  if (!API_URL) {
    return (
      <View style={styles.centered}>
        <Text>Set EXPO_PUBLIC_API_URL</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Messages</Text>
      <TextInput
        style={styles.search}
        placeholder="Search users"
        value={q}
        onChangeText={setQ}
        onSubmitEditing={load}
      />
      {err ? <Text style={styles.err}>{err}</Text> : null}
      {loading ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.clerkId}
          renderItem={({ item }) => (
            <Pressable
              style={styles.row}
              onPress={() => startChat(item.clerkId, item.displayName)}
            >
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.sub}>{item.email}</Text>
            </Pressable>
          )}
          ListEmptyComponent={<Text style={styles.empty}>No users yet</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, paddingTop: 48 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 12 },
  search: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 10,
    marginBottom: 12,
  },
  row: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  name: { fontSize: 16, fontWeight: '600' },
  sub: { fontSize: 13, color: '#666' },
  err: { color: 'crimson', marginBottom: 8 },
  empty: { textAlign: 'center', marginTop: 24, color: '#888' },
});
```

---

## Screen: `ConversationChatScreen`

Use **`EXPO_PUBLIC_SOCKET_URL`** when you deploy sockets separately; otherwise fall back to API URL for local dev.

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
import { useAuth } from '@clerk/clerk-expo';
import { randomUUID } from 'expo-crypto';
import { useMessagingSocket } from '../hooks/useMessagingSocket';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
const SOCKET_URL = (process.env.EXPO_PUBLIC_SOCKET_URL ?? API_URL).replace(/\/$/, '');

type Props = {
  clerkUserId: string;
  conversationId: string;
  otherDisplayName?: string;
};

export function ConversationChatScreen({
  clerkUserId,
  conversationId,
  otherDisplayName,
}: Props) {
  const { getToken } = useAuth();
  const [draft, setDraft] = useState('');

  const { connected, messages, sendMessage, lastError } = useMessagingSocket({
    serverUrl: SOCKET_URL,
    getToken,
    conversationId,
    enabled: !!SOCKET_URL,
  });

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{otherDisplayName ?? 'Chat'}</Text>
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
              {item.senderId === clerkUserId ? 'You' : otherDisplayName ?? item.senderId}{' '}
              · {new Date(item.createdAt).toLocaleTimeString()}
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
  header: { fontSize: 18, fontWeight: '600', marginBottom: 4 },
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

---

## Checklist

1. **Deploy Socket.IO** on a non-serverless host; point **`EXPO_PUBLIC_SOCKET_URL`** at it.
2. **REST** can stay on Vercel — use **`EXPO_PUBLIC_API_URL=https://quickhands-api.vercel.app`** for `/api/messaging/*`.
3. Pass **`auth: { token: await getToken() }`** on the socket; **`senderId`** will match **`user.id`** from Clerk.
4. **Users must exist** in your `users` table (same flow as sign-up / `POST /api/user`) to appear in the list.
