import { CheckpointService } from '@token-ring/history';

const DEFAULT_CHECKPOINT_PREFIX = 'tokenRingCheckpoints_v1_';

/**
 * Browser-based implementation of CheckpointService that uses localStorage
 * for persistent storage of conversation checkpoints.
 * 
 * This implementation:
 * - Stores checkpoints in the browser's localStorage
 * - Organizes checkpoints by session ID for isolation
 * - Supports checkpoint creation, retrieval, and listing
 * - Maintains checkpoint metadata including labels and timestamps
 * - Provides session-specific checkpoint management
 * 
 * Storage Structure:
 * - Checkpoints stored under CHECKPOINTS_STORAGE_KEY_PREFIX + sessionId
 * - Each checkpoint includes id, label, currentMessage, and timestamp
 * 
 * Limitations:
 * - Limited by browser localStorage size constraints
 * - Data is tied to specific browser/domain
 * - No server-side persistence or cross-device synchronization
 * 
 * @extends CheckpointService
 */
export default class BrowserCheckpointService extends CheckpointService {
  /** @type {string} */
  name = "BrowserCheckpointService";
  /** @type {string} */
  storageKeyPrefixWithInstanceId;

  /**
   * Creates a new BrowserCheckpointService instance.
   * @param {string} [instanceId] - An ID unique to this chat instance (e.g., tab ID or chat ID)
   *                                to namespace the checkpoints.
   */
  constructor(instanceId) {
    super();
    // If instanceId is provided, prepend it to the default prefix to ensure uniqueness.
    // This means all checkpoint operations for this service instance will be sandboxed
    // under keys like "chatXYZ_tokenRingCheckpoints_v1_sessionId".
    this.storageKeyPrefixWithInstanceId = instanceId
      ? `${instanceId}_${DEFAULT_CHECKPOINT_PREFIX}`
      : DEFAULT_CHECKPOINT_PREFIX;
    console.log(`BrowserCheckpointService initialized with effective prefix: '${this.storageKeyPrefixWithInstanceId}'`);
  }

  /**
   * Gets the localStorage key for a session's checkpoints.
   * @private
   * @param {string|number} sessionId - The session identifier
   * @returns {string} The localStorage key
   * @throws {Error} When sessionId is not provided
   */
  _getStorageKey(sessionId) {
    if (!sessionId) {
        console.error("BrowserCheckpointService: Session ID is required for checkpoint operations.");
        throw new Error("Session ID is required for checkpoint operations.");
    }
    // Use the instance-specific prefix combined with the sessionId
    return `${this.storageKeyPrefixWithInstanceId}${sessionId}`;
  }

  /**
   * Retrieves checkpoints for a session from localStorage.
   * @private
   * @param {string|number} sessionId - The session identifier
   * @returns {Array<import('@token-ring/history/CheckpointService').Checkpoint>} Array of checkpoints
   */
  _getCheckpoints(sessionId) {
    try {
      const storedCheckpoints = localStorage.getItem(this._getStorageKey(sessionId));
      return storedCheckpoints ? JSON.parse(storedCheckpoints) : [];
    } catch (error) {
      console.error(`Error reading checkpoints for session ${sessionId} from localStorage:`, error);
      return [];
    }
  }

  /**
   * Saves checkpoints for a session to localStorage.
   * @private
   * @param {string|number} sessionId - The session identifier
   * @param {Array<import('@token-ring/history/CheckpointService').Checkpoint>} checkpoints - Checkpoints to save
   * @returns {void}
   */
  _saveCheckpoints(sessionId, checkpoints) {
    try {
      localStorage.setItem(this._getStorageKey(sessionId), JSON.stringify(checkpoints));
    } catch (error) {
      console.error(`Error saving checkpoints for session ${sessionId} to localStorage:`, error);
    }
  }

  /**
   * Creates a new checkpoint for the current conversation state.
   * Note: Parameter order differs from base class to accommodate sessionId requirement.
   * 
   * @param {string} label - Human-readable label for the checkpoint
   * @param {import('@token-ring/ai-client/ChatMessageStorage').ChatMessage} currentMessage - The current message to checkpoint
   * @param {string|number} sessionId - The session identifier
   * @returns {Promise<import('@token-ring/history/CheckpointService').Checkpoint>} The created checkpoint
   * @throws {Error} When sessionId or currentMessage is missing
   */
  async createCheckpoint(label, currentMessage, sessionId) {
    if (!sessionId) return Promise.reject(new Error("Session ID is required."));
    if (!currentMessage) {
      return Promise.reject(new Error("No active chat (currentMessage) to checkpoint."));
    }
    const checkpoints = this._getCheckpoints(sessionId);
    const now = Date.now();
    const newCheckpoint = {
      id: now.toString(),
      label: label || `Checkpoint @ ${new Date(now).toISOString()}`,
      messageId: currentMessage.id,
      currentMessage: JSON.parse(JSON.stringify(currentMessage)), // Deep copy
      timestamp: now,
      createdAt: now
    };
    checkpoints.push(newCheckpoint);
    this._saveCheckpoints(sessionId, checkpoints);
    return Promise.resolve(newCheckpoint);
  }

  /**
   * Retrieves a checkpoint by its identifier.
   * 
   * @param {string|number} idOrIdx - The checkpoint identifier
   * @param {string|number} sessionId - The session identifier
   * @returns {Promise<import('@token-ring/history/CheckpointService').Checkpoint|null>} The retrieved checkpoint or null if not found
   * @throws {Error} When sessionId is missing
   */
  async retrieveCheckpoint(idOrIdx, sessionId) {
    if (!sessionId) return Promise.reject(new Error("Session ID is required."));
    const checkpoints = this._getCheckpoints(sessionId);
    
    // Support both ID lookup and index lookup
    let checkpoint;
    if (typeof idOrIdx === 'number') {
      // Treat as index (0-based, ordered by timestamp descending)
      const sortedCheckpoints = checkpoints.sort((a, b) => b.timestamp - a.timestamp);
      checkpoint = sortedCheckpoints[idOrIdx];
    } else {
      // Treat as ID
      checkpoint = checkpoints.find(cp => cp.id === idOrIdx);
    }
    
    return Promise.resolve(checkpoint || null);
  }

  /**
   * Lists all checkpoints for a session ordered by creation time (newest first).
   * 
   * @param {string|number} sessionId - The session identifier
   * @returns {Promise<Array<import('@token-ring/history/CheckpointService').Checkpoint>>} Array of checkpoints
   * @throws {Error} When sessionId is missing
   */
  async listCheckpoint(sessionId) {
    if (!sessionId) return Promise.reject(new Error("Session ID is required."));
    const checkpoints = this._getCheckpoints(sessionId);
    return Promise.resolve(checkpoints.sort((a, b) => b.timestamp - a.timestamp));
  }

  /**
   * Clears all checkpoints for a session.
   * This method is specific to the browser implementation.
   * 
   * @param {string|number} sessionId - The session identifier
   * @returns {Promise<void>}
   * @throws {Error} When sessionId is missing
   */
  async clearAllCheckpoints(sessionId) {
    if (!sessionId) return Promise.reject(new Error("Session ID is required."));
    this._saveCheckpoints(sessionId, []);
    return Promise.resolve();
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
