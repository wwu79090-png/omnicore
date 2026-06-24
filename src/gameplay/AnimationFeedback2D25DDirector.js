export const ANIMATION_FEEDBACK_2D_25D_SCHEMA = 'omnicore.animation-feedback-2d-25d-director.v1';

/**
 * Builds one animation and combat feedback step for 2D/2.5D games.
 */
export function createAnimationFeedback2D25DDirectorStep(config = {}) {
  const delta = Math.max(0, numberOr(config.delta, 1 / 60));
  const timeMs = Math.max(0, numberOr(config.timeMs, 0));
  const actor = normalizeActor(config.actor || {});
  const animation = buildAnimationState(config.animation || {}, config.clips || {}, config.locks || {});
  const damageEvents = normalizeDamageEvents(config.combat?.damageEvents || []);
  const feedback = normalizeFeedback(config.feedback || {});
  const hitstop = buildHitstopState(damageEvents, feedback);
  const flashes = buildFlashes(damageEvents, feedback, config.combat?.healthUpdates || {});
  const particles = buildParticles(damageEvents, feedback);
  const audio = buildAudioCues(damageEvents, feedback);
  const camera = buildCameraImpulses(damageEvents, feedback);
  const combo = buildComboState(config.combo || {}, animation);
  const editor = buildEditorState();
  const runtimeSync = buildRuntimeSyncState();
  const debugDraw = buildDebugDraw({ animation, hitstop, flashes, particles, combo });
  const quality = buildQualityChecks({ animation, hitstop, flashes, particles, audio, combo, editor, runtimeSync });

  return {
    schema: ANIMATION_FEEDBACK_2D_25D_SCHEMA,
    delta,
    timeMs,
    actor,
    animation,
    hitstop,
    flashes,
    particles,
    audio,
    camera,
    combo,
    editor,
    runtimeSync,
    debugDraw,
    quality
  };
}

function normalizeActor(actor = {}) {
  return {
    id: actor.id || actor.name || 'actor',
    facing: actor.facing || 'right'
  };
}

function buildAnimationState(animationInput, clips, locks) {
  const activeState = animationInput.state || animationInput.activeState || 'idle';
  const elapsedMs = Math.max(0, numberOr(animationInput.elapsedMs, 0));
  const lockMs = Math.max(0, numberOr(locks[activeState], 0));
  const lockRemainingMs = Math.max(0, lockMs - elapsedMs);
  return {
    activeState,
    clip: clips[activeState] || activeState,
    previousState: animationInput.previousState || null,
    elapsedMs,
    locked: lockRemainingMs > 0,
    lockMs,
    lockRemainingMs
  };
}

function normalizeDamageEvents(events) {
  return (Array.isArray(events) ? events : [events]).filter(Boolean).map((event, index) => ({
    id: event.id || `damage-${index}`,
    attackerId: event.attackerId || event.sourceId || null,
    targetId: event.targetId || event.victimId || null,
    hitboxId: event.hitboxId || null,
    damage: Math.max(0, numberOr(event.damage, 0)),
    point: {
      x: numberOr(event.point?.x ?? event.x, 0),
      y: numberOr(event.point?.y ?? event.y, 0)
    },
    tags: Array.isArray(event.tags) ? [...event.tags] : []
  }));
}

function normalizeFeedback(feedback = {}) {
  return {
    hitstopMsPerDamage: numberOr(feedback.hitstopMsPerDamage, 4),
    maxHitstopMs: numberOr(feedback.maxHitstopMs, 20),
    hurtFlashMs: numberOr(feedback.hurtFlashMs, 80),
    hurtFlashColor: feedback.hurtFlashColor || '#ffffff',
    cameraTraumaPerDamage: numberOr(feedback.cameraTraumaPerDamage, 0.06),
    particlePreset: feedback.particlePreset || 'impact-sparks',
    audioCue: feedback.audioCue || 'impact',
    freezeAttacker: feedback.freezeAttacker !== false,
    freezeTarget: feedback.freezeTarget !== false
  };
}

function buildHitstopState(events, feedback) {
  const durationMs = round(Math.min(
    feedback.maxHitstopMs,
    events.reduce((sum, event) => sum + event.damage * feedback.hitstopMsPerDamage, 0)
  ));
  return {
    active: durationMs > 0,
    durationMs,
    freezeTargets: collectFreezeTargets(events, feedback)
  };
}

function buildFlashes(events, feedback, healthUpdates) {
  return events.filter((event) => event.targetId).map((event, index) => ({
    id: `flash-${event.targetId}-${index}`,
    kind: 'hurt-flash',
    targetId: event.targetId,
    durationMs: feedback.hurtFlashMs,
    color: feedback.hurtFlashColor,
    health: healthUpdates[event.targetId] || null
  }));
}

function buildParticles(events, feedback) {
  return {
    commands: events.map((event, index) => ({
      id: `impact-${event.targetId || 'target'}-${index}`,
      preset: feedback.particlePreset,
      x: event.point.x,
      y: event.point.y,
      attackerId: event.attackerId,
      targetId: event.targetId,
      tags: [...event.tags]
    }))
  };
}

function buildAudioCues(events, feedback) {
  return {
    cues: events.map((event, index) => ({
      id: `audio-${event.targetId || 'target'}-${index}`,
      cue: feedback.audioCue,
      targetId: event.targetId,
      attackerId: event.attackerId,
      tags: [...event.tags]
    }))
  };
}

function buildCameraImpulses(events, feedback) {
  return {
    impulses: events.map((event, index) => ({
      id: `camera-impulse-${index}`,
      trauma: round(event.damage * feedback.cameraTraumaPerDamage),
      reason: 'combat-hit',
      targetId: event.targetId,
      x: event.point.x,
      y: event.point.y
    }))
  };
}

function buildComboState(comboInput, animation) {
  const windows = (Array.isArray(comboInput.windows) ? comboInput.windows : []).map((windowInput, index) => ({
    id: windowInput.id || `combo-window-${index}`,
    fromState: windowInput.fromState || '*',
    nextState: windowInput.nextState || null,
    openMs: Math.max(0, numberOr(windowInput.openMs, 0)),
    closeMs: Math.max(0, numberOr(windowInput.closeMs, 0))
  }));
  const activeWindow = windows.find((window) => (
    (window.fromState === '*' || window.fromState === animation.activeState)
    && animation.elapsedMs >= window.openMs
    && animation.elapsedMs <= window.closeMs
  )) || null;
  const currentIndex = Math.max(0, Math.trunc(numberOr(comboInput.currentIndex, 0)));
  const queuedState = activeWindow && comboInput.inputBuffered ? activeWindow.nextState : null;
  return {
    actorId: comboInput.actorId || null,
    currentIndex,
    nextIndex: queuedState ? currentIndex + 1 : currentIndex,
    activeWindow: Boolean(activeWindow),
    queuedState,
    inputBuffered: comboInput.inputBuffered === true,
    windows
  };
}

function buildEditorState() {
  return {
    format: 'omnicore.animation-feedback-2d25d-editor.v1',
    panels: [
      'AnimationFeedback',
      'Hitstop',
      'HurtFlash',
      'ImpactParticles',
      'AudioCues',
      'ComboWindows',
      'CameraImpulse',
      'RuntimeDebug'
    ],
    tools: [
      'AnimationStateInspector',
      'HitstopCurveEditor',
      'FlashPreview',
      'ParticleCuePreview',
      'AudioCuePreview',
      'ComboWindowTimeline'
    ],
    hotReloadTopics: [
      'animation-feedback:changed',
      'hitstop:changed',
      'hurt-flash:changed',
      'combo-window:changed',
      'impact-cues:changed'
    ]
  };
}

function buildRuntimeSyncState() {
  return {
    protocol: 'omnicore.runtime-sync.animation-feedback-2d25d/v1',
    payloads: [
      'animation',
      'hitstop',
      'flashes',
      'particles',
      'audio',
      'combo',
      'camera',
      'editor'
    ],
    events: [
      'animation:state-step',
      'combat:hitstop',
      'combat:hurt-flash',
      'combat:impact-particle',
      'combat:audio-cue',
      'combat:combo-window',
      'camera:impact-trauma'
    ]
  };
}

function buildDebugDraw({ animation, hitstop, flashes, particles, combo }) {
  return [
    {
      op: 'debug:animation-state',
      state: animation.activeState,
      clip: animation.clip,
      locked: animation.locked,
      lockRemainingMs: animation.lockRemainingMs
    },
    {
      op: 'debug:hitstop',
      active: hitstop.active,
      durationMs: hitstop.durationMs,
      freezeTargets: [...hitstop.freezeTargets]
    },
    ...flashes.map((flash) => ({ op: 'debug:hurt-flash', ...flash })),
    ...particles.commands.map((command) => ({ op: 'debug:impact-particle', ...command })),
    {
      op: 'debug:combo-window',
      active: combo.activeWindow,
      queuedState: combo.queuedState,
      currentIndex: combo.currentIndex,
      nextIndex: combo.nextIndex
    }
  ];
}

function buildQualityChecks({ animation, hitstop, flashes, particles, audio, combo, editor, runtimeSync }) {
  return {
    checks: [
      {
        id: 'animation-clip-resolved',
        pass: Boolean(animation.clip),
        detail: `${animation.activeState}:${animation.clip}`
      },
      {
        id: 'combat-hitstop',
        pass: hitstop.active && hitstop.durationMs > 0,
        detail: `${hitstop.durationMs}ms`
      },
      {
        id: 'hurt-flash-feedback',
        pass: flashes.length > 0,
        detail: `${flashes.length} flashes`
      },
      {
        id: 'impact-cues',
        pass: particles.commands.length > 0 && audio.cues.length > 0,
        detail: `${particles.commands.length} particles, ${audio.cues.length} audio`
      },
      {
        id: 'combo-window',
        pass: combo.activeWindow,
        detail: combo.queuedState || 'window open'
      },
      {
        id: 'editor-runtime-feedback-sync',
        pass: editor.panels.length > 0 && runtimeSync.payloads.includes('animation'),
        detail: runtimeSync.protocol
      }
    ]
  };
}

function collectFreezeTargets(events, feedback) {
  const targets = [];
  for (const event of events) {
    if (feedback.freezeAttacker && event.attackerId) targets.push(event.attackerId);
    if (feedback.freezeTarget && event.targetId) targets.push(event.targetId);
  }
  return [...new Set(targets)];
}

function numberOr(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function round(value) {
  return Math.round(numberOr(value, 0) * 1000) / 1000;
}

export default createAnimationFeedback2D25DDirectorStep;
