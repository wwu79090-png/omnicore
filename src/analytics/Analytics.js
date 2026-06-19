export class Analytics {
  /**
   * @param {string} name Event name.
   * @param {object} payload Event payload.
   * @param {object} options Output options.
   * @returns {string} JSON line payload.
   */
  static track(name, payload = {}, {
    output = null,
    clock = () => new Date().toISOString(),
    context = {}
  } = {}) {
    const line = JSON.stringify({
      name,
      payload,
      timestamp: clock(),
      context
    });
    output?.(line);
    return line;
  }

  constructor({
    transport = null,
    device = detectDevice(),
    fpsProvider = () => null,
    sceneProvider = () => null,
    clock = () => new Date().toISOString(),
    logger = null
  } = {}) {
    this.transport = transport;
    this.device = device;
    this.fpsProvider = fpsProvider;
    this.sceneProvider = sceneProvider;
    this.clock = clock;
    this.logger = logger;
    this.queue = [];
  }

  track(name, payload = {}) {
    const event = {
      name,
      payload,
      timestamp: this.clock(),
      context: {
        device: this.device,
        fps: this.fpsProvider(),
        scene: this.sceneProvider()
      }
    };
    this.queue.push(event);
    return event;
  }

  async flush() {
    if (!this.queue.length) return [];
    const batch = this.queue.splice(0);
    const body = JSON.stringify(batch);
    if (this.transport) await this.transport(body);
    else this.logger?.info?.(body);
    return batch;
  }
}

function detectDevice() {
  const navigatorRef = typeof navigator !== 'undefined' ? navigator : {};
  return {
    userAgent: navigatorRef.userAgent || '',
    language: navigatorRef.language || '',
    platform: navigatorRef.platform || 'unknown'
  };
}

export default Analytics;
