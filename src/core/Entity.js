import { createOmniError } from './OmniError.js';
import Node from '../node/Node.js';
import { Sprite } from '../scene/Scene.js';

const REQUIRED_FIELD_TYPES = {
  sprite: 'sprite',
  body: 'object',
  storeKey: 'string'
};

const SCAN_CORE_FIELDS = ['sprite', 'body', 'storeKey'];

function normalizeTypeName(type) {
  if (typeof type === 'string') return type;
  if (typeof type === 'function') return type.name || 'Factory';
  if (type?.name) return type.name;
  if (type?.type) return String(type.type);
  return 'Entity';
}

function normalizeFieldList(source = []) {
  if (!Array.isArray(source)) return [];
  const list = [];
  for (const item of source) {
    if (!item) continue;
    if (typeof item === 'string') {
      list.push({ name: item, expectedType: REQUIRED_FIELD_TYPES[item] || 'any' });
      continue;
    }
    if (typeof item === 'object') {
      const name = String(item.name || item.field || '').trim();
      if (!name) continue;
      const expectedType = typeof item.type === 'string' && item.type ? item.type : (REQUIRED_FIELD_TYPES[name] || 'any');
      list.push({ name, expectedType });
    }
  }
  return list;
}

function normalizeRequiredFields(...sources) {
  const merged = new Map();
  for (const source of sources) {
    for (const entry of normalizeFieldList(source)) {
      if (!merged.has(entry.name)) merged.set(entry.name, entry.expectedType);
    }
  }
  return Array.from(merged.entries()).map(([name, expectedType]) => ({ name, expectedType }));
}

function pickRequiredFields(entity, type, props) {
  const auto = [];
  for (const field of SCAN_CORE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(entity, field) || field in entity) {
      auto.push({ name: field, expectedType: REQUIRED_FIELD_TYPES[field] || 'any' });
    }
  }

  const fromType = normalizeFieldList(entity?.requiredFields);
  const fromCtor = normalizeFieldList(entity?.constructor?.requiredFields);
  const fromTypeFn = normalizeFieldList(type?.requiredFields);
  const fromTypeProto = normalizeFieldList(type?.prototype?.requiredFields);
  const fromProps = normalizeFieldList(props?.requiredFields);

  const defaults = [];
  if (typeof type === 'string' && type.toLowerCase() === 'sprite') {
    defaults.push({ name: 'sprite', expectedType: 'sprite' });
  }

  const dedup = new Map();
  for (const item of [...auto, ...fromType, ...fromCtor, ...fromTypeFn, ...fromTypeProto, ...fromProps, ...defaults]) {
    dedup.set(item.name, item.expectedType);
  }
  return Array.from(dedup.entries()).map(([name, expectedType]) => ({ name, expectedType }));
}

function valueType(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'array';
  return typeof value;
}

function isEmptyValue(value) {
  return value === undefined || value === null || (typeof value === 'string' && value.length === 0);
}

function assertField({ owner, ownerLabel, field, expectedType }) {
  const value = owner?.[field];
  if (isEmptyValue(value)) {
    throw createOmniError(
      'Entity',
      `实体创建失败：${ownerLabel}.${field} 未完成初始化，期望类型=${expectedType}，当前类型=${valueType(value)}。`
    );
  }

  if (expectedType === 'sprite' && valueType(value) !== 'object' && valueType(value) !== 'string') {
    throw createOmniError(
      'Entity',
      `实体创建失败：${ownerLabel}.${field} 字段类型错误，期望 object|string，实际=${valueType(value)}。`
    );
  }

  if (expectedType === 'string' && valueType(value) !== 'string') {
    throw createOmniError(
      'Entity',
      `实体创建失败：${ownerLabel}.${field} 字段类型错误，期望 string，实际=${valueType(value)}。`
    );
  }

  if (expectedType === 'number' && valueType(value) !== 'number') {
    throw createOmniError(
      'Entity',
      `实体创建失败：${ownerLabel}.${field} 字段类型错误，期望 number，实际=${valueType(value)}。`
    );
  }

  if (expectedType === 'object' && (valueType(value) !== 'object' || value === null)) {
    throw createOmniError(
      'Entity',
      `实体创建失败：${ownerLabel}.${field} 字段类型错误，期望 object，实际=${valueType(value)}。`
    );
  }
}

function resolveComponentRequirements(component = {}) {
  const fromCtor = component?.constructor?.requiredFields;
  const fromInstance = component?.requiredFields;
  const merged = normalizeRequiredFields(fromCtor, fromInstance);
  return merged;
}

function instantiateComponent(component, options) {
  if (!component) return null;
  if (typeof component === 'function') return Reflect.construct(component, [options || {}]);
  return component;
}

export class EntityClass {
  /**
   * @param {string|Function|object} type Entity type, constructor, or object.
   * @param {object} props Entity properties.
   * @returns {object} Entity instance.
   *
   * @deprecated since 0.3.0, removeIn 2.0.0. Use `Entity.createEntity(type, props)` or `OmniCore.createEntity(type, props)`.
   * @replacement Entity.createEntity
   * @removeIn 2.0.0
   */
  static create(type = 'Node', props = {}) {
    return EntityClass.createEntity(type, props);
  }

  /**
   * @param {string|Function|object} type Entity type, constructor, or object.
   * @param {object} props Entity properties.
   * @returns {object} Entity instance.
   */
  static createEntity(type = 'Node', props = {}) {
    const mergedProps = props && typeof props === 'object' ? props : {};
    let entity = null;
    const normalizedType = normalizeTypeName(type);

    if (typeof type === 'function') {
      entity = Reflect.construct(type, [mergedProps]);
    } else if (typeof type === 'string' && (type === 'sprite' || type === 'Sprite')) {
      const texture = mergedProps.texture || mergedProps.sprite || mergedProps.textureUrl;
      if (texture == null) {
        throw createOmniError('Entity', 'Sprite 实体要求传入 texture / sprite / textureUrl。');
      }
      entity = new Sprite(texture, { ...mergedProps });
      entity.type = type;
      entity.name = entity.name || 'sprite';
    } else if (typeof type === 'string') {
      entity = new Node({
        name: mergedProps.name || type,
        type,
        x: mergedProps.x || 0,
        y: mergedProps.y || 0,
        zIndex: mergedProps.zIndex || 0,
        visible: mergedProps.visible ?? true,
        children: mergedProps.children || []
      });
      Object.assign(entity, mergedProps);
    } else if (type && typeof type === 'object') {
      entity = type;
      if (!entity.type) entity.type = 'Entity';
      Object.assign(entity, mergedProps);
    } else {
      throw createOmniError('Entity', `不支持的 Entity 类型：${String(type)}。`);
    }

    if (!entity) throw createOmniError('Entity', '实体实例化失败。');

    if (!Array.isArray(entity.components)) entity.components = [];
    if (Array.isArray(mergedProps.components)) {
      for (let index = 0; index < mergedProps.components.length; index += 1) {
        const component = mergedProps.components[index];
        const instance = instantiateComponent(component, mergedProps.componentOptions?.[index] || {});
        if (!instance) continue;
        if (typeof entity.addComponent === 'function') entity.addComponent(instance);
        else entity.components.push(instance);
      }
    }

    if (entity.sprite !== undefined || mergedProps.sprite !== undefined) entity.sprite = entity.sprite ?? mergedProps.sprite;
    if (entity.body !== undefined || mergedProps.body !== undefined) entity.body = entity.body ?? mergedProps.body;
    if (entity.storeKey !== undefined || mergedProps.storeKey !== undefined) entity.storeKey = entity.storeKey ?? mergedProps.storeKey;

    const typeLabel = `${normalizedType}${entity.name ? `(${entity.name})` : ''}`;
    const requiredEntityFields = pickRequiredFields(entity, type, mergedProps);
    for (const item of requiredEntityFields) {
      assertField({ owner: entity, ownerLabel: `实体[${typeLabel}]`, field: item.name, expectedType: item.expectedType });
    }

    for (let index = 0; index < entity.components.length; index += 1) {
      const component = entity.components[index];
      const componentLabel = `${component?.type || component?.name || component?.constructor?.name || `Component#${index}`}`;
      const componentRequired = resolveComponentRequirements(component);
      for (const item of componentRequired) {
        assertField({
          owner: component,
          ownerLabel: `组件[${componentLabel}]`,
          field: item.name,
          expectedType: item.expectedType
        });
      }
    }

    attachEntityErgonomics(entity, mergedProps);
    return entity;
  }
}

function attachEntityErgonomics(entity, props = {}) {
  const signals = new Map();
  if (typeof entity.on !== 'function') {
    entity.on = (name, listener) => {
      const listeners = signals.get(name) || new Set();
      listeners.add(listener);
      signals.set(name, listeners);
      return () => listeners.delete(listener);
    };
  }
  if (typeof entity.off !== 'function') {
    entity.off = (name, listener) => {
      const listeners = signals.get(name);
      if (!listeners) return;
      listeners.delete(listener);
      if (listeners.size === 0) signals.delete(name);
    };
  }
  if (typeof entity.emit !== 'function') {
    entity.emit = (name, ...args) => {
      for (const listener of signals.get(name) || []) listener(...args);
    };
  }
  if (typeof entity.connect !== 'function') {
    entity.connect = (name, target, targetEventOrHandler = name, options = {}) => {
      const handler = createEntitySignalHandler(target, targetEventOrHandler);
      let off = null;
      const wrapped = (...args) => {
        handler(...args);
        if (options.once) off?.();
      };
      off = entity.on(name, wrapped);
      return off;
    };
  }

  const { store } = props;
  const storeKey = entity.storeKey || props.storeKey;
  const syncStore = () => {
    if (!storeKey) return;
    store?.set?.(storeKey, serializeEntityForStore(entity));
  };
  const position = {};
  Object.defineProperties(position, {
    x: {
      enumerable: true,
      get: () => Number(entity.x || 0),
      set: (value) => {
        entity.x = Number(value || 0);
        syncStore();
      }
    },
    y: {
      enumerable: true,
      get: () => Number(entity.y || 0),
      set: (value) => {
        entity.y = Number(value || 0);
        syncStore();
      }
    }
  });
  Object.defineProperty(entity, 'position', {
    configurable: true,
    enumerable: true,
    value: position
  });
  syncStore();
}

function createEntitySignalHandler(target, targetEventOrHandler) {
  if (typeof target === 'function') return target;
  if (typeof targetEventOrHandler === 'function') {
    return (...args) => targetEventOrHandler.call(target, ...args);
  }
  const targetName = String(targetEventOrHandler || '');
  if (target && typeof target[targetName] === 'function') {
    return (...args) => target[targetName](...args);
  }
  if (target && typeof target.emit === 'function') {
    return (...args) => target.emit(targetName, ...args);
  }
  throw createOmniError('Entity', `connect 目标缺少处理函数或 emit：${targetName}。`);
}

function serializeEntityForStore(entity) {
  return {
    id: entity.id,
    name: entity.name,
    type: entity.type,
    x: Number(entity.x || 0),
    y: Number(entity.y || 0),
    scale: entity.scale,
    scaleX: entity.scaleX,
    scaleY: entity.scaleY,
    sprite: entity.sprite,
    texture: entity.texture
  };
}

const Entity = {
  create: EntityClass.create,
  createEntity: EntityClass.createEntity
};

export { Entity };
export default Entity;
