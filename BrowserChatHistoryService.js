import { ChatHistoryService } from '@token-ring/history';

const DEFAULT_GLOBAL_SESSIONS_LIST_KEY = 'tokenRingGlobalChatSessions_v1'; // For discovery if needed
const DEFAULT_STORAGE_PREFIX = 'tokenRingChat_'; // Default if no prefix provided

/**
 * Browser-based implementation of ChatHistoryService that uses localStorage
 * for persistent storage of chat sessions and message history.
 * 
 * This implementation:
 * - Stores chat data in the browser's localStorage
 * - Supports session management with metadata (name, preview, last activity)
 * - Provides message history with basic search capabilities
 * - Handles session creation, deletion, and renaming
 * - Maintains conversation context within browser sessions
 * 
 * Storage Structure:
 * - Session list stored under SESSIONS_LIST_KEY
 * - Individual session messages stored under CHAT_HISTORY_STORAGE_KEY_PREFIX + sessionId
 * 
 * Limitations:
 * - Limited by browser localStorage size constraints
 * - Data is tied to specific browser/domain
 * - No server-side persistence or cross-device synchronization
 * 
 * @extends ChatHistoryService
 */
export default class BrowserChatHistoryService extends ChatHistoryService {
  /** @type {string} */
  name = "BrowserChatHistoryService";
  /** @type {string} */
  storageKeyPrefix;
  /** @type {string} */
  sessionsListKey;

  /**
   * Creates a new BrowserChatHistoryService instance.
   * @param {string} [storageKeyPrefix] - Optional prefix for localStorage keys to achieve isolation.
   */
  constructor(storageKeyPrefix) {
    super();
    this.storageKeyPrefix = storageKeyPrefix || DEFAULT_STORAGE_PREFIX;
    // Each instance will manage its own list of sessions, namespaced by the prefix.
    this.sessionsListKey = `${this.storageKeyPrefix}sessions_v1`;
    console.log(`BrowserChatHistoryService initialized with prefix: '${this.storageKeyPrefix}' and session list key: '${this.sessionsListKey}'`);
  }

  // --- Session List Management ---

  /**
   * Retrieves the list of sessions from localStorage for this instance.
   * @private
   * @returns {Array<import('@token-ring/history/ChatHistoryService').ChatSession>} Array of sessions
   */
  _getSessionsList() {
    try {
      const storedSessions = localStorage.getItem(this.sessionsListKey);
      return storedSessions ? JSON.parse(storedSessions) : [];
    } catch (error) {
      console.error(`Error reading sessions list from localStorage (key: ${this.sessionsListKey}):`, error);
      return [];
    }
  }

  /**
   * Saves the sessions list to localStorage for this instance.
   * @private
   * @param {Array<import('@token-ring/history/ChatHistoryService').ChatSession>} sessions - Sessions to save
   * @returns {void}
   */
  _saveSessionsList(sessions) {
    try {
      localStorage.setItem(this.sessionsListKey, JSON.stringify(sessions));
    } catch (error) {
      console.error("Error saving sessions list to localStorage:", error);
    }
  }

  /**
   * Returns all chat sessions ordered by last activity (newest first).
   * 
   * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatSession>>} Array of chat sessions
   */
  async listSessions() {
    const sessions = this._getSessionsList();
    // Sort by lastActivity descending (newest first)
    return Promise.resolve(sessions.sort((a, b) => b.lastActivity - a.lastActivity));
  }

  /**
   * Creates a new chat session with optional name.
   * Initializes empty message history for the session.
   * 
   * @param {string} [name] - Optional user-provided name for the session
   * @returns {Promise<import('@token-ring/history/ChatHistoryService').ChatSession>} The created session
   */
  async createSession(name) {
    const sessions = this._getSessionsList();
    const now = Date.now();
    const sessionId = now.toString(); // Simple unique ID based on timestamp
    // Default name if not provided or empty
    const sessionName = name && name.trim() ? name.trim() : `Chat @ ${new Date(now).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`;

    const newSession = {
      id: sessionId,
      title: sessionName, // Use 'title' to match ChatSession typedef
      name: sessionName, // Keep 'name' for backward compatibility
      lastActivity: now,
      createdAt: now,
      previewText: "New chat session." // Initial preview text
    };

    sessions.unshift(newSession); // Add to the beginning for most recent
    this._saveSessionsList(sessions);
    this._saveMessages(sessionId, []); // Initialize empty message history for the new session
    return Promise.resolve(newSession);
  }

  /**
   * Deletes a chat session and its associated message history.
   * 
   * @param {string|number} sessionId - The session identifier
   * @returns {Promise<boolean>} True if session was deleted, false if not found
   */
  async deleteSession(sessionId) {
    if (!sessionId) return Promise.resolve(false);
    let sessions = this._getSessionsList();
    const initialLength = sessions.length;
    sessions = sessions.filter(session => session.id !== sessionId);
    if (sessions.length < initialLength) {
      this._saveSessionsList(sessions);
      localStorage.removeItem(this._getSessionKey(sessionId));
      return Promise.resolve(true);
    }
    return Promise.resolve(false); // Session not found
  }

  /**
   * Renames an existing chat session.
   * 
   * @param {string|number} sessionId - The session identifier
   * @param {string} newName - The new name for the session
   * @returns {Promise<import('@token-ring/history/ChatHistoryService').ChatSession|null>} The updated session or null if not found
   */
  async renameSession(sessionId, newName) {
    if (!sessionId || !newName || !newName.trim()) return Promise.resolve(null);
    const sessions = this._getSessionsList();
    const sessionIndex = sessions.findIndex(session => session.id === sessionId);
    if (sessionIndex > -1) {
      sessions[sessionIndex].name = newName.trim();
      sessions[sessionIndex].title = newName.trim(); // Update both for consistency
      sessions[sessionIndex].lastActivity = Date.now();
      this._saveSessionsList(sessions);
      return Promise.resolve(sessions[sessionIndex]);
    }
    return Promise.resolve(null); // Session not found
  }

  // --- Message Management ---

  /**
   * Gets the localStorage key for a session's messages.
   * @private
   * @param {string|number} sessionId - The session identifier
   * @returns {string} The localStorage key
   * @throws {Error} When sessionId is not provided
   */
  _getSessionKey(sessionId) {
    if (!sessionId) {
        console.error("Session ID is required for message operations but was not provided.");
        throw new Error("Session ID is required for message operations.");
    }
    // Ensure message history keys are also namespaced by the instance's prefix
    return `${this.storageKeyPrefix}history_${sessionId}`;
  }

  /**
   * Retrieves messages for a session from localStorage.
   * @private
   * @param {string|number} sessionId - The session identifier
   * @returns {Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>} Array of messages
   */
  _getMessages(sessionId) {
    try {
      const storedMessages = localStorage.getItem(this._getSessionKey(sessionId));
      return storedMessages ? JSON.parse(storedMessages) : [];
    } catch (error) {
      console.error(`Error reading messages for session ${sessionId} from localStorage:`, error);
      return [];
    }
  }

  /**
   * Saves messages for a session to localStorage.
   * @private
   * @param {string|number} sessionId - The session identifier
   * @param {Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>} messages - Messages to save
   * @returns {void}
   */
  _saveMessages(sessionId, messages) {
    try {
      localStorage.setItem(this._getSessionKey(sessionId), JSON.stringify(messages));
    } catch (error) {
      console.error(`Error saving messages for session ${sessionId} to localStorage:`, error);
    }
  }

  /**
   * Updates session metadata with last activity and preview text.
   * @private
   * @param {string|number} sessionId - The session identifier
   * @param {string} [lastMessageText] - Text from the last message for preview
   * @returns {void}
   */
  _updateSessionMetadata(sessionId, lastMessageText) {
    const sessions = this._getSessionsList();
    const sessionIndex = sessions.findIndex(s => s.id === sessionId);
    if (sessionIndex > -1) {
      sessions[sessionIndex].lastActivity = Date.now();
      const preview = String(lastMessageText || "").substring(0, 50);
      sessions[sessionIndex].previewText = preview.length === 50 ? preview + "..." : preview;
      this._saveSessionsList(sessions);
    }
  }

  /**
   * Adds a message to a session's history.
   * This method is specific to the browser implementation and not part of the base ChatHistoryService interface.
   * 
   * @param {string|number} sessionId - The session identifier
   * @param {import('@token-ring/history/ChatHistoryService').ChatHistoryMessage} message - The message to add
   * @returns {Promise<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>} The stored message
   * @throws {Error} When sessionId is missing or message is invalid
   */
  async addMessage(sessionId, message) {
    if (!sessionId) return Promise.reject(new Error("Session ID is required to add a message."));
    if (!message || typeof message !== 'object') {
        console.error("Invalid message object provided to addMessage");
        return Promise.reject(new Error("Invalid message object."));
    }
    const messages = this._getMessages(sessionId);
    const messageToStore = {
        id: message.id || Date.now().toString(),
        timestamp: message.timestamp || Date.now(),
        createdAt: message.createdAt || Date.now(),
        sessionId: sessionId,
        ...message
    };
    messages.push(messageToStore);
    this._saveMessages(sessionId, messages);
    this._updateSessionMetadata(sessionId, message.content || message.text);
    return Promise.resolve(messageToStore);
  }

  /**
   * Gets the N most recent messages from a session.
   * Messages are returned in chronological order (oldest first).
   * 
   * @param {string|number} sessionId - The session identifier
   * @param {number} [limit=10] - Maximum number of messages to return
   * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>>} Array of recent messages
   */
  async getRecentMessages(sessionId, limit = 10) {
    if (!sessionId) return Promise.resolve([]);
    const messages = this._getMessages(sessionId);
    const sortedMessages = messages.sort((a, b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0));
    const recent = sortedMessages.slice(0, limit);
    return Promise.resolve(recent.reverse()); // Return in chronological order
  }

  /**
   * Clears all message history for a session.
   * This method is specific to the browser implementation.
   * 
   * @param {string|number} sessionId - The session identifier
   * @returns {Promise<void>}
   * @throws {Error} When sessionId is missing
   */
  async clearSessionHistory(sessionId) {
    if (!sessionId) return Promise.reject(new Error("Session ID is required to clear history."));
    this._saveMessages(sessionId, []);
    this._updateSessionMetadata(sessionId, "Chat history cleared.");
    return Promise.resolve();
  }

  /**
   * Gets the complete thread tree for a session.
   * Note: This implementation returns a flat list as thread tree functionality is not fully implemented.
   * 
   * @param {string|number} sessionId - The session identifier
   * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>>} Array of messages (flat list)
   * @throws {Error} When sessionId is missing
   */
  async getThreadTree(sessionId) {
    if (!sessionId) return Promise.reject(new Error("Session ID is required for getThreadTree."));
    console.warn("BrowserChatHistoryService: getThreadTree is not fully implemented. Returning flat list.");
    const messages = await this.getRecentMessages(sessionId, 50);
    return Promise.resolve(messages);
  }

  /**
   * Gets the complete chat history leading up to and including a specific message.
   * Returns all messages in the session up to the specified message in chronological order.
   * 
   * @param {string|number} messageId - The message identifier
   * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>>} Array of messages in conversation history
   * @throws {Error} When sessionId is missing (sessionId parameter was moved to match base class signature)
   */
  async getChatHistoryByMessageId(messageId) {
    // Note: This implementation requires sessionId but the base class signature doesn't include it
    // This is a limitation of the browser implementation
    console.warn("BrowserChatHistoryService: getChatHistoryByMessageId requires sessionId but base class doesn't provide it. Returning empty array.");
    return Promise.resolve([]);
  }

  /**
   * Searches for messages containing the specified keyword within a specific session.
   * Performs a case-insensitive search across message content and text fields.
   * 
   * @param {string} keyword - The keyword to search for
   * @param {string|number} sessionId - The session identifier to search within
   * @returns {Promise<Array<import('@token-ring/history/ChatHistoryService').ChatHistoryMessage>>} Array of matching messages
   * @throws {Error} When sessionId is missing
   */
  async searchMessages(keyword, sessionId) {
    if (!sessionId) return Promise.reject(new Error("Session ID is required for searchMessages."));
    if (!keyword) return Promise.resolve([]);

    const messages = this._getMessages(sessionId);
    const lowerKeyword = keyword.toLowerCase();
    const results = messages.filter(m => {
        const textToSearch = m.text || m.content || '';
        return textToSearch.toLowerCase().includes(lowerKeyword);
    });
    return Promise.resolve(results.sort((a,b) => (b.timestamp || b.createdAt || 0) - (a.timestamp || a.createdAt || 0)));
  }

  /**
   * Closes any resources used by the service.
   * No-op for browser implementation as localStorage doesn't require explicit closing.
   * 
   * @returns {void}
   */
  close() {
    // No resources to close for localStorage implementation
  }
}
