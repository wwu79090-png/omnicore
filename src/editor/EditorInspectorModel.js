export class EditorInspectorModel {
  constructor(source = {}, groups = []) {
    this.source = clone(source);
    this.groups = groups;
    this.fields = new Map();
    for (const groupEntry of groups) {
      for (const fieldEntry of groupEntry.fields || []) {
        this.fields.set(fieldEntry.key, fieldEntry);
        this.fields.set(`${groupEntry.id}.${fieldEntry.id}`, fieldEntry);
      }
    }
  }

  static fromEntity(entity = {}) {
    const groups = [
      group('identity', [
        field('id', 'id', entity.id, 'text'),
        field('name', 'name', entity.name, 'text'),
        field('type', 'type', entity.type, 'text')
      ]),
      group('transform', [
        field('x', 'x', entity.x ?? 0, 'number'),
        field('y', 'y', entity.y ?? 0, 'number'),
        field('z', 'z', entity.z ?? 0, 'number'),
        field('rotation', 'rotation', entity.rotation ?? 0, 'number'),
        field('scaleX', 'scaleX', entity.scaleX ?? 1, 'number'),
        field('scaleY', 'scaleY', entity.scaleY ?? 1, 'number')
      ]),
      group('render', [
        field('texture', 'texture', entity.texture, 'asset'),
        field('zIndex', 'zIndex', entity.zIndex ?? 0, 'number'),
        field('visible', 'visible', entity.visible !== false, 'boolean'),
        field('alpha', 'alpha', entity.alpha ?? 1, 'number')
      ]),
      group('props', Object.entries(entity.props || {}).map(([key, value]) => field(key, `props.${key}`, value, editorForValue(value)))),
      group('components', (entity.components || []).map((component, index) => field(
        component.type || component.name || `component-${index}`,
        `components.${index}`,
        clone(component),
        'component'
      )))
    ];
    return new EditorInspectorModel(entity, groups);
  }

  getField(key) {
    return this.fields.get(key) || null;
  }

  applyPatch(patch = {}) {
    const next = clone(this.source);
    for (const [key, value] of Object.entries(patch)) {
      const target = this.getField(key);
      setPath(next, target?.path || key, value);
    }
    return next;
  }
}

function group(id, fields) {
  return { id, fields: fields.filter((item) => item.value !== undefined) };
}

function field(id, path, value, editor) {
  return {
    id,
    key: path.includes('.') ? path : null,
    path,
    value,
    editor
  };
}

function editorForValue(value) {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  return 'text';
}

function setPath(target, path, value) {
  const parts = String(path || '').split('.').filter(Boolean);
  if (parts.length === 0) return;
  let cursor = target;
  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    if (cursor[part] == null || typeof cursor[part] !== 'object') cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default EditorInspectorModel;
