import Node from '../node/Node.js';

/**
 * Display container with child hierarchy and world-space position helpers.
 */
export class Container extends Node {
  constructor(options = {}) {
    super({
      ...options,
      name: options.name || 'container',
      type: options.type || 'container'
    });
  }
}

export default Container;
