/**
 * Remote debug snapshot broadcaster.
 *
 * The class is intentionally transport-light: production tools may pass a real
 * WebSocket server, while tests can pass any object with `clients[].send()`.
 *
 * @example
 * const tools = new RemoteDevTools(game, { debug: true, server });
 * tools.attach();
 */
export class RemoteDevTools {
  constructor(game, {
    debug = false,
    server = null,
    interval = 1000,
    maxDevices = 8,
    maxTouches = 12
  } = {}) {
    this.game = game;
    this.debug = debug;
    this.server = server;
    this.interval = interval;
    this.maxDevices = maxDevices;
    this.maxTouches = maxTouches;
    this.timer = null;
    this.deviceReports = new Map();
  }

  /**
   * @returns {RemoteDevTools} This instance.
   */
  attach() {
    if (!this.debug || this.timer) return this;
    this.broadcast();
    if (this.interval > 0) {
      this.timer = setInterval(() => this.broadcast(), this.interval);
      this.timer.unref?.();
    }
    return this;
  }

  /**
   * @returns {void}
   */
  detach() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * @returns {object} Debug snapshot.
   */
  snapshot() {
    const current = this.game?.scene?.current || null;
    return {
      store: this.game?.store?.snapshot?.() || {},
      scene: {
        name: current?.name || null,
        entityCount: current?.children?.length || 0
      },
      renderer: {
        backend: this.game?.renderer?.backend || null,
        width: this.game?.renderer?.width || this.game?.config?.width || 0,
        height: this.game?.renderer?.height || this.game?.config?.height || 0
      },
      metrics: this.game?.metrics?.export?.() || {},
      remoteDevices: this.remoteDevices()
    };
  }

  /**
   * Records telemetry sent by a phone or remote preview client.
   *
   * @param {object} report Client telemetry report.
   * @returns {object} Normalized report stored in the snapshot.
   */
  ingestDeviceReport(report = {}) {
    const normalized = normalizeDeviceReport(report, {
      maxTouches: this.maxTouches,
      now: Date.now()
    });
    if (!normalized.deviceId) return null;
    this.deviceReports.set(normalized.deviceId, normalized);
    this._trimDevices();
    this.server?.emit?.('omnicore:remote-device', normalized);
    return normalized;
  }

  ingestClientEvent(report = {}) {
    return this.ingestDeviceReport(report);
  }

  remoteDevices() {
    return [...this.deviceReports.values()]
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }

  /**
   * @returns {object} Message sent to connected clients.
   */
  broadcast() {
    const message = {
      type: 'omnicore:state',
      at: Date.now(),
      payload: this.snapshot()
    };
    const payload = JSON.stringify(message);
    for (const client of this._clients()) {
      if (client.readyState !== undefined && client.readyState !== 1) continue;
      client.send?.(payload);
    }
    this.server?.emit?.('omnicore:state', message);
    return message;
  }

  _clients() {
    if (!this.server?.clients) return [];
    if (Array.isArray(this.server.clients)) return this.server.clients;
    return [...this.server.clients];
  }

  _trimDevices() {
    const devices = this.remoteDevices();
    for (const stale of devices.slice(this.maxDevices)) this.deviceReports.delete(stale.deviceId);
  }
}

function normalizeDeviceReport(report = {}, { maxTouches = 12, now = Date.now() } = {}) {
  const deviceId = String(report.deviceId || report.id || report.userAgent || '').trim();
  if (!deviceId) return { deviceId: null };
  return {
    deviceId,
    updatedAt: Number(report.updatedAt || report.at || now),
    viewport: normalizeViewport(report.viewport || report.screen || {}),
    fps: numberOrNull(report.fps),
    memory: numberOrNull(report.memory ?? report.usedJSHeapSize),
    touches: normalizeTouches(report.touches || report.pointerTrail || [], maxTouches),
    userAgent: report.userAgent || null,
    url: report.url || null
  };
}

function normalizeViewport(viewport = {}) {
  return {
    width: numberOrZero(viewport.width),
    height: numberOrZero(viewport.height),
    dpr: numberOrZero(viewport.dpr ?? viewport.devicePixelRatio ?? 1)
  };
}

function normalizeTouches(touches, limit) {
  const list = Array.isArray(touches) ? touches : [touches];
  return list
    .filter(Boolean)
    .slice(-limit)
    .map((touch) => {
      const normalized = {
        type: touch.type || touch.event || 'touch',
        x: numberOrZero(touch.x ?? touch.clientX),
        y: numberOrZero(touch.y ?? touch.clientY)
      };
      if (touch.at || touch.timeStamp) normalized.at = touch.at || touch.timeStamp;
      return normalized;
    });
}

function numberOrZero(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export default RemoteDevTools;
