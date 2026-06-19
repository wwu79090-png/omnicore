export class SkeletonAnimationEditor {
  constructor() {
    this.bones = new Map();
    this.animations = {};
  }

  addBone(id, position = {}) {
    this.bones.set(id, { id, ...position });
    return this;
  }

  dragBone(id, position = {}) {
    this.bones.set(id, { ...(this.bones.get(id) || { id }), ...position });
    return this;
  }

  addKeyframe(name, frame, pose = {}) {
    this.animations[name] ||= [];
    this.animations[name].push({ frame, pose });
    return this;
  }

  generateTweenFrames(name, pose = {}, { frames = 1 } = {}) {
    this.addKeyframe(name, frames, pose);
    for (const [id, value] of Object.entries(pose)) this.dragBone(id, value);
    return this;
  }

  exportOmniAnim() {
    return {
      format: 'OmniCore.OmniAnim',
      extension: '.omni-anim',
      bones: [...this.bones.values()],
      animations: this.animations
    };
  }
}

export class DataTableEditor {
  constructor() {
    this.rows = [];
    this.versions = [];
  }

  importCSV(text) {
    const [headerLine, ...lines] = String(text).trim().split(/\r?\n/u);
    const headers = headerLine.split(',');
    this.rows = lines.filter(Boolean).map((line) => Object.fromEntries(
      line.split(',').map((value, index) => [headers[index], value])
    ));
    return this;
  }

  commitVersion(label) {
    const version = {
      id: `${this.versions.length + 1}`,
      label,
      rows: this.exportJSON()
    };
    this.versions.push(version);
    return version;
  }

  rollback(id) {
    const version = this.versions.find((item) => item.id === id);
    if (version) this.rows = version.rows.map((row) => ({ ...row }));
    return this;
  }

  exportJSON() {
    return this.rows.map((row) => ({ ...row }));
  }
}

export class AudioEditor {
  constructor() {
    this.sounds = {};
  }

  setSound(name, config) {
    this.sounds[name] = { ...config };
    return this;
  }

  exportConfig() {
    return {
      format: 'OmniCore.AudioConfig',
      version: 1,
      sounds: this.sounds
    };
  }
}
