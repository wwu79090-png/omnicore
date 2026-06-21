#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { create3DAssetReport, MODEL_COMPLEXITY_WARNING } from './check-3d-assets.js';

export function parseBuildArgs(argv = []) {
  const options = {
    check3d: false,
    dryRun: false,
    root: process.cwd(),
    viteArgs: []
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--check-3d') options.check3d = true;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--root') {
      index += 1;
      options.root = path.resolve(argv[index]);
    } else {
      options.viteArgs.push(arg);
    }
  }
  return options;
}

export function runBuild(argv = process.argv.slice(2)) {
  const options = parseBuildArgs(argv);
  if (options.check3d) {
    const report = create3DAssetReport({ root: options.root });
    if (!report.ok) {
      for (const violation of report.violations) {
        process.stderr.write(`${MODEL_COMPLEXITY_WARNING} ${violation.file} ${violation.type}=${violation.value} limit=${violation.limit}\n`);
      }
      throw new Error(`${MODEL_COMPLEXITY_WARNING} ${report.violations.length} violation(s)`);
    }
  }
  if (options.dryRun) {
    const result = { ok: true, dryRun: true, check3d: options.check3d };
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return result;
  }
  const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js');
  const result = spawnSync(process.execPath, [viteBin, 'build', ...options.viteArgs], {
    cwd: options.root,
    stdio: 'inherit',
    windowsHide: true
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
  if (result.status === 0) generateTypeDeclarations(options.root);
  return { ok: result.status === 0, status: result.status };
}

export function generateTypeDeclarations(root = process.cwd()) {
  const distDir = path.resolve(root, 'dist');
  mkdirSync(distDir, { recursive: true });
  writeFileSync(path.join(distDir, 'omnicore.d.ts'), createTypeDeclarationSource(), 'utf8');
  writeFileSync(path.join(distDir, 'omnicore-core.d.ts'), createTypeDeclarationSource(), 'utf8');
}

export function createTypeDeclarationSource() {
  return `export type HookHandler<T = unknown> = (payload: T, context?: Record<string, unknown>) => unknown;

export class Hook {
  on<T = unknown>(name: string, handler: HookHandler<T>): () => boolean;
  once<T = unknown>(name: string, handler: HookHandler<T>): () => boolean;
  off<T = unknown>(name: string, handler: HookHandler<T>): boolean;
  emit<T = unknown>(name: string, payload?: T, context?: Record<string, unknown>): unknown[];
  emitAsync<T = unknown>(name: string, payload?: T, context?: Record<string, unknown>): Promise<unknown[]>;
  clear(name?: string | null): void;
}

export interface OmniPlugin {
  name: string;
  version?: string;
  install(api: typeof OmniCore, options?: Record<string, unknown>): unknown | Promise<unknown>;
  uninstall?(api: typeof OmniCore, options?: Record<string, unknown>): unknown | Promise<unknown>;
}

export interface PluginRegistry {
  create(plugin: OmniPlugin): Readonly<OmniPlugin>;
  register(plugin: OmniPlugin): OmniPlugin;
  use(pluginOrName: OmniPlugin | string, api: typeof OmniCore, options?: Record<string, unknown>): Promise<OmniPlugin>;
  unuse(name: string, api: typeof OmniCore, options?: Record<string, unknown>): Promise<OmniPlugin | null>;
  has(name: string): boolean;
  get(name: string): OmniPlugin | null;
  list(): OmniPlugin[];
}

export const Plugin: PluginRegistry & {
  isPlugin(plugin: unknown): plugin is OmniPlugin;
};

export interface CrashReport {
  id: string;
  timestamp: string;
  error: { name: string; message: string; stack: string };
  context: Record<string, unknown>;
  runtime: Record<string, unknown>;
  game: Record<string, unknown>;
  scene: Record<string, unknown>;
  store: Record<string, unknown>;
  metrics: Record<string, unknown>;
}

export class CrashHandler {
  constructor(options?: {
    game?: unknown;
    store?: unknown;
    scene?: unknown;
    metrics?: unknown;
    onReport?: (report: CrashReport) => void;
    autoInstall?: boolean;
    target?: EventTarget;
  });
  install(target?: EventTarget): this;
  uninstall(): this;
  capture(error: unknown, context?: Record<string, unknown>): CrashReport;
  captureReproduction(error: unknown, context?: Record<string, unknown>, options?: Record<string, unknown>): Record<string, unknown>;
  createReproductionBundle(report?: CrashReport, options?: Record<string, unknown>): Record<string, unknown>;
  latest(): CrashReport | null;
  latestReproduction(): Record<string, unknown> | null;
}

export class Game {
  constructor(config?: Record<string, unknown>);
  init(): Promise<this>;
  pool: { get(type: string): unknown; release(item: unknown): void };
}

export class Scene {
  constructor(name?: string);
}

export interface DependencyBuckets {
  audio: string[];
  data: string[];
  fonts: string[];
  images: string[];
  models: string[];
  prefabs: string[];
}

export class SceneDocument {
  constructor(document?: Record<string, unknown>);
  validate(): { ok: boolean; errors: unknown[]; warnings: unknown[] };
  dependencies(): DependencyBuckets;
  toJSON(): Record<string, unknown>;
}

export function normalizeSceneDocument(document?: Record<string, unknown>): Record<string, unknown>;
export function validateSceneDocument(document?: Record<string, unknown>): { ok: boolean; errors: unknown[]; warnings: unknown[] };
export function collectSceneDependencies(document?: Record<string, unknown>): DependencyBuckets;
export function assertValidSceneDocument(document?: Record<string, unknown>): Record<string, unknown>;

export class Sprite {
  constructor(texture?: string, options?: Record<string, unknown>);
  slice(top: number, bottom: number, left: number, right: number): this;
  setTint(color: string | number): this;
  clearTint(): this;
  setMask(mask: unknown): this;
  setCrop(x: number, y: number, width: number, height: number): this;
}

export class Container {
  constructor(options?: Record<string, unknown>);
  addChild(child: unknown): unknown;
  add(child: unknown): unknown;
  removeChild(childOrName: unknown): unknown;
  getWorldPosition(): { x: number; y: number };
  getWorldRotation(): number;
}

export class TileSprite extends Sprite {
  constructor(texture?: string, options?: Record<string, unknown>);
}

export class Graphics {
  constructor(options?: Record<string, unknown>);
  line(x1: number, y1: number, x2: number, y2: number): this;
  triangle(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number): this;
  ring(x: number, y: number, outerRadius: number, innerRadius?: number, startAngle?: number, endAngle?: number, anticlockwise?: boolean): this;
  arc(x: number, y: number, radius: number, startAngle?: number, endAngle?: number, anticlockwise?: boolean): this;
  ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation?: number, startAngle?: number, endAngle?: number, anticlockwise?: boolean): this;
  polygon(points?: Array<{ x: number; y: number }>): this;
  bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): this;
  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): this;
  gradient(type: 'linear' | 'radial' | 'conic' | string, bounds: Record<string, number>, colorStops: unknown[]): this;
  beginMask(): this;
  endMask(): this;
  clip(rect: { x: number; y: number; width: number; height: number }): this;
  bounds(): { x: number; y: number; width: number; height: number };
  containsPoint(x: number, y: number): boolean;
  intersects(target: unknown): boolean;
}

export class Tween {
  static to(target: unknown, config?: Record<string, unknown>): Tween;
  static fromTo(target: unknown, from?: Record<string, number>, to?: Record<string, number>, config?: Record<string, unknown>): Tween;
  constructor(target: unknown, config?: Record<string, unknown>);
  play(): this;
  start(): this;
  pause(): this;
  resume(): this;
  restart(): this;
  stop(): this;
  onUpdate(handler: (tween: this) => void): this;
  onComplete(handler: (tween: this) => void): this;
  update(deltaMs: number): this;
}

export class PrefabManager {
  static instantiate(json: Record<string, unknown>, x?: number, y?: number, registry?: Record<string, unknown>, overrides?: Record<string, unknown>): unknown;
  static validate(json: Record<string, unknown>): { ok: boolean; errors: unknown[]; warnings: unknown[] };
  static collectDependencies(json: Record<string, unknown>): DependencyBuckets;
}

export class AssetPipelineGate {
  constructor(options?: Record<string, unknown>);
  run(overrides?: Record<string, unknown>): Record<string, unknown>;
  assert(): Record<string, unknown>;
}

export function createAssetPipelineReport(options?: Record<string, unknown>): Record<string, unknown>;
export function createDeterministicRenderQueue(nodes?: unknown[], options?: { layerOrder?: string[] }): Array<Record<string, unknown>>;
export function snapshotRenderQueue(queue?: unknown[]): Record<string, unknown>;
export function compareRenderSnapshots(left: unknown, right: unknown): { ok: boolean; firstMismatch: unknown };

export class RuntimeSoakHarness {
  constructor(options?: Record<string, unknown>);
  run(): Record<string, unknown>;
}

export function createRuntimeSoakReport(options?: Record<string, unknown>): Record<string, unknown>;
export function createReproductionBundle(options?: Record<string, unknown>): Record<string, unknown>;

export class Store {
  static set(key: string, value: unknown): unknown;
}

export class Entity {
  static create(options?: Record<string, unknown>): Entity;
}

export interface OmniCoreNamespace {
  Game: typeof Game;
  Scene: typeof Scene;
  SceneDocument: typeof SceneDocument;
  Sprite: typeof Sprite;
  Container: typeof Container;
  TileSprite: typeof TileSprite;
  Graphics: typeof Graphics;
  Tween: typeof Tween;
  PrefabManager: typeof PrefabManager;
  AssetPipelineGate: typeof AssetPipelineGate;
  RuntimeSoakHarness: typeof RuntimeSoakHarness;
  Store: typeof Store;
  Entity: typeof Entity;
  Hook: Hook;
  HookClass: typeof Hook;
  Plugin: typeof Plugin;
  CrashHandler: typeof CrashHandler;
  [key: string]: unknown;
}

declare const OmniCore: OmniCoreNamespace;
export default OmniCore;
export { OmniCore };
`;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  try {
    const result = runBuild();
    if (result.ok === false) process.exitCode = result.status || 1;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  }
}
