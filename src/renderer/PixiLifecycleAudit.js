export class PixiLifecycleAudit {
  inspect(events = []) {
    let initialized = false;
    let destroyed = false;
    const textureRefs = new Map();
    const orderViolations = [];

    for (const event of events) {
      const type = String(event.type || '');
      if (type !== 'app:init' && !initialized) {
        orderViolations.push({ type, reason: 'before-app-init' });
      }
      if (type === 'app:init') initialized = true;
      if (type === 'renderer:destroy' || type === 'app:destroy') destroyed = true;
      if (type === 'texture:retain') {
        const id = String(event.id);
        textureRefs.set(id, (textureRefs.get(id) || 0) + 1);
      }
      if (type === 'texture:release') {
        const id = String(event.id);
        textureRefs.set(id, Math.max(0, (textureRefs.get(id) || 0) - 1));
      }
    }

    const leakedTextures = [...textureRefs.entries()]
      .filter(([, count]) => count > 0)
      .map(([id]) => id)
      .sort();
    return {
      status: leakedTextures.length || orderViolations.length ? 'leak-risk' : 'ok',
      initialized,
      destroyed,
      leakedTextures,
      orderViolations,
      recommendations: leakedTextures.map((id) => `releaseTexture:${id}`)
    };
  }
}

export default PixiLifecycleAudit;
