import { createOmniError } from '../core/OmniError.js';

function normalizeTextureKey(texture) {
  if (texture == null) return '';
  if (typeof texture === 'string') return texture;
  if (texture.atlasKey) return `atlas:${texture.atlasKey}`;
  if (texture.uid != null) return `texture:${texture.uid}`;
  if (texture.label) return `texture:${texture.label}`;
  return String(texture);
}

function createCommand() {
  return {
    texture: null,
    textureKey: '',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    alpha: 1,
    zIndex: 0,
    color: 0xffffff,
    blendMode: 'normal',
    child: null,
    entityId: 0,
    sequence: 0
  };
}

function copyCommand(target, source) {
  target.texture = source.texture;
  target.textureKey = source.textureKey;
  target.x = source.x;
  target.y = source.y;
  target.width = source.width;
  target.height = source.height;
  target.scaleX = source.scaleX;
  target.scaleY = source.scaleY;
  target.rotation = source.rotation;
  target.alpha = source.alpha;
  target.zIndex = source.zIndex;
  target.color = source.color;
  target.blendMode = source.blendMode;
  target.child = source.child;
  target.entityId = source.entityId;
  target.sequence = source.sequence;
  return target;
}

function compareCommand(left, right) {
  if (left.textureKey < right.textureKey) return -1;
  if (left.textureKey > right.textureKey) return 1;
  if (left.zIndex !== right.zIndex) return left.zIndex - right.zIndex;
  return left.sequence - right.sequence;
}

class CommandView {
  constructor(buffer) {
    this.buffer = buffer;
    this.snapshotLength = 0;
  }

  get length() {
    return this.snapshotLength;
  }

  capture(length) {
    this.snapshotLength = length;
    return this;
  }

  map(callback) {
    const result = [];
    for (let index = 0; index < this.snapshotLength; index += 1) {
      result.push(callback(this.buffer.commands[index], index, this));
    }
    return result;
  }

  forEach(callback) {
    for (let index = 0; index < this.snapshotLength; index += 1) {
      callback(this.buffer.commands[index], index, this);
    }
  }

  [Symbol.iterator]() {
    let index = 0;
    const { buffer } = this;
    const length = this.snapshotLength;
    return {
      next() {
        if (index >= length) return { done: true, value: undefined };
        const value = buffer.commands[index];
        index += 1;
        return { done: false, value };
      }
    };
  }
}

export class CommandBuffer {
  constructor({ capacity = 4096 } = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw createOmniError('Renderer', 'CommandBuffer capacity must be positive.');
    }
    this.capacity = capacity;
    this.commands = Array.from({ length: capacity }, () => createCommand());
    this.length = 0;
    this.sequence = 0;
    this.sorted = true;
    this.view = new CommandView(this);
    this.scratch = createCommand();
  }

  push(command = {}) {
    if (this.length >= this.capacity) {
      throw createOmniError('Renderer', `CommandBuffer exhausted fixed capacity ${this.capacity}.`);
    }
    const target = this.commands[this.length];
    target.texture = command.texture ?? null;
    target.textureKey = command.textureKey || normalizeTextureKey(command.texture);
    target.x = command.x ?? 0;
    target.y = command.y ?? 0;
    target.width = command.width ?? 0;
    target.height = command.height ?? 0;
    target.scaleX = command.scaleX ?? command.scale ?? 1;
    target.scaleY = command.scaleY ?? command.scale ?? 1;
    target.rotation = command.rotation ?? 0;
    target.alpha = command.alpha ?? 1;
    target.zIndex = command.zIndex ?? 0;
    target.color = command.color ?? command.tint ?? 0xffffff;
    target.blendMode = command.blendMode ?? 'normal';
    target.child = command.child ?? null;
    target.entityId = command.entityId ?? 0;
    target.sequence = this.sequence;
    if (this.sorted && this.length > 0 && compareCommand(this.commands[this.length - 1], target) > 0) {
      this.sorted = false;
    }
    this.sequence += 1;
    this.length += 1;
    return target;
  }

  sort() {
    if (this.sorted) return this.view.capture(this.length);
    for (let index = 1; index < this.length; index += 1) {
      copyCommand(this.scratch, this.commands[index]);
      let cursor = index - 1;
      while (cursor >= 0 && compareCommand(this.commands[cursor], this.scratch) > 0) {
        copyCommand(this.commands[cursor + 1], this.commands[cursor]);
        cursor -= 1;
      }
      copyCommand(this.commands[cursor + 1], this.scratch);
    }
    return this.view.capture(this.length);
  }

  reset() {
    this.length = 0;
    this.sorted = true;
  }

  clear() {
    this.reset();
  }

  flush(submit) {
    const count = this.length;
    if (count <= 0) return 0;
    const sorted = this.sort();
    submit?.(sorted);
    this.reset();
    return count;
  }
}

export class PixiBatchAdapter {
  constructor({ capacity = 4096, forceBatchThreshold = null } = {}) {
    this.buffer = new CommandBuffer({ capacity });
    const defaultThreshold = Math.min(200, Math.max(1, capacity));
    const thresholdCandidate = forceBatchThreshold == null ? defaultThreshold : forceBatchThreshold;
    this.forceBatchThreshold = Number.isFinite(thresholdCandidate) && thresholdCandidate > 0
      ? Math.min(capacity, Math.max(1, Math.floor(thresholdCandidate)))
      : defaultThreshold;
    this.resetMetrics();
    this.lastFlushStats = {
      commands: 0,
      textureBatches: 0,
      forced: false
    };
  }

  drawSprite(command = {}) {
    const result = this.buffer.push(command);
    this._recordCommand(result, 'sprite');
    return result;
  }

  forceBatchFlush(submit) {
    const count = this.buffer.length;
    if (count <= 0) {
      this.lastFlushStats = { commands: 0, textureBatches: 0, forced: false };
      return 0;
    }
    let textureBatches = 0;
    let previousTexture = null;
    const sorted = this.buffer.sort();
    sorted.forEach((command) => {
      if (command.textureKey !== previousTexture) {
        textureBatches += 1;
        previousTexture = command.textureKey;
      }
    });
    this.lastFlushStats = { commands: count, textureBatches, forced: true };
    submit?.(sorted);
    this.buffer.reset();
    this.resetMetrics();
    return count;
  }

  flush(submit) {
    if (this.forceBatchFlushNeeded()) {
      return this.forceBatchFlush(submit);
    }

    const count = this.buffer.length;
    if (count <= 0) {
      this.lastFlushStats = { commands: 0, textureBatches: 0, forced: false };
      return 0;
    }
    let textureBatches = 0;
    let previousTexture = null;
    const flushed = this.buffer.flush((commands) => {
      commands.forEach((command) => {
        if (command.textureKey !== previousTexture) {
          textureBatches += 1;
          previousTexture = command.textureKey;
        }
      });
      submit?.(commands);
    });
    this.lastFlushStats = { commands: flushed, textureBatches };
    this.lastFlushStats.forced = false;
    return flushed;
  }

  reset() {
    this.resetMetrics();
    this.buffer.reset();
  }

  forceBatchFlushNeeded() {
    return this.forceBatch === true;
  }

  resetMetrics() {
    this.forceBatch = false;
    this.typeMutationMap = Object.create(null);
  }

  _recordCommand(command, type = 'default') {
    const commandType = String(type);
    this.typeMutationMap[commandType] = (this.typeMutationMap[commandType] || 0) + 1;
    if (this.typeMutationMap[commandType] > this.forceBatchThreshold) {
      this.forceBatch = true;
    }
    return command;
  }
}

export default PixiBatchAdapter;
