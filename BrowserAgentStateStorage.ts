import type {
	AgentCheckpointListItem,
	AgentCheckpointProvider,
	NamedAgentCheckpoint,
	StoredAgentCheckpoint,
} from "@tokenring-ai/agent/AgentCheckpointProvider";

const DEFAULT_AGENT_STATE_PREFIX = "tokenRingAgentState_v1_";

/**
 * Browser-based implementation of AgentCheckpointProvider that uses localStorage
 * for persistent storage of agent state checkpoints.
 *
 * This implementation:
 * - Stores agent checkpoints in the browser's localStorage
 * - Supports checkpoint creation, retrieval, and listing
 * - Maintains checkpoint metadata including agent ID and timestamps
 * - Provides agent-specific checkpoint management
 *
 * Storage Structure:
 * - Checkpoints stored under AGENT_STATE_STORAGE_KEY_PREFIX + agentId
 *
 * Limitations:
 * - Limited by browser localStorage size constraints
 * - Data is tied to specific browser/domain
 * - No server-side persistence or cross-device synchronization
 *
 * @implements AgentCheckpointProvider
 */
export default class BrowserAgentStateStorage
	implements AgentCheckpointProvider
{
	name: string = "BrowserAgentStateStorage";
	storageKeyPrefix: string;

	/**
	 * Creates a new BrowserAgentStateStorage instance.
	 * @param storageKeyPrefix - Optional prefix for localStorage keys to achieve isolation.
	 */
	constructor(storageKeyPrefix?: string) {
		this.storageKeyPrefix = storageKeyPrefix || DEFAULT_AGENT_STATE_PREFIX;
		console.log(
			`BrowserAgentStateStorage initialized with prefix: '${this.storageKeyPrefix}'`,
		);
	}

	/**
	 * Gets the localStorage key for storing all checkpoints.
	 * @private
	 * @returns The localStorage key
	 */
	_getStorageKey(): string {
		return `${this.storageKeyPrefix}checkpoints`;
	}

	/**
	 * Retrieves all checkpoints from localStorage.
	 * @private
	 * @returns Array of stored checkpoints
	 */
	_getAllCheckpoints(): StoredAgentCheckpoint[] {
		try {
			const stored = localStorage.getItem(this._getStorageKey());
			return stored ? JSON.parse(stored) : [];
		} catch (error) {
			console.error(
				`Error reading agent checkpoints from localStorage:`,
				error,
			);
			return [];
		}
	}

	/**
	 * Saves all checkpoints to localStorage.
	 * @private
	 * @param checkpoints - Checkpoints to save
	 * @returns void
	 */
	_saveAllCheckpoints(checkpoints: StoredAgentCheckpoint[]): void {
		try {
			localStorage.setItem(this._getStorageKey(), JSON.stringify(checkpoints));
		} catch (error) {
			console.error(`Error saving agent checkpoints to localStorage:`, error);
		}
	}

	/**
	 * Stores a new checkpoint for an agent.
	 *
	 * @param checkpoint - The checkpoint to store
	 * @returns The ID of the stored checkpoint
	 */
	async storeCheckpoint(checkpoint: NamedAgentCheckpoint): Promise<string> {
		const checkpoints = this._getAllCheckpoints();
		const now = Date.now();
		const id = `${checkpoint.agentId}_${now}`;

		const storedCheckpoint: StoredAgentCheckpoint = {
			id,
			agentId: checkpoint.agentId,
			name: checkpoint.name,
			state: checkpoint.state,
			createdAt: checkpoint.createdAt || now,
		};

		checkpoints.push(storedCheckpoint);
		this._saveAllCheckpoints(checkpoints);

		return Promise.resolve(id);
	}

	/**
	 * Retrieves a checkpoint by its ID.
	 *
	 * @param checkpointId - The checkpoint identifier
	 * @returns The retrieved checkpoint or null if not found
	 */
	async retrieveCheckpoint(
		checkpointId: string,
	): Promise<StoredAgentCheckpoint | null> {
		const checkpoints = this._getAllCheckpoints();
		const checkpoint = checkpoints.find((cp) => cp.id === checkpointId);
		return Promise.resolve(checkpoint || null);
	}

	/**
	 * Lists all checkpoints ordered by creation time (newest first).
	 *
	 * @returns Array of checkpoint list items
	 */
	async listCheckpoints(): Promise<AgentCheckpointListItem[]> {
		const checkpoints = this._getAllCheckpoints();
		const listItems: AgentCheckpointListItem[] = checkpoints.map((cp) => ({
			id: cp.id,
			name: cp.name,
			agentId: cp.agentId,
			createdAt: cp.createdAt,
		}));

		return Promise.resolve(listItems.sort((a, b) => b.createdAt - a.createdAt));
	}

	/**
	 * Clears all checkpoints from storage.
	 * This method is specific to the browser implementation.
	 *
	 * @returns void
	 */
	async clearAllCheckpoints(): Promise<void> {
		this._saveAllCheckpoints([]);
		return Promise.resolve();
	}

	/**
	 * Deletes a specific checkpoint by ID.
	 * This method is specific to the browser implementation.
	 *
	 * @param checkpointId - The checkpoint identifier to delete
	 * @returns True if checkpoint was deleted, false if not found
	 */
	async deleteCheckpoint(checkpointId: string): Promise<boolean> {
		const checkpoints = this._getAllCheckpoints();
		const initialLength = checkpoints.length;
		const filtered = checkpoints.filter((cp) => cp.id !== checkpointId);

		if (filtered.length < initialLength) {
			this._saveAllCheckpoints(filtered);
			return Promise.resolve(true);
		}

		return Promise.resolve(false);
	}

	/**
	 * Closes any resources used by the service.
	 * No-op for browser implementation as localStorage doesn't require explicit closing.
	 *
	 * @returns void
	 */
	close(): void {
		// No resources to close for localStorage implementation
	}
}
