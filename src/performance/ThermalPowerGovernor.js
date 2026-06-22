export class ThermalPowerGovernor {
  constructor({ targetFps = 60, minFps = 30 } = {}) {
    this.targetFps = Math.max(1, Math.floor(Number(targetFps) || 60));
    this.minFps = Math.max(1, Math.floor(Number(minFps) || 30));
  }

  evaluate(state = {}) {
    const constraints = [];
    const thermal = String(state.thermalState || 'nominal').toLowerCase();
    if (state.lowPowerMode) constraints.push('lowPowerMode');
    if (Number(state.batteryLevel) <= 0.15 && state.pluggedIn !== true) constraints.push('lowBattery');
    if (thermal === 'serious' || thermal === 'critical') constraints.push(`thermal${capitalize(thermal)}`);
    if (state.saveData) constraints.push('saveData');

    const constrained = constraints.length > 0;
    return {
      status: constrained ? 'constrained' : 'nominal',
      targetFps: constrained ? this.minFps : this.targetFps,
      constraints,
      qualityBudget: constrained ? {
        renderScale: 0.75,
        textureQuality: 0.5,
        backgroundEffects: false
      } : {
        renderScale: 1,
        textureQuality: 1,
        backgroundEffects: true
      },
      actions: constrained ? actionsFor(constraints) : []
    };
  }
}

function actionsFor(constraints) {
  const actions = ['capFrameRate', 'reduceTextureQuality', 'disableBackgroundEffects'];
  if (constraints.includes('saveData')) actions.push('lowerNetworkSnapshotRate');
  return actions;
}

function capitalize(value) {
  const text = String(value || '');
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}

export default ThermalPowerGovernor;
