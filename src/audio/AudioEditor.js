export class AudioEditor {
  constructor({ store = null } = {}) {
    this.store = store;
    this.sounds = {};
  }

  setSound(key, config = {}) {
    this.sounds[key] = {
      volume: config.volume ?? this.sounds[key]?.volume ?? 1,
      pitch: config.pitch ?? this.sounds[key]?.pitch ?? 1,
      reverb: config.reverb ?? this.sounds[key]?.reverb ?? 0,
      loop: config.loop ?? this.sounds[key]?.loop ?? false
    };
    this._sync();
    return this.sounds[key];
  }

  exportConfig() {
    return {
      format: 'OmniCore.AudioConfig',
      version: 1,
      sounds: JSON.parse(JSON.stringify(this.sounds))
    };
  }

  _sync() {
    this.store?.set?.('editor:audioConfig', this.exportConfig());
  }
}

export default AudioEditor;
