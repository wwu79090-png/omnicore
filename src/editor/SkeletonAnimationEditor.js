export class SkeletonAnimationEditor {
  constructor({ store = null } = {}) {
    this.store = store;
    this.bones = new Map();
    this.animations = new Map();
  }

  addBone(id, point = {}) {
    const bone = { id, x: point.x ?? 0, y: point.y ?? 0, parent: point.parent || null };
    this.bones.set(id, bone);
    return bone;
  }

  dragBone(id, point = {}) {
    const bone = this.bones.get(id) || this.addBone(id);
    bone.x = point.x ?? bone.x;
    bone.y = point.y ?? bone.y;
    this._sync();
    return bone;
  }

  addKeyframe(animation, frame, pose = {}) {
    if (!this.animations.has(animation)) this.animations.set(animation, []);
    const keyframe = { frame, pose: clone(pose) };
    this.animations.get(animation).push(keyframe);
    this.animations.get(animation).sort((a, b) => a.frame - b.frame);
    this._sync();
    return keyframe;
  }

  generateTweenFrames(animation, targetPose = {}, { frames = 4 } = {}) {
    const current = Object.fromEntries([...this.bones.entries()].map(([id, bone]) => [id, { x: bone.x, y: bone.y }]));
    for (let frame = 1; frame <= frames; frame += 1) {
      const t = frame / frames;
      const pose = {};
      for (const [id, target] of Object.entries(targetPose)) {
        const start = current[id] || { x: 0, y: 0 };
        pose[id] = {
          x: Math.round(start.x + ((target.x ?? start.x) - start.x) * t),
          y: Math.round(start.y + ((target.y ?? start.y) - start.y) * t)
        };
      }
      this.addKeyframe(animation, frame, pose);
    }
    for (const [id, point] of Object.entries(targetPose)) this.dragBone(id, point);
    return this.animations.get(animation) || [];
  }

  exportOmniAnim() {
    return {
      format: 'OmniCore.OmniAnim',
      extension: '.omni-anim',
      version: 1,
      bones: [...this.bones.values()].map((bone) => ({ ...bone })),
      animations: Object.fromEntries([...this.animations.entries()].map(([name, frames]) => [
        name,
        frames.map((frame) => clone(frame))
      ]))
    };
  }

  _sync() {
    this.store?.set?.('editor:omniAnim', this.exportOmniAnim());
  }
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export default SkeletonAnimationEditor;
