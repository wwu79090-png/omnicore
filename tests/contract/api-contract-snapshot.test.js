import path from 'node:path';
import { describe, expect, it } from 'vitest';
import OmniCore from '../../src/index.js';
import {
  buildApiContract,
  diffContracts,
  loadGoldenContract
} from '../../scripts/contract/snapshot-api-contract.js';

const goldenPath = path.resolve('tests/contract/golden/omnicore-core-api.json');

describe('OmniCore golden API contract snapshots', () => {
  it('keeps OmniCore.Game, Store, and Renderer public API shape stable', () => {
    const actual = buildApiContract(OmniCore);
    const expected = loadGoldenContract(goldenPath);
    const diff = diffContracts(actual, expected);

    expect(diff).toEqual([]);
    expect(actual).toEqual(expected);
  });
});
