#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [kind, rawName] = process.argv.slice(2);
const name = normalizeName(rawName);

if (!['scene', 'component'].includes(kind) || !name) {
  console.error('Usage: npm run make scene <Name> | npm run make component <Name>');
  process.exit(1);
}

const targetDir = kind === 'scene' ? 'src/scenes' : 'src/components';
const file = path.resolve(process.cwd(), targetDir, `${name}.js`);
if (existsSync(file)) {
  console.error(`[OmniCore] ${kind} already exists: ${file}`);
  process.exit(1);
}

mkdirSync(path.dirname(file), { recursive: true });
writeFileSync(file, kind === 'scene' ? sceneTemplate(name) : componentTemplate(name), 'utf8');
console.log(`[OmniCore] created ${kind}: ${file}`);

function normalizeName(value = '') {
  return String(value)
    .replace(/[^a-zA-Z0-9_$]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function sceneTemplate(className) {
  return `/**
 * ${className} scene.
 */
export default class ${className} {
  constructor(options = {}) {
    this.options = options;
    this.children = [];
  }

  mount(context) {
    this.context = context;
  }

  update(delta, time) {
    for (const child of this.children) child.update?.(delta, time);
  }

  unmount(context) {
    this.children.length = 0;
    this.context = null;
  }
}
`;
}

function componentTemplate(className) {
  return `/**
 * ${className} component.
 */
export default class ${className} {
  constructor(entity, options = {}) {
    this.entity = entity;
    this.options = options;
  }

  mount(context) {
    this.context = context;
  }

  update(delta, time) {}

  unmount(context) {
    this.context = null;
  }
}
`;
}
