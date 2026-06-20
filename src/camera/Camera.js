/**
 * 2D camera utility with follow, zoom, and shake.
 *
 * The camera is available as `game.camera` and injected into scenes as
 * `scene.camera`.
 *
 * @example
 * scene.camera.follow(player, { lerp: 0.2 });
 * scene.camera.zoom(1.5);
 * scene.camera.shake(180, 8);
 */
export class Camera {
  constructor({ x = 0, y = 0, zoom = 1 } = {}) {
    this.x = x;
    this.y = y;
    this.zoomLevel = zoom;
    this.target = null;
    this.followLerp = 1;
    this.offsetX = 0;
    this.offsetY = 0;
    this.rotation = 0;
    this.rotationTarget = null;
    this.rotationLerp = 1;
    this.shakeRemaining = 0;
    this.shakeIntensity = 0;
    this.bounds = null;
    this.viewport = { width: 0, height: 0 };
    this.parallaxLayers = [];
  }

  follow(target, { lerp = 1 } = {}) {
    this.target = target;
    this.followLerp = Math.max(0, Math.min(1, lerp));
    return this;
  }

  zoom(value) {
    this.zoomLevel = Math.max(0.01, Number(value));
    return this;
  }

  followRotation(target, { lerp = 1 } = {}) {
    this.rotationTarget = target;
    this.rotationLerp = Math.max(0, Math.min(1, lerp));
    return this;
  }

  setViewport({ width = 0, height = 0 } = {}) {
    this.viewport = {
      width: Math.max(0, Number(width || 0)),
      height: Math.max(0, Number(height || 0))
    };
    this._clampToBounds();
    return this;
  }

  setBounds(bounds = null) {
    this.bounds = bounds ? {
      x: Number(bounds.x || 0),
      y: Number(bounds.y || 0),
      width: Math.max(0, Number(bounds.width || 0)),
      height: Math.max(0, Number(bounds.height || 0))
    } : null;
    this._clampToBounds();
    return this;
  }

  addParallaxLayer(layer, { factorX = 1, factorY = factorX, offsetX = 0, offsetY = 0 } = {}) {
    const entry = {
      id: layer?.id || layer?.name || `layer-${this.parallaxLayers.length}`,
      layer,
      factorX: Number(factorX),
      factorY: Number(factorY),
      offsetX: Number(offsetX || 0),
      offsetY: Number(offsetY || 0)
    };
    this.parallaxLayers.push(entry);
    return this;
  }

  configureParallax25D(layers = {}) {
    this.parallaxLayers = [];
    for (const [id, config] of Object.entries(layers || {})) {
      const options = typeof config === 'number'
        ? { factorX: config, factorY: config }
        : {
          factorX: config.factorX ?? config.factor ?? 1,
          factorY: config.factorY ?? config.factor ?? config.factorX ?? 1,
          offsetX: config.offsetX || 0,
          offsetY: config.offsetY || 0
        };
      this.addParallaxLayer({ id }, options);
    }
    return this;
  }

  shake(duration = 120, intensity = 4) {
    const options = typeof duration === 'object'
      ? duration
      : { duration, intensity };
    this.shakeRemaining = Math.max(0, Number(options.duration ?? 120));
    this.shakeIntensity = Math.max(0, Number(options.intensity ?? 4));
    return this;
  }

  update(delta) {
    const deltaMs = delta <= 10 ? delta * 1000 : delta;
    if (this.target) {
      this.x += (this.target.x - this.x) * this.followLerp;
      this.y += (this.target.y - this.y) * this.followLerp;
    }

    if (this.rotationTarget && Number.isFinite(Number(this.rotationTarget.rotation))) {
      this.rotation += (Number(this.rotationTarget.rotation) - this.rotation) * this.rotationLerp;
    }

    this._clampToBounds();

    if (this.shakeRemaining > 0) {
      this.shakeRemaining = Math.max(0, this.shakeRemaining - deltaMs);
      this.offsetX = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.offsetY = (Math.random() * 2 - 1) * this.shakeIntensity;
    } else {
      this.offsetX = 0;
      this.offsetY = 0;
    }

    return this;
  }

  getParallaxTransforms() {
    return this.parallaxLayers.map((entry) => ({
      id: entry.id,
      layer: entry.layer,
      x: entry.offsetX - this.x * entry.factorX,
      y: entry.offsetY - this.y * entry.factorY,
      factorX: entry.factorX,
      factorY: entry.factorY
    }));
  }

  getLayerTransform(id) {
    return this.getParallaxTransforms().find((entry) => entry.id === id) || null;
  }

  getViewTransform() {
    return {
      x: this.x,
      y: this.y,
      offsetX: this.offsetX,
      offsetY: this.offsetY,
      zoom: this.zoomLevel,
      rotation: this.rotation
    };
  }

  reset() {
    this.x = 0;
    this.y = 0;
    this.zoomLevel = 1;
    this.target = null;
    this.rotation = 0;
    this.rotationTarget = null;
    this.offsetX = 0;
    this.offsetY = 0;
    this.shakeRemaining = 0;
    this.shakeIntensity = 0;
    this.bounds = null;
    this.viewport = { width: 0, height: 0 };
    this.parallaxLayers = [];
  }

  _clampToBounds() {
    if (!this.bounds) return;
    const viewWidth = this.viewport.width ? this.viewport.width / this.zoomLevel : 0;
    const viewHeight = this.viewport.height ? this.viewport.height / this.zoomLevel : 0;
    const minX = this.bounds.x;
    const minY = this.bounds.y;
    const maxX = viewWidth ? this.bounds.x + Math.max(0, this.bounds.width - viewWidth) : this.bounds.x + this.bounds.width;
    const maxY = viewHeight ? this.bounds.y + Math.max(0, this.bounds.height - viewHeight) : this.bounds.y + this.bounds.height;
    this.x = Math.min(maxX, Math.max(minX, this.x));
    this.y = Math.min(maxY, Math.max(minY, this.y));
  }
}

export default Camera;
