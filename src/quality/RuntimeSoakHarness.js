/**
 * Runtime soak harness for repeated scene lifecycle and resource leak checks.
 */
import { Scene, Sprite } from '../scene/Scene.js';
import Tween from '../tween/Tween.js';

export const RUNTIME_SOAK_REPORT_SCHEMA = 'omnicore.runtime-soak-report.v1';

export class RuntimeSoakHarness {
  constructor({
    iterations = 120,
    spritesPerScene = 8,
    resourcesPerScene = 2,
    tweensPerScene = 2,
    generatedAt = new Date().toISOString()
  } = {}) {
    this.iterations = Math.max(1, Number(iterations) || 1);
    this.spritesPerScene = Math.max(0, Number(spritesPerScene) || 0);
    this.resourcesPerScene = Math.max(0, Number(resourcesPerScene) || 0);
    this.tweensPerScene = Math.max(0, Number(tweensPerScene) || 0);
    this.generatedAt = generatedAt;
  }

  run() {
    return createRuntimeSoakReport({
      iterations: this.iterations,
      spritesPerScene: this.spritesPerScene,
      resourcesPerScene: this.resourcesPerScene,
      tweensPerScene: this.tweensPerScene,
      generatedAt: this.generatedAt
    });
  }
}

export function createRuntimeSoakReport({
  iterations = 120,
  spritesPerScene = 8,
  resourcesPerScene = 2,
  tweensPerScene = 2,
  generatedAt = new Date().toISOString()
} = {}) {
  const totals = {
    scenesCreated: 0,
    scenesDestroyed: 0,
    spritesCreated: 0,
    resourcesCreated: 0,
    resourcesDestroyed: 0,
    tweensCreated: 0,
    timersCreated: 0
  };
  const peak = {
    entities: 0,
    resources: 0,
    listeners: 0
  };
  const leaks = [];
  const warnings = [];

  for (let iteration = 0; iteration < Math.max(1, Number(iterations) || 1); iteration += 1) {
    const scene = new Scene(`soak-${iteration}`);
    totals.scenesCreated += 1;
    const resources = [];

    scene.on('tick', () => {});
    scene.timer.delay(16, () => {});
    totals.timersCreated += 1;

    for (let index = 0; index < Math.max(0, Number(spritesPerScene) || 0); index += 1) {
      scene.add(new Sprite(`sprite-${index}.png`, {
        x: index * 2,
        y: iteration,
        width: 16,
        height: 16
      }));
      totals.spritesCreated += 1;
    }

    for (let index = 0; index < Math.max(0, Number(resourcesPerScene) || 0); index += 1) {
      const resource = createTrackedResource(`resource-${iteration}-${index}`, () => {
        totals.resourcesDestroyed += 1;
      });
      resources.push(resource);
      scene.trackResource(resource);
      totals.resourcesCreated += 1;
    }

    for (let index = 0; index < Math.max(0, Number(tweensPerScene) || 0); index += 1) {
      const target = { x: 0 };
      Tween.to(target, { x: 10, duration: 10, autoplay: false }).start().update(10);
      totals.tweensCreated += 1;
    }

    peak.entities = Math.max(peak.entities, scene.children.length);
    peak.resources = Math.max(peak.resources, scene.getResourceReport().resources.length);
    peak.listeners = Math.max(peak.listeners, scene.listeners.size);

    scene.update(1 / 60, iteration);
    scene.destroy();
    totals.scenesDestroyed += 1;

    if (scene.children.length !== 0) {
      leaks.push({
        code: 'scene-children-retained',
        scene: scene.name,
        count: scene.children.length
      });
    }
    if (scene.listeners.size !== 0) {
      leaks.push({
        code: 'scene-listeners-retained',
        scene: scene.name,
        count: scene.listeners.size
      });
    }
    const retainedResources = scene.resourceGraph.snapshot();
    if (retainedResources.length) {
      leaks.push({
        code: 'scene-resources-retained',
        scene: scene.name,
        resources: retainedResources
      });
    }
    for (const resource of resources) {
      if (!resource.destroyed) {
        leaks.push({
          code: 'resource-not-destroyed',
          scene: scene.name,
          id: resource.id
        });
      }
    }
  }

  if (totals.resourcesDestroyed !== totals.resourcesCreated) {
    leaks.push({
      code: 'resource-destroy-count-mismatch',
      created: totals.resourcesCreated,
      destroyed: totals.resourcesDestroyed
    });
  }

  return {
    schema: RUNTIME_SOAK_REPORT_SCHEMA,
    generatedAt,
    ok: leaks.length === 0,
    iterations: Math.max(1, Number(iterations) || 1),
    totals,
    peak,
    leaks,
    warnings
  };
}

function createTrackedResource(id, onDestroy) {
  return {
    id,
    type: 'soak-resource',
    destroyed: false,
    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      onDestroy();
    }
  };
}

export default RuntimeSoakHarness;
