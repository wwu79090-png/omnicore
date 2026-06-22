import { createOmniError } from './OmniError.js';

export class ModuleGemManifest {
  constructor({ modules = [] } = {}) {
    this.modules = modules.map(normalizeModule);
  }

  validate() {
    const ids = new Set(this.modules.map((module) => module.id));
    const errors = [];
    for (const module of this.modules) {
      for (const dependency of module.dependsOn) {
        if (!ids.has(dependency)) {
          errors.push({
            code: 'missing-dependency',
            module: module.id,
            dependency,
            message: `Module ${module.id} depends on missing module ${dependency}.`
          });
        }
      }
    }
    return {
      ok: errors.length === 0,
      modules: this.modules.map((module) => module.id).sort(),
      errors
    };
  }

  activationOrder() {
    const report = this.validate();
    if (!report.ok) throw createOmniError('ModuleGemManifest', report.errors.map((error) => error.message).join('\n'));
    const modules = new Map(this.modules.map((module) => [module.id, module]));
    const visited = new Set();
    const visiting = new Set();
    const order = [];
    for (const module of this.modules) visit(module.id, modules, visited, visiting, order);
    return order;
  }

  manifest() {
    return {
      modules: this.modules.map(clone).sort((left, right) => left.id.localeCompare(right.id))
    };
  }
}

function visit(id, modules, visited, visiting, order) {
  if (visited.has(id)) return;
  if (visiting.has(id)) throw createOmniError('ModuleGemManifest', `Module dependency cycle includes ${id}.`);
  visiting.add(id);
  const module = modules.get(id);
  for (const dependency of module.dependsOn) visit(dependency, modules, visited, visiting, order);
  visiting.delete(id);
  visited.add(id);
  order.push(id);
}

function normalizeModule(module = {}) {
  return {
    id: String(module.id || module.name || 'module'),
    version: String(module.version || '0.0.0'),
    dependsOn: normalizeArray(module.dependsOn || module.dependencies).map(String).sort(),
    permissions: normalizeArray(module.permissions).map(String).sort(),
    entry: module.entry || null
  };
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
}

function clone(value) {
  return JSON.parse(JSON.stringify(value ?? null));
}

export default ModuleGemManifest;
