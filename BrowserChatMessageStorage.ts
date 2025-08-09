import { ChatMessageStorage } from "@token-ring/ai-client";

/**
 * Browser localStorage-based implementation of ChatMessageStorage that provides
 * client-side persistent storage for chat messages and sessions.
 *
 * This implementation:
 * - Persists chat messages and sessions to browser localStorage
 * - Supports message history and retrieval
 * - Maintains conversation context across browser sessions
 * - Provides efficient querying and storage operations
 *
 * Storage Structure:
 * - `chat_sessions`: JSON array of session objects
 * - `chat_messages`: JSON array of message objects
 * - `chat_counters`: JSON object with id counters for sessions and messages
 *
 * @extends ChatMessageStorage
 */
export default class BrowserChatMessageStorage extends ChatMessageStorage {
	/** @type {string} Prefix for localStorage keys */
	storagePrefix!: string;

	/**
	 * Creates a new BrowserChatMessageStorage instance.
	 *
	 * @param options - Configuration options (optional).
	 * @throws {Error} When localStorage is not available.
	 */
	constructor(options: { storagePrefix?: string } = {}) {
		super();

		if (typeof localStorage === "undefined") {
			throw new Error("localStorage is not available in this environment");
		}

		this.storagePrefix = options.storagePrefix || "chat_";
		this.initializeStorage();
	}

	/**
	 * Initializes the localStorage structure if it doesn't exist.
	 * @private
	 */
	initializeStorage(): void {
		const sessionsKey = `${this.storagePrefix}sessions`;
		const messagesKey = `${this.storagePrefix}messages`;
		const countersKey = `${this.storagePrefix}counters`;

		if (!localStorage.getItem(sessionsKey)) {
			localStorage.setItem(sessionsKey, JSON.stringify([]));
		}

		if (!localStorage.getItem(messagesKey)) {
			localStorage.setItem(messagesKey, JSON.stringify([]));
		}

		if (!localStorage.getItem(countersKey)) {
			localStorage.setItem(
				countersKey,
				JSON.stringify({
					sessionId: 1,
					messageId: 1,
				}),
			);
		}
	}

	/**
	 * Gets and increments the next available ID for the specified type.
	 * @private
	 * @param type - Either 'sessionId' or 'messageId'
	 * @returns The next available ID
	 */
	getNextId(type: "sessionId" | "messageId"): number {
		const countersKey = `${this.storagePrefix}counters`;
		const counters = JSON.parse(localStorage.getItem(countersKey) || "{}");
		const nextId = counters[type] || 1;
		counters[type] = nextId + 1;
		localStorage.setItem(countersKey, JSON.stringify(counters));
		return nextId;
	}

	/**
	 * Stores a session in localStorage.
	 * @private
	 * @param title - The session title
	 * @returns The created session object
	 */
	storeSession(title: string): { id: number; title: string } {
		const sessionsKey = `${this.storagePrefix}sessions`;
		const sessions = JSON.parse(localStorage.getItem(sessionsKey) || "[]");

		const session = {
			id: this.getNextId("sessionId"),
			title: title,
		};

		sessions.push(session);
		localStorage.setItem(sessionsKey, JSON.stringify(sessions));

		return session;
	}

	/**
	 * Stores a chat message in localStorage.
	 *
	 * @param currentMessage - The current chat message.
	 * @param request - The request object to store.
	 * @param response - The response object to store.
	 * @returns The stored message.
	 * @throws {Error} If the localStorage operation fails.
	 */
	storeChat(currentMessage: any, request: any, response: any): Promise<any> {
		try {
			let sessionId = currentMessage?.sessionId as number | string | undefined;

			if (!sessionId) {
				const lastMessage = request.messages?.[request.messages.length - 1];
				const title =
					lastMessage?.content?.replace(
						/^(.{1,100})(\s.*|$)/,
						(_: any, a: string) => a,
					) ?? "New Chat";

				const session = this.storeSession(title);
				sessionId = session.id;
			}

			const messagesKey = `${this.storagePrefix}messages`;
			const messages = JSON.parse(localStorage.getItem(messagesKey) || "[]");

			const message = {
				id: this.getNextId("messageId"),
				sessionId: sessionId as number | string,
				previousMessageId: currentMessage?.id || null,
				request: request,
				response: response,
				cumulativeInputLength: 0,
				updatedAt: Date.now(),
			};

			messages.push(message);
			localStorage.setItem(messagesKey, JSON.stringify(messages));

			return Promise.resolve(message);
		} catch (error: any) {
			throw new Error(`Failed to store chat message: ${error.message}`);
		}
	}

	/**
	 * Retrieves a message by its ID from localStorage.
	 *
	 * @param id - The message ID.
	 * @returns The retrieved message.
	 * @throws {Error} When message is not found or localStorage error occurs.
	 */
	async retrieveMessageById(id: number | string): Promise<any> {
		try {
			const messagesKey = `${this.storagePrefix}messages`;
			const messages = JSON.parse(localStorage.getItem(messagesKey) || "[]");

			const message = messages.find((msg: any) => msg.id == id);

			if (!message) {
				throw new Error(`Message with id ${id} not found`);
			}

			return message;
		} catch (error: any) {
			if (error.message.includes("not found")) {
				throw error;
			}
			throw new Error(`Failed to retrieve message: ${error.message}`);
		}
	}

	/**
	 * Retrieves all messages for a specific session.
	 *
	 * @param sessionId - The session ID.
	 * @returns Array of messages for the session.
	 */
	async retrieveMessagesBySession(sessionId: number | string): Promise<any[]> {
		try {
			const messagesKey = `${this.storagePrefix}messages`;
			const messages = JSON.parse(localStorage.getItem(messagesKey) || "[]");

			return messages.filter((msg: any) => msg.sessionId == sessionId);
		} catch (error: any) {
			throw new Error(
				`Failed to retrieve messages for session: ${error.message}`,
			);
		}
	}

	/**
	 * Retrieves all sessions.
	 *
	 * @returns Array of session objects.
	 */
	async retrieveAllSessions(): Promise<any[]> {
		try {
			const sessionsKey = `${this.storagePrefix}sessions`;
			const sessions = JSON.parse(localStorage.getItem(sessionsKey) || "[]");
			return sessions;
		} catch (error: any) {
			throw new Error(`Failed to retrieve sessions: ${error.message}`);
		}
	}

	/**
	 * Clears all stored data from localStorage.
	 *
	 * @returns void
	 */
	async clearAllData(): Promise<void> {
		try {
			localStorage.removeItem(`${this.storagePrefix}sessions`);
			localStorage.removeItem(`${this.storagePrefix}messages`);
			localStorage.removeItem(`${this.storagePrefix}counters`);
			this.initializeStorage();
		} catch (error: any) {
			throw new Error(`Failed to clear data: ${error.message}`);
		}
	}
}
