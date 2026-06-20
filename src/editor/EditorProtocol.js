import { createOmniError } from '../core/OmniError.js';

export const EDITOR_PROTOCOL_VERSION = 'omnicore.editor-protocol.v1';

export class EditorProtocol {
  constructor({
    version = EDITOR_PROTOCOL_VERSION,
    supportedCommands = [
      'editor:update-entity',
      'editor:create-entity',
      'editor:update-database-record',
      'editor:update-tilemap',
      'editor:set-play-mode',
      'editor:request-scene',
      'editor:request-profiler'
    ]
  } = {}) {
    this.version = version;
    this.supportedCommands = new Set(supportedCommands);
    this.transactions = new Map();
  }

  negotiate(peer = {}) {
    const accepted = peer.version === this.version || (peer.supportedVersions || []).includes(this.version);
    return {
      ok: accepted,
      version: this.version,
      peerVersion: peer.version || null,
      capabilities: {
        transactions: true,
        rollback: true,
        pausedHotEdit: true,
        schemaValidation: true
      }
    };
  }

  validate(message = {}) {
    if (!message.type) throw createOmniError('EditorProtocol', 'Editor message missing type.', { code: 'OMNICORE_EDITOR_PROTOCOL_INVALID' });
    if (message.protocol && message.protocol !== this.version) {
      throw createOmniError('EditorProtocol', `Editor protocol mismatch: ${message.protocol}`, {
        code: 'OMNICORE_EDITOR_PROTOCOL_MISMATCH',
        category: 'editor',
        recoverable: true
      });
    }
    if (!this.supportedCommands.has(message.type) && !message.type.startsWith('runtime:')) {
      throw createOmniError('EditorProtocol', `Unsupported editor command: ${message.type}`, {
        code: 'OMNICORE_EDITOR_COMMAND_UNSUPPORTED',
        category: 'editor',
        recoverable: true
      });
    }
    return {
      protocol: this.version,
      type: message.type,
      payload: message.payload || {},
      transactionId: message.transactionId || message.payload?.transactionId || null
    };
  }

  beginTransaction(id = `tx-${this.transactions.size + 1}`, snapshot = null) {
    const record = {
      id,
      snapshot,
      commands: [],
      state: 'open',
      startedAt: Date.now()
    };
    this.transactions.set(id, record);
    return record;
  }

  recordCommand(transactionId, command) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction || transaction.state !== 'open') {
      throw createOmniError('EditorProtocol', `Transaction is not open: ${transactionId}`, {
        code: 'OMNICORE_EDITOR_TRANSACTION_CLOSED',
        category: 'editor',
        recoverable: true
      });
    }
    transaction.commands.push(this.validate(command));
    return transaction;
  }

  commit(transactionId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return null;
    transaction.state = 'committed';
    transaction.committedAt = Date.now();
    return transaction;
  }

  rollback(transactionId) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return null;
    transaction.state = 'rolled-back';
    transaction.rolledBackAt = Date.now();
    return transaction.snapshot;
  }
}

export default EditorProtocol;
