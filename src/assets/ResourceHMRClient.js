/**
 * WebSocket-style resource hot-module replacement receiver.
 *
 * @example
 * const hmr = new ResourceHMRClient({ patchManager });
 * hmr.connect(new WebSocket('/assets-hmr'));
 */
export class ResourceHMRClient {
  constructor({ patchManager = null, changeCoordinator = null } = {}) {
    this.patchManager = patchManager;
    this.changeCoordinator = changeCoordinator;
    this.socket = null;
  }

  connect(socket) {
    this.socket = socket;
    socket.addEventListener?.('message', (event) => this.accept(event.data));
    socket.onmessage = (event) => this.accept(event.data);
    return this;
  }

  async accept(message) {
    const payload = typeof message === 'string' ? JSON.parse(message) : message;
    if (payload?.type !== 'assets:hot-update') return null;
    const files = Object.fromEntries((payload.files || []).map((file) => [
      file,
      {
        content: JSON.stringify({
          file,
          conversions: (payload.conversions || []).filter((item) => item.file === file)
        }),
        encoding: 'utf8'
      }
    ]));
    const patch = {
      format: 'OmniCore.OTAPatch',
      version: 1,
      files
    };
    await this.patchManager?.apply?.(patch);
    if (payload.changePlan && this.changeCoordinator?.apply) {
      patch.refreshReport = await this.changeCoordinator.apply(payload.changePlan, { sendHmr: false });
    }
    return patch;
  }
}

export default ResourceHMRClient;
