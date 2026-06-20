#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import OmniCore, {
  assertNoBreakingApiChanges,
  buildApiSurface
} from '../src/index.js';

const ROOT = process.cwd();
const BASELINE_PATH = path.join(ROOT, 'docs', 'api', 'api-surface.json');
const REPORT_PATH = path.join(ROOT, 'docs', 'release-notes', 'api-surface-audit.md');

async function readJson(file) {
  return JSON.parse(await readFile(file, 'utf8'));
}

async function main() {
  const baseline = await readJson(BASELINE_PATH);
  const actual = buildApiSurface(OmniCore, baseline.tiers);
  const migrationNote = process.env.OMNICORE_API_MIGRATION_NOTE || '';
  const diff = assertNoBreakingApiChanges(baseline, actual, { migrationNote });
  await mkdir(path.dirname(REPORT_PATH), { recursive: true });
  await writeFile(REPORT_PATH, renderReport(diff, actual), 'utf8');
  console.log('API surface audit passed');
}

function renderReport(diff, actual) {
  return [
    '# API Surface Audit',
    '',
    'Generated: 2026-06-20T00:00:00.000Z',
    '',
    `Public exports: ${actual.tiers.public.length}`,
    `Experimental exports: ${actual.tiers.experimental.length}`,
    `Internal exports: ${actual.tiers.internal.length}`,
    '',
    '## Diff',
    '',
    `Removed public exports: ${diff.removedPublic.join(', ') || 'none'}`,
    `Added public exports: ${diff.addedPublic.join(', ') || 'none'}`,
    `Tier changes: ${diff.tierChanges.length || 0}`,
    ''
  ].join('\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
