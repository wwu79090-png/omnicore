export class AnimationEditor {
  constructor({
    documentRef = globalThis.document,
    store = null,
    frames = [],
    atlas = null,
    animation = 'walk',
    frameRate = 12,
    targetSprite = null
  } = {}) {
    this.document = documentRef;
    this.store = store;
    this.animation = animation;
    this.frameRate = frameRate;
    this.frames = normalizeFrames(frames, atlas);
    this.tracks = ['Sprite', 'Transform', 'Color'];
    this.keyframes = [];
    this.curves = createStandardCurves();
    this.states = {};
    this.transitions = [];
    this.parameters = {};
    this.initialState = null;
    this.selectedFrame = this.frames[0] || null;
    this.targetSprite = targetSprite;
    this.panel = null;
    this.timeline = null;
    this.curveEditor = null;
    this.stateMachinePanel = null;
    this.preview = null;
    this.output = null;
  }

  attach(container = this.document?.body) {
    if (!this.document || this.panel || !container) return this;
    this.panel = this.document.createElement('section');
    this.panel.className = 'omnicore-animation-editor';
    this.panel.innerHTML = `
      <header>
        <strong>Animation Timeline</strong>
        <button type="button" data-export>Export animation.json</button>
      </header>
      <label>Clip <input data-name value="${escapeAttr(this.animation)}" /></label>
      <label>FPS <input data-fps type="number" min="1" max="60" value="${this.frameRate}" /></label>
      <div class="omni-frame-list" data-frames></div>
      <div class="omni-transform-grid">
        <label>Rotation <input data-rotation type="number" step="0.01" value="0" /></label>
        <label>Scale X <input data-scale-x type="number" step="0.01" value="1" /></label>
        <label>Scale Y <input data-scale-y type="number" step="0.01" value="1" /></label>
        <label>Alpha <input data-alpha type="number" step="0.05" min="0" max="1" value="1" /></label>
        <label>Easing <select data-easing>
          <option value="linear">linear</option>
          <option value="easeInQuad">easeInQuad</option>
          <option value="easeOutQuad">easeOutQuad</option>
          <option value="easeInOutQuad">easeInOutQuad</option>
        </select></label>
      </div>
      <section class="omni-curve-editor" data-curve-editor>
        <header>
          <strong>Easing Curves</strong>
          <button type="button" data-add-curve>Add curve</button>
        </header>
        <label>Name <input data-curve-name-input value="easeCustom" /></label>
        <label>Points <input data-curve-points value="0,0,0.25,0.1,0.75,0.9,1,1" /></label>
        <div data-curve-list></div>
      </section>
      <section class="omni-state-machine-panel" data-state-machine-panel>
        <header>
          <strong>Animation State Machine</strong>
          <button type="button" data-add-state>Add state</button>
          <button type="button" data-add-transition>Add transition</button>
        </header>
        <div class="omni-state-machine-fields">
          <label>State <input data-state-name value="idle" /></label>
          <label>Animation <input data-state-animation value="${escapeAttr(this.animation)}" /></label>
          <label>From <input data-transition-from value="idle" /></label>
          <label>To <input data-transition-to value="run" /></label>
          <label>When <input data-transition-when value="moving:true" /></label>
        </div>
        <div data-state-list></div>
        <div data-transition-list></div>
      </section>
      <div class="omni-animation-preview" data-preview data-omnicore-animation-preview>Sprite Preview</div>
      <div class="omni-timeline" data-timeline aria-label="Animation timeline"></div>
      <textarea data-output readonly spellcheck="false"></textarea>
    `;
    container.appendChild(this.panel);
    this.timeline = this.panel.querySelector('[data-timeline]');
    this.curveEditor = this.panel.querySelector('[data-curve-editor]');
    this.stateMachinePanel = this.panel.querySelector('[data-state-machine-panel]');
    this.preview = this.panel.querySelector('[data-preview]');
    this.output = this.panel.querySelector('[data-output]');
    Object.assign(this.preview.style, {
      width: '88px',
      height: '48px',
      display: 'grid',
      placeItems: 'center',
      margin: '8px 0',
      color: '#0f172a',
      background: 'rgba(56,189,248,0.86)',
      transformOrigin: 'center',
      border: '1px solid rgba(14,165,233,0.65)'
    });
    this._bind();
    this._renderFrames();
    this._renderCurveEditor();
    this._renderStateMachine();
    this._renderTimeline();
    this._sync();
    return this;
  }

  detach() {
    this.panel?.remove?.();
    this.panel = null;
    this.timeline = null;
    this.curveEditor = null;
    this.stateMachinePanel = null;
    this.preview = null;
    this.output = null;
    return this;
  }

  setTargetSprite(sprite) {
    this.targetSprite = sprite;
    return this;
  }

  setFrames(frames = [], atlas = null) {
    this.frames = normalizeFrames(frames, atlas);
    this.selectedFrame = this.frames[0] || null;
    this._renderFrames();
    return this;
  }

  selectFrame(frameId) {
    this.selectedFrame = this.frames.find((frame) => frame.id === frameId || frame.texture === frameId) || null;
    this._renderFrames();
    return this.selectedFrame;
  }

  addKeyframe(frameId = this.selectedFrame?.id, props = {}) {
    const frame = this.frames.find((item) => item.id === frameId || item.texture === frameId) || this.selectedFrame;
    if (!frame) return null;
    const keyframe = {
      time: props.time ?? this.keyframes.length,
      frame: frame.id,
      texture: frame.texture,
      track: props.track || inferTrack(props),
      x: props.x === undefined ? undefined : Number(props.x),
      y: props.y === undefined ? undefined : Number(props.y),
      rotation: Number(props.rotation ?? 0),
      scaleX: Number(props.scaleX ?? props.scale ?? 1),
      scaleY: Number(props.scaleY ?? props.scale ?? 1),
      alpha: Number(props.alpha ?? 1),
      tint: props.tint,
      easing: props.easing || 'linear',
      curve: props.curve || (this.curves[props.easing] ? props.easing : undefined)
    };
    this.keyframes.push(keyframe);
    this.keyframes.sort((a, b) => a.time - b.time);
    this._renderTimeline();
    this._sync();
    return keyframe;
  }

  moveKeyframe(indexOrKeyframe, time) {
    const keyframe = typeof indexOrKeyframe === 'number'
      ? this.keyframes[indexOrKeyframe]
      : indexOrKeyframe;
    if (!keyframe || !Number.isFinite(Number(time))) return null;
    keyframe.time = Number(time);
    this.keyframes.sort((a, b) => a.time - b.time);
    this._renderTimeline();
    this._sync();
    return keyframe;
  }

  previewAt(time = 0) {
    const preview = interpolateKeyframes(this.keyframes, Number(time), this.curves);
    if (!preview) return null;
    this._applyPreview(preview);
    return preview;
  }

  setEasingCurve(name, points = []) {
    const id = String(name || '').trim();
    if (!id) return null;
    const curve = {
      name: id,
      points: normalizeCurvePoints(points)
    };
    this.curves[id] = curve;
    for (const keyframe of this.keyframes) {
      if (keyframe.easing === id) keyframe.curve = id;
    }
    this._renderCurveEditor();
    this._renderTimeline();
    this._sync();
    return curve;
  }

  addState(name, options = {}) {
    const id = String(name || '').trim();
    if (!id) return null;
    const state = {
      animation: options.animation || id,
      loop: options.loop ?? true,
      speed: Number(options.speed ?? 1)
    };
    this.states[id] = state;
    if (!this.initialState) this.initialState = id;
    this._renderStateMachine();
    this._sync();
    return { id, ...state };
  }

  addTransition(from, to, options = {}) {
    const source = String(from || '').trim();
    const target = String(to || '').trim();
    if (!source || !target) return null;
    const transition = {
      from: source,
      to: target,
      when: normalizeTransitionCondition(options.when),
      blend: Number(options.blend ?? 0)
    };
    this.transitions.push(transition);
    this._renderStateMachine();
    this._sync();
    return transition;
  }

  addParameter(name, type = 'boolean', defaultValue = null) {
    const id = String(name || '').trim();
    if (!id) return null;
    const parameter = { type, default: defaultValue };
    this.parameters[id] = parameter;
    this._renderStateMachine();
    this._sync();
    return { id, ...parameter };
  }

  playPreview({ from = 0, to = null, step = null } = {}) {
    const start = Number(from);
    const end = Number(to ?? Math.max(start, ...this.keyframes.map((keyframe) => keyframe.time)));
    const interval = Number(step ?? (this.frameRate > 0 ? 1 / this.frameRate : 1));
    const frames = [];
    for (let time = start; time <= end + Number.EPSILON; time += interval || 1) {
      const preview = this.previewAt(Number(time.toFixed(6)));
      if (preview) frames.push(preview);
      if (!interval) break;
    }
    const payload = {
      animation: this.animation,
      from: start,
      to: end,
      step: interval || 1,
      frames
    };
    this.store?.set?.('editor:animationPreviewPlayback', payload);
    return payload;
  }

  exportAnimationJson() {
    return {
      format: 'OmniCore.Animation',
      version: 1,
      curves: cloneCurves(this.curves),
      animations: {
        [this.animation]: {
          frameRate: this.frameRate,
          loop: true,
          keyframes: this.keyframes.map((frame) => ({ ...frame })),
          tracks: groupKeyframesByTrack(this.keyframes, this.tracks)
        }
      },
      stateMachine: this.exportStateMachineJson()
    };
  }

  exportStateMachineJson() {
    return {
      format: 'OmniCore.AnimationStateMachine',
      version: 1,
      initial: this.initialState,
      parameters: cloneStates(this.parameters),
      states: cloneStates(this.states),
      transitions: this.transitions.map((transition) => ({
        ...transition,
        when: cloneCondition(transition.when)
      }))
    };
  }

  installOnSprite(sprite, name = this.animation) {
    const data = this.exportAnimationJson();
    if (name !== this.animation) {
      data.animations[name] = data.animations[this.animation];
      delete data.animations[this.animation];
    }
    sprite?.setAnimations?.(data);
    return data;
  }

  _bind() {
    this.panel.querySelector('[data-name]')?.addEventListener('input', (event) => {
      this.animation = event.target.value || 'walk';
      this._sync();
    });
    this.panel.querySelector('[data-fps]')?.addEventListener('input', (event) => {
      this.frameRate = Number(event.target.value || 12);
      this._sync();
    });
    this.timeline.addEventListener('dragover', (event) => event.preventDefault());
    this.timeline.addEventListener('drop', (event) => {
      event.preventDefault();
      const keyframeIndex = event.dataTransfer?.getData('application/omnicore-keyframe-index');
      if (keyframeIndex) {
        this.moveKeyframe(Number(keyframeIndex), this._timeFromDrop(event));
        this.previewAt(this.keyframes[Number(keyframeIndex)]?.time ?? 0);
        return;
      }
      const frameId = event.dataTransfer?.getData('text/plain') || this.selectedFrame?.id;
      this.addKeyframe(frameId, this._readTransform());
    });
    this.panel.querySelector('[data-add-curve]')?.addEventListener('click', () => {
      const name = this.panel.querySelector('[data-curve-name-input]')?.value;
      const points = parseCurvePointInput(this.panel.querySelector('[data-curve-points]')?.value);
      this.setEasingCurve(name, points);
    });
    this.panel.querySelector('[data-add-state]')?.addEventListener('click', () => {
      const name = this.panel.querySelector('[data-state-name]')?.value;
      const animation = this.panel.querySelector('[data-state-animation]')?.value || name;
      this.addState(name, { animation });
    });
    this.panel.querySelector('[data-add-transition]')?.addEventListener('click', () => {
      const from = this.panel.querySelector('[data-transition-from]')?.value;
      const to = this.panel.querySelector('[data-transition-to]')?.value;
      const when = parseTransitionCondition(this.panel.querySelector('[data-transition-when]')?.value);
      this.addTransition(from, to, { when });
    });
    this.panel.querySelector('[data-export]')?.addEventListener('click', () => this._downloadAnimationJson());
  }

  _readTransform() {
    return {
      rotation: this.panel.querySelector('[data-rotation]')?.value,
      scaleX: this.panel.querySelector('[data-scale-x]')?.value,
      scaleY: this.panel.querySelector('[data-scale-y]')?.value,
      alpha: this.panel.querySelector('[data-alpha]')?.value,
      easing: this.panel.querySelector('[data-easing]')?.value || 'linear'
    };
  }

  _renderFrames() {
    const list = this.panel?.querySelector('[data-frames]');
    if (!list) return;
    list.textContent = '';
    for (const frame of this.frames) {
      const item = this.document.createElement('button');
      item.type = 'button';
      item.draggable = true;
      item.className = frame === this.selectedFrame ? 'active' : '';
      item.textContent = frame.id;
      item.addEventListener('click', () => this.selectFrame(frame.id));
      item.addEventListener('dragstart', (event) => {
        event.dataTransfer?.setData('text/plain', frame.id);
        this.selectedFrame = frame;
      });
      list.appendChild(item);
    }
  }

  _renderTimeline() {
    if (!this.timeline) return;
    this.timeline.textContent = '';
    const grouped = groupKeyframesByTrack(this.keyframes, this.tracks);
    for (const track of this.tracks) {
      const lane = this.document.createElement('div');
      lane.className = 'omni-timeline-track';
      lane.dataset.timelineTrack = track;
      const label = this.document.createElement('strong');
      label.textContent = track;
      lane.appendChild(label);
      const frames = grouped[track]?.keyframes || [];
      if (!frames.length) {
        const empty = this.document.createElement('span');
        empty.textContent = 'Drop frames here';
        lane.appendChild(empty);
      }
      frames.forEach((keyframe) => {
        const index = this.keyframes.indexOf(keyframe);
        const node = this.document.createElement('button');
        node.type = 'button';
        node.draggable = true;
        node.textContent = `${keyframe.time}: ${keyframe.frame} (${keyframe.curve || keyframe.easing || 'linear'})`;
        node.dataset.omnicoreKeyframeIndex = String(index);
        node.dataset.keyframeTrack = track;
        node.addEventListener('dragstart', (event) => {
          event.dataTransfer?.setData('application/omnicore-keyframe-index', String(index));
          event.dataTransfer?.setData('text/plain', keyframe.frame);
        });
        node.addEventListener('click', () => this.previewAt(keyframe.time));
        lane.appendChild(node);
      });
      this.timeline.appendChild(lane);
    }
  }

  _renderCurveEditor() {
    const list = this.panel?.querySelector('[data-curve-list]');
    if (!list) return;
    list.textContent = '';
    const names = Object.keys(this.curves);
    if (!names.length) {
      const empty = this.document.createElement('span');
      empty.textContent = 'No curves';
      list.appendChild(empty);
      return;
    }
    for (const name of names) {
      const curve = this.curves[name];
      const item = this.document.createElement('button');
      item.type = 'button';
      item.dataset.curveName = name;
      item.textContent = `${name} (${curve.points.length} points)`;
      item.addEventListener('click', () => {
        const easing = this.panel.querySelector('[data-easing]');
        if (easing) easing.value = name;
      });
      list.appendChild(item);
    }
  }

  _renderStateMachine() {
    const stateList = this.panel?.querySelector('[data-state-list]');
    const transitionList = this.panel?.querySelector('[data-transition-list]');
    if (!stateList || !transitionList) return;
    stateList.textContent = '';
    transitionList.textContent = '';
    for (const [id, state] of Object.entries(this.states)) {
      const item = this.document.createElement('button');
      item.type = 'button';
      item.dataset.stateId = id;
      item.textContent = `${id}: ${state.animation}${id === this.initialState ? ' initial' : ''}`;
      item.addEventListener('click', () => {
        this.initialState = id;
        this._renderStateMachine();
        this._sync();
      });
      stateList.appendChild(item);
    }
    for (const transition of this.transitions) {
      const item = this.document.createElement('div');
      item.dataset.transition = `${transition.from}->${transition.to}`;
      item.dataset.animatorEdge = `${transition.from}->${transition.to}`;
      item.textContent = `${transition.from} -> ${transition.to} when ${formatCondition(transition.when)}`;
      transitionList.appendChild(item);
    }
  }

  _sync() {
    const json = this.exportAnimationJson();
    if (this.output) this.output.value = JSON.stringify(json, null, 2);
    this.store?.set?.('editor:animationJson', json);
    this.store?.set?.('editor:animationCurves', cloneCurves(this.curves));
    this.store?.set?.('editor:animationStateMachine', this.exportStateMachineJson());
  }

  _downloadAnimationJson() {
    this._sync();
    if (!globalThis.Blob || !globalThis.URL || !this.document) return;
    const blob = new Blob([JSON.stringify(this.exportAnimationJson(), null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = url;
    link.download = 'animation.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  _timeFromDrop(event) {
    const rect = this.timeline?.getBoundingClientRect?.();
    if (!rect?.width) return this.keyframes.length;
    const ratio = Math.max(0, Math.min(1, ((event.clientX ?? rect.left) - rect.left) / rect.width));
    const maxTime = Math.max(1, ...this.keyframes.map((keyframe) => keyframe.time));
    return Number((ratio * maxTime).toFixed(2));
  }

  _applyPreview(preview) {
    if (this.targetSprite) {
      this.targetSprite.rotation = preview.rotation;
      this.targetSprite.scale = preview.scaleX === preview.scaleY ? preview.scaleX : this.targetSprite.scale;
      this.targetSprite.scaleX = preview.scaleX;
      this.targetSprite.scaleY = preview.scaleY;
      this.targetSprite.alpha = preview.alpha;
    }
    if (this.preview) {
      this.preview.style.transform = `rotate(${preview.rotation}rad) scale(${preview.scaleX}, ${preview.scaleY})`;
      this.preview.style.opacity = String(preview.alpha);
      this.preview.textContent = preview.frame || preview.texture || 'Sprite Preview';
    }
    this.store?.set?.('editor:animationPreview', { ...preview });
  }
}

function normalizeFrames(frames = [], atlas = null) {
  if (atlas?.frames && typeof atlas.frames === 'object') {
    return Object.keys(atlas.frames).map((id) => ({ id, texture: id, atlas: atlas.frames[id] }));
  }
  return frames.map((frame, index) => {
    if (typeof frame === 'string') return { id: frame, texture: frame };
    const id = frame.id || frame.name || frame.texture || `frame-${index}`;
    return { ...frame, id, texture: frame.texture || frame.frame || id };
  });
}

function createStandardCurves() {
  return {
    easeIn: { name: 'easeIn', points: normalizeCurvePoints([0, 0, 0.35, 0.08, 0.72, 0.62, 1, 1]) },
    easeOut: { name: 'easeOut', points: normalizeCurvePoints([0, 0, 0.28, 0.38, 0.65, 0.92, 1, 1]) },
    bounce: { name: 'bounce', points: normalizeCurvePoints([0, 0, 0.35, 1.08, 0.55, 0.78, 0.78, 1.04, 1, 1]) }
  };
}

function inferTrack(props = {}) {
  if (props.track) return props.track;
  if (props.tint !== undefined || props.alpha !== undefined) return 'Color';
  if (props.x !== undefined || props.y !== undefined || props.rotation !== undefined || props.scale !== undefined) return 'Transform';
  return 'Sprite';
}

function groupKeyframesByTrack(keyframes = [], tracks = []) {
  const grouped = Object.fromEntries(tracks.map((track) => [track, { keyframes: [] }]));
  for (const keyframe of keyframes) {
    const track = keyframe.track || inferTrack(keyframe);
    if (!grouped[track]) grouped[track] = { keyframes: [] };
    grouped[track].keyframes.push(keyframe);
  }
  for (const entry of Object.values(grouped)) {
    entry.keyframes.sort((left, right) => left.time - right.time);
  }
  return grouped;
}

function escapeAttr(value) {
  return String(value).replace(/"/g, '&quot;');
}

function interpolateKeyframes(keyframes = [], time = 0, curves = {}) {
  if (!keyframes.length) return null;
  const sorted = [...keyframes].sort((a, b) => a.time - b.time);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (time <= first.time) return clonePreview(first);
  if (time >= last.time) return clonePreview(last);

  const before = sorted.findLast((keyframe) => keyframe.time <= time) || first;
  const after = sorted.find((keyframe) => keyframe.time >= time) || last;
  if (before === after) return clonePreview(before);
  const span = after.time - before.time || 1;
  const ratio = (time - before.time) / span;
  const easing = after.curve || after.easing || before.curve || before.easing || 'linear';
  const easedRatio = applyEasing(easing, ratio, curves);
  return {
    time,
    frame: ratio < 0.5 ? before.frame : after.frame,
    texture: ratio < 0.5 ? before.texture : after.texture,
    rotation: lerp(before.rotation, after.rotation, easedRatio),
    scaleX: lerp(before.scaleX, after.scaleX, easedRatio),
    scaleY: lerp(before.scaleY, after.scaleY, easedRatio),
    alpha: lerp(before.alpha, after.alpha, easedRatio),
    easing,
    curve: curves[easing] ? easing : undefined
  };
}

function clonePreview(keyframe) {
  return {
    time: keyframe.time,
    frame: keyframe.frame,
    texture: keyframe.texture,
    rotation: Number(keyframe.rotation ?? 0),
    scaleX: Number(keyframe.scaleX ?? keyframe.scale ?? 1),
    scaleY: Number(keyframe.scaleY ?? keyframe.scale ?? 1),
    alpha: Number(keyframe.alpha ?? 1),
    easing: keyframe.easing || 'linear',
    curve: keyframe.curve
  };
}

function lerp(left, right, ratio) {
  return Number((Number(left ?? 0) + (Number(right ?? 0) - Number(left ?? 0)) * ratio).toFixed(6));
}

function applyEasing(name, ratio, curves = {}) {
  if (curves[name]) return sampleCurve(curves[name].points, ratio);
  if (name === 'easeInQuad') return ratio * ratio;
  if (name === 'easeOutQuad') return ratio * (2 - ratio);
  if (name === 'easeInOutQuad') {
    return ratio < 0.5 ? 2 * ratio * ratio : -1 + (4 - 2 * ratio) * ratio;
  }
  return ratio;
}

function normalizeCurvePoints(points = []) {
  if (!Array.isArray(points)) return defaultCurvePoints();
  const normalized = [];
  if (typeof points[0] === 'number') {
    for (let index = 0; index < points.length - 1; index += 2) {
      const x = Number(points[index]);
      const y = Number(points[index + 1]);
      if (Number.isFinite(x) && Number.isFinite(y)) normalized.push({ x, y });
    }
  } else {
    for (const point of points) {
      const x = Number(point?.x);
      const y = Number(point?.y);
      if (Number.isFinite(x) && Number.isFinite(y)) normalized.push({ x, y });
    }
  }
  if (normalized.length < 2) return defaultCurvePoints();
  normalized.sort((left, right) => left.x - right.x);
  return normalized;
}

function defaultCurvePoints() {
  return [
    { x: 0, y: 0 },
    { x: 1, y: 1 }
  ];
}

function sampleCurve(points = defaultCurvePoints(), ratio = 0) {
  const x = Math.max(0, Math.min(1, Number(ratio) || 0));
  const sorted = normalizeCurvePoints(points);
  if (x <= sorted[0].x) return sorted[0].y;
  const last = sorted[sorted.length - 1];
  if (x >= last.x) return last.y;
  for (let index = 1; index < sorted.length; index += 1) {
    const right = sorted[index];
    const left = sorted[index - 1];
    if (x <= right.x) {
      const span = right.x - left.x || 1;
      const local = (x - left.x) / span;
      return lerp(left.y, right.y, local);
    }
  }
  return x;
}

function parseCurvePointInput(value = '') {
  return String(value)
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((number) => Number.isFinite(number));
}

function normalizeTransitionCondition(condition = {}) {
  if (typeof condition === 'string') return parseTransitionCondition(condition);
  if (typeof condition === 'function') return { function: condition.name || 'anonymous' };
  if (!condition || typeof condition !== 'object') return {};
  return JSON.parse(JSON.stringify(condition));
}

function parseTransitionCondition(value = '') {
  const text = String(value).trim();
  if (!text) return {};
  const [key, rawValue = 'true'] = text.split(':');
  if (!key) return {};
  if (rawValue === 'true') return { [key]: true };
  if (rawValue === 'false') return { [key]: false };
  const number = Number(rawValue);
  return { [key]: Number.isFinite(number) ? number : rawValue };
}

function formatCondition(condition = {}) {
  return Object.entries(condition)
    .map(([key, value]) => `${key}:${value}`)
    .join(', ') || 'manual';
}

function cloneCurves(curves = {}) {
  return Object.fromEntries(
    Object.entries(curves).map(([name, curve]) => [
      name,
      { name, points: normalizeCurvePoints(curve.points).map((point) => ({ ...point })) }
    ])
  );
}

function cloneStates(states = {}) {
  return JSON.parse(JSON.stringify(states));
}

function cloneCondition(condition = {}) {
  return JSON.parse(JSON.stringify(condition));
}

export default AnimationEditor;
