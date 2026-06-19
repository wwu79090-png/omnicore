export class ElectronNativeBridge {
  constructor({ processRef = globalThis.process } = {}) {
    this.processRef = processRef;
  }

  detect() {
    const electron = Boolean(this.processRef?.versions?.electron);
    const windows = this.processRef?.platform === 'win32';
    return {
      electron,
      preferredBackend: electron ? 'native' : 'webgl',
      drivers: windows ? ['direct3d', 'vulkan'] : ['vulkan', 'metal']
    };
  }
}

export default ElectronNativeBridge;
