# @token-ring/browser-chat-storage

Browser-local storage utilities for chat applications in the Token Ring ecosystem.

This package provides browser-based implementations backed by `localStorage` for:
- Chat history and sessions (BrowserChatHistoryService)
- Conversation checkpoints (BrowserCheckpointService)
- A lightweight message store compatible with `ChatMessageStorage` (BrowserChatMessageStorage)
- Agent state checkpoints (BrowserAgentStateStorage)

It is designed for client-side persistence in web apps, without a backend database.

## Features

- Stores chat sessions and messages in `localStorage`
- Create, rename, delete, and list chat sessions
- Add messages and retrieve recent messages per session
- Basic full-text search within a session
- Per-session checkpoints for quick restores
- Simple message storage that can auto-create a session from the first prompt
- Optional key prefixing/instance IDs to namespace data

## When to use this package

Use this package if you are building a purely client-side chat experience where data can live in the browser. If you need server-side persistence, multi-device sync, or large histories, consider using a server-backed storage instead.

## Installation

This package is part of the monorepo and is consumed as a workspace dependency. In an external project you would install it via npm:

```bash
npm install @token-ring/browser-chat-storage
```

## Quick start

```ts
import {
  BrowserChatHistoryService,
  BrowserCheckpointService,
  BrowserChatMessageStorage,
  BrowserAgentStateStorage,
} from "@token-ring/browser-chat-storage";

// History: manage sessions and per-session messages
const history = new BrowserChatHistoryService("myApp_"); // optional prefix
const session = await history.createSession("My First Chat");
await history.addMessage(session.id, { role: "user", content: "Hello" });
const recent = await history.getRecentMessages(session.id, 10);

// Checkpoints: snapshot a conversation state for a session
const checkpoints = new BrowserCheckpointService("tab42"); // optional instanceId
const cp = await checkpoints.createCheckpoint(
  "After greeting",
  { id: "msg-1", content: "Hello" },
  session.id,
);
const latestCp = await checkpoints.retrieveCheckpoint(0, session.id); // index 0 = newest

// Message storage: store a request/response pair, auto-creating a session if missing
const messageStore = new BrowserChatMessageStorage({ storagePrefix: "chat_" });
const stored = await messageStore.storeChat(
  /* currentMessage */ {},
  /* request */ { messages: [{ role: "user", content: "Hi there" }] },
  /* response */ { content: "Hello! How can I help?" },
);

// Agent state storage: store and retrieve agent checkpoints
const agentStorage = new BrowserAgentStateStorage("myApp_"); // optional prefix
const checkpointId = await agentStorage.storeCheckpoint({
  agentId: "agent-123",
  name: "After processing step 1",
  state: { currentStep: 1, data: { foo: "bar" } },
  createdAt: Date.now(),
});
const checkpoint = await agentStorage.retrieveCheckpoint(checkpointId);
const allCheckpoints = await agentStorage.listCheckpoints();
```

## API overview

### BrowserChatHistoryService

Constructor
- `new BrowserChatHistoryService(storageKeyPrefix?: string)`

Sessions
- `listSessions(): Promise<any[]>` — newest first
- `createSession(name?: string): Promise<any>`
- `deleteSession(sessionId: string | number): Promise<boolean>`
- `renameSession(sessionId: string | number, newName: string): Promise<any | null>`

Messages
- `addMessage(sessionId: string | number, message: any): Promise<any>`
- `getRecentMessages(sessionId: string | number, limit?: number): Promise<any[]>`
- `clearSessionHistory(sessionId: string | number): Promise<void>`
- `getThreadTree(sessionId: string | number): Promise<any[]>` — currently returns a flat list
- `searchMessages(keyword: string, sessionId: string | number): Promise<any[]>`

Notes
- Session metadata tracks `lastActivity` and a short `previewText` derived from the last message.
- Message keys are namespaced by the provided `storageKeyPrefix`.

### BrowserCheckpointService

Constructor
- `new BrowserCheckpointService(instanceId?: string)` — prefixes checkpoint keys with `"{instanceId}_"` when provided.

Checkpoints
- `createCheckpoint(label: string, currentMessage: any, sessionId: string | number): Promise<any>`
- `retrieveCheckpoint(idOrIdx: string | number, sessionId: string | number): Promise<any | null>` — accepts an ID or a numeric index (0 = newest)
- `listCheckpoint(sessionId: string | number): Promise<any[]>` — newest first
- `clearAllCheckpoints(sessionId: string | number): Promise<void>`

### BrowserChatMessageStorage

Extends `ChatMessageStorage` from `@token-ring/ai-client`.

Constructor
- `new BrowserChatMessageStorage(options?: { storagePrefix?: string })`

Storage operations
- `storeChat(currentMessage: any, request: any, response: any): Promise<any>` — stores a message; auto-creates a session from the last request message (first 100 chars used as title) when `currentMessage.sessionId` is missing
- `retrieveMessageById(id: string | number): Promise<any>`
- `retrieveMessagesBySession(sessionId: string | number): Promise<any[]>`
- `retrieveAllSessions(): Promise<any[]>`
- `clearAllData(): Promise<void>` — removes sessions, messages, and counters and re-initializes the store

### BrowserAgentStateStorage

Implements `AgentCheckpointProvider` from `@tokenring-ai/agent`.

Constructor
- `new BrowserAgentStateStorage(storageKeyPrefix?: string)` — prefixes checkpoint keys with the provided prefix

Checkpoint operations
- `storeCheckpoint(checkpoint: NamedAgentCheckpoint): Promise<string>` — stores a checkpoint and returns its ID
- `retrieveCheckpoint(checkpointId: string): Promise<StoredAgentCheckpoint | null>` — retrieves a checkpoint by ID
- `listCheckpoints(): Promise<AgentCheckpointListItem[]>` — lists all checkpoints (newest first)
- `deleteCheckpoint(checkpointId: string): Promise<boolean>` — deletes a specific checkpoint
- `clearAllCheckpoints(): Promise<void>` — removes all checkpoints

## Storage layout (localStorage keys)

Exact keys depend on the constructor options:

BrowserChatHistoryService
- Sessions list: `{storageKeyPrefix}sessions_v1`
- Messages per session: `{storageKeyPrefix}history_{sessionId}`

BrowserCheckpointService
- Checkpoints per session: `{instanceId_}tokenRingCheckpoints_v1_{sessionId}` (the `{instanceId_}` prefix is included only when you pass an `instanceId`)

BrowserChatMessageStorage (prefix defaults to `chat_`)
- Sessions: `{storagePrefix}sessions`
- Messages: `{storagePrefix}messages`
- Counters: `{storagePrefix}counters` with `{ sessionId, messageId }`

BrowserAgentStateStorage (prefix defaults to `tokenRingAgentState_v1_`)
- All checkpoints: `{storageKeyPrefix}checkpoints`

## Limitations

- Browser `localStorage` capacity is limited (typically ~5MB per origin)
- Data is scoped to a specific browser and origin; no cross-device sync
- No server-side backup or multi-user collaboration
- `getThreadTree` is a placeholder returning a flat list
- `getChatHistoryByMessageId` in BrowserChatHistoryService returns an empty array because the base interface lacks the required `sessionId`

## TypeScript

This package is authored in TypeScript and published as an ES module. Import types from the corresponding upstream packages if needed.

## License

MIT
