import { Scene, Sprite } from '../scene/Scene.js';
import Button from '../ui/Button.js';
import Node from '../node/Node.js';
import { createOmniError } from '../core/OmniError.js';

/**
 * JSON prefab instantiator with Cocos-style component mounting.
 *
 * @example
 * const enemy = PrefabManager.instantiate({
 *   type: 'sprite',
 *   texture: 'enemy',
 *   components: [{ type: EnemyAI, options: { speed: 90 } }]
 * }, 100, 200);
 */
function resolveComponent(type, registry = {}) {
  if (typeof type === 'function') return type;
  return registry.components?.[type] || registry[type];
}

export class PrefabManager {
  static instantiate(json, x = 0, y = 0, registry = {}, overrides = {}) {
    const resolved = PrefabManager._mergeOverride(json, overrides[''] || overrides[json.name] || {});
    let instance;
    if (resolved.type === 'button') instance = new Button(resolved.text || 'Button', { ...resolved, x, y });
    else if (resolved.type === 'scene') instance = new Scene(resolved.name || 'prefab-scene', resolved.options);
    else if (resolved.type === 'node') instance = new Node({ ...resolved, x, y, children: [] });
    else instance = new Sprite(resolved.texture, { ...resolved, x, y });

    Object.assign(instance, resolved.props || {});
    if (instance.props) instance.props = { ...instance.props, ...(resolved.props || {}) };
    instance.x = x;
    instance.y = y;
    if (resolved.name) instance.name = resolved.name;

    for (const component of resolved.components || []) {
      const Component = resolveComponent(component.type, registry);
      if (!Component) throw createOmniError('Prefab', `Prefab 组件尚未注册：${component.type}`);
      instance.addComponent(Component, component.options || {});
    }

    for (const child of resolved.children || []) {
      const path = child.name || child.id || '';
      const childOverrides = PrefabManager._selectChildOverrides(overrides, path);
      const childJson = PrefabManager._mergeOverride(child, overrides[path] || {});
      const childInstance = PrefabManager.instantiate(
        childJson,
        childJson.x ?? 0,
        childJson.y ?? 0,
        registry,
        childOverrides
      );
      if (typeof instance.addChild === 'function') instance.addChild(childInstance);
      else instance.add?.(childInstance);
    }

    return instance;
  }

  static _mergeOverride(json, override = {}) {
    return {
      ...json,
      ...override,
      props: { ...(json.props || {}), ...(override.props || {}) },
      children: override.children || json.children || []
    };
  }

  static _selectChildOverrides(overrides, childPath) {
    const selected = {};
    for (const [path, override] of Object.entries(overrides || {})) {
      if (!childPath) continue;
      if (path === childPath) selected[''] = override;
      else if (path.startsWith(`${childPath}/`)) selected[path.slice(childPath.length + 1)] = override;
    }
    return selected;
  }
}

export default PrefabManager;
