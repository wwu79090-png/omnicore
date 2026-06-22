import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildEngineCapabilityAtlas,
  ENGINE_CAPABILITY_CATEGORIES,
  ENGINE_FAMILY_SOURCES,
  renderEngineCapabilityMarkdown
} from '../src/index.js';

describe('engine capability atlas', () => {
  let temp = null;

  afterEach(() => {
    if (temp) rmSync(temp, { recursive: true, force: true });
    temp = null;
  });

  it('tracks broad feature families from major engines instead of isolated one-off ideas', () => {
    const atlas = buildEngineCapabilityAtlas({
      generatedAt: '2026-06-22T00:00:00.000+08:00'
    });

    expect(Object.keys(ENGINE_FAMILY_SOURCES)).toEqual(expect.arrayContaining([
      'unreal',
      'unity',
      'godot',
      'gamemaker',
      'rpgMaker',
      'renpy',
      'phaser',
      'defold',
      'bevy',
      'monogame',
      'libgdx',
      'cocosCreator'
    ]));
    expect(ENGINE_CAPABILITY_CATEGORIES.length).toBeGreaterThanOrEqual(24);
    expect(atlas.summary).toMatchObject({
      engineFamilyCount: expect.any(Number),
      categoryCount: expect.any(Number),
      coveredCategoryCount: expect.any(Number),
      coverageScore: expect.any(Number)
    });
    expect(atlas.summary.engineFamilyCount).toBeGreaterThanOrEqual(12);
    expect(atlas.summary.categoryCount).toBeGreaterThanOrEqual(24);
    expect(atlas.summary.coverageScore).toBeGreaterThanOrEqual(90);
    expect(atlas.gaps.filter((gap) => gap.priority === 'P0')).toEqual([]);
  });

  it('records evidence for rendering, editor, assets, networking, gameplay, low-code, and platform coverage', () => {
    const atlas = buildEngineCapabilityAtlas();
    const categories = Object.fromEntries(atlas.categories.map((category) => [category.id, category]));

    for (const id of [
      'rendering-pipeline',
      'editor-authoring',
      'asset-pipeline',
      'netcode',
      'gameplay-framework',
      'visual-scripting',
      'platform-export'
    ]) {
      expect(categories[id]).toMatchObject({
        status: 'covered',
        evidenceStatus: {
          presentCount: expect.any(Number),
          missing: []
        }
      });
      expect(categories[id].inspiredBy.length).toBeGreaterThanOrEqual(2);
      expect(categories[id].evidence.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('renders a markdown capability map and exposes a repeatable CLI report', () => {
    temp = mkdtempSync(path.join(tmpdir(), 'omnicore-capability-atlas-'));
    const out = path.join(temp, 'engine-capability-atlas.json');
    const markdown = path.join(temp, 'engine-capability-atlas.md');

    execFileSync(process.execPath, [
      'scripts/engine-capability-atlas.js',
      '--generated-at', '2026-06-22T00:00:00.000+08:00',
      '--out', out,
      '--markdown', markdown
    ], { cwd: process.cwd(), encoding: 'utf8' });

    const report = JSON.parse(readFileSync(out, 'utf8'));
    const doc = readFileSync(markdown, 'utf8');

    expect(existsSync(out)).toBe(true);
    expect(existsSync(markdown)).toBe(true);
    expect(report.summary.coverageScore).toBeGreaterThanOrEqual(90);
    expect(doc).toContain('# OmniCore Engine Capability Atlas');
    expect(doc).toContain('Unreal');
    expect(doc).toContain('Unity');
    expect(doc).toContain('Godot');
    expect(doc).toContain('Visual scripting');
    expect(renderEngineCapabilityMarkdown(report)).toContain('Coverage score');
  });
});
