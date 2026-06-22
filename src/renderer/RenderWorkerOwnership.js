export class RenderWorkerOwnership {
  constructor({ offscreenCanvas = false, transferableBuffers = false, backend = 'canvas' } = {}) {
    this.offscreenCanvas = Boolean(offscreenCanvas);
    this.transferableBuffers = Boolean(transferableBuffers);
    this.backend = String(backend || 'canvas');
  }

  plan({ commands = [] } = {}) {
    const normalized = commands.map((command) => ({
      type: String(command.type || 'draw'),
      touchesDom: Boolean(command.touchesDom),
      transferable: command.transferable === true || hasTransferablePayload(command.payload)
    }));
    const violations = normalized
      .filter((command) => command.touchesDom)
      .map((command) => ({ type: command.type, reason: 'dom-bound-command' }));
    const workerCapable = this.offscreenCanvas && this.transferableBuffers;
    const workerStages = workerCapable
      ? sortStages(unique(normalized.filter((command) => !command.touchesDom).map((command) => command.type)))
      : [];
    const mainStages = workerCapable
      ? unique(normalized.filter((command) => command.touchesDom).map((command) => command.type))
      : unique(normalized.map((command) => command.type));

    return {
      owner: resolveOwner({ workerCapable, workerStages, mainStages }),
      workerStages,
      mainStages,
      transferable: workerCapable && normalized.every((command) => command.touchesDom || command.transferable),
      violations,
      recommendation: recommendationFor({ workerCapable, violations })
    };
  }
}

function hasTransferablePayload(payload) {
  if (!payload || typeof payload !== 'object') return false;
  return payload.buffer instanceof ArrayBuffer || payload instanceof ArrayBuffer;
}

function resolveOwner({ workerCapable, workerStages, mainStages }) {
  if (!workerCapable || workerStages.length === 0) return 'main';
  if (mainStages.length === 0) return 'worker';
  return 'hybrid';
}

function recommendationFor({ workerCapable, violations }) {
  if (!workerCapable) return 'keep-rendering-on-main';
  if (violations.length) return 'split-dom-bound-commands';
  return 'move-render-pipeline-to-worker';
}

function unique(values) {
  return [...new Set(values)];
}

function sortStages(values) {
  const order = ['uploadTexture', 'draw', 'present'];
  return values.slice().sort((left, right) => {
    const leftIndex = order.indexOf(left);
    const rightIndex = order.indexOf(right);
    const leftWeight = leftIndex >= 0 ? leftIndex : order.length;
    const rightWeight = rightIndex >= 0 ? rightIndex : order.length;
    return leftWeight - rightWeight || left.localeCompare(right);
  });
}

export default RenderWorkerOwnership;
