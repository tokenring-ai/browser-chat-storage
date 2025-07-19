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
	/**
	 * Creates a new BrowserChatMessageStorage instance.
	 *
	 * @param {Object} options - Configuration options (optional).
	 * @throws {Error} When localStorage is not available.
	 */
	constructor(options = {}) {
		super();

		if (typeof localStorage === "undefined") {
			throw new Error("localStorage is not available in this environment");
		}

		this.storagePrefix = options.storagePrefix || "chat_";
		this.initializeStorage();
	}

	/** @type {string} Prefix for localStorage keys */
	storagePrefix;

	/**
	 * Initializes the localStorage structure if it doesn't exist.
	 * @private
	 */
	initializeStorage() {
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
	 * @param {string} type - Either 'sessionId' or 'messageId'
	 * @returns {number} The next available ID
	 */
	getNextId(type) {
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
	 * @param {string} title - The session title
	 * @returns {Object} The created session object
	 */
	storeSession(title) {
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
	 * @param {import('@token-ring/ai-client/ChatMessageStorage').ChatMessage} currentMessage - The current chat message.
	 * @param {Object} request - The request object to store.
	 * @param {Object} response - The response object to store.
	 * @returns {Promise<import('@token-ring/ai-client/ChatMessageStorage').ChatMessage>} The stored message.
	 * @throws {Error} If the localStorage operation fails.
	 */
	storeChat(currentMessage, request, response) {
		try {
			let sessionId = currentMessage?.sessionId;

			if (!sessionId) {
				const lastMessage = request.messages?.[request.messages.length - 1];
				const title =
					lastMessage?.content?.replace(/^(.{1,100})(\s.*|$)/, (_, a) => a) ??
					"New Chat";

				const session = this.storeSession(title);
				sessionId = session.id;
			}

			const messagesKey = `${this.storagePrefix}messages`;
			const messages = JSON.parse(localStorage.getItem(messagesKey) || "[]");

			const message = {
				id: this.getNextId("messageId"),
				sessionId: sessionId,
				previousMessageId: currentMessage?.id || null,
				request: request,
				response: response,
				cumulativeInputLength: 0, // You may want to calculate this based on your needs
				updatedAt: Date.now(),
			};

			messages.push(message);
			localStorage.setItem(messagesKey, JSON.stringify(messages));

			return Promise.resolve(message);
		} catch (error) {
			throw new Error(`Failed to store chat message: ${error.message}`);
		}
	}

	/**
	 * Retrieves a message by its ID from localStorage.
	 *
	 * @param {number|string} id - The message ID.
	 * @returns {Promise<import('@token-ring/ai-client/ChatMessageStorage').ChatMessage>} The retrieved message.
	 * @throws {Error} When message is not found or localStorage error occurs.
	 */
	async retrieveMessageById(id) {
		try {
			const messagesKey = `${this.storagePrefix}messages`;
			const messages = JSON.parse(localStorage.getItem(messagesKey) || "[]");

			const message = messages.find((msg) => msg.id == id);

			if (!message) {
				throw new Error(`Message with id ${id} not found`);
			}

			return message;
		} catch (error) {
			if (error.message.includes("not found")) {
				throw error;
			}
			throw new Error(`Failed to retrieve message: ${error.message}`);
		}
	}

	/**
	 * Retrieves all messages for a specific session.
	 *
	 * @param {number|string} sessionId - The session ID.
	 * @returns {Promise<Array<import('@token-ring/ai-client/ChatMessageStorage').ChatMessage>>} Array of messages for the session.
	 */
	async retrieveMessagesBySession(sessionId) {
		try {
			const messagesKey = `${this.storagePrefix}messages`;
			const messages = JSON.parse(localStorage.getItem(messagesKey) || "[]");

			return messages.filter((msg) => msg.sessionId == sessionId);
		} catch (error) {
			throw new Error(
				`Failed to retrieve messages for session: ${error.message}`,
			);
		}
	}

	/**
	 * Retrieves all sessions.
	 *
	 * @returns {Promise<Array<Object>>} Array of session objects.
	 */
	async retrieveAllSessions() {
		try {
			const sessionsKey = `${this.storagePrefix}sessions`;
			const sessions = JSON.parse(localStorage.getItem(sessionsKey) || "[]");
			return sessions;
		} catch (error) {
			throw new Error(`Failed to retrieve sessions: ${error.message}`);
		}
	}

	/**
	 * Clears all stored data from localStorage.
	 *
	 * @returns {Promise<void>}
	 */
	async clearAllData() {
		try {
			localStorage.removeItem(`${this.storagePrefix}sessions`);
			localStorage.removeItem(`${this.storagePrefix}messages`);
			localStorage.removeItem(`${this.storagePrefix}counters`);
			this.initializeStorage();
		} catch (error) {
			throw new Error(`Failed to clear data: ${error.message}`);
		}
	}
}
