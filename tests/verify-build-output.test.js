import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isPathInsideDirectory } from '../scripts/verify-build-output.js';

describe('verify build output path guards', () => {
  it('accepts files inside a Windows directory when separators differ', () => {
    const distDir = 'C:/Users/39120/AppData/Local/Temp/omnicore-build';
    const file = path.win32.join('C:\\Users\\39120\\AppData\\Local\\Temp\\omnicore-build', 'omnicore-core.js');

    expect(isPathInsideDirectory(file, distDir)).toBe(true);
  });

  it('rejects files outside the requested build directory', () => {
    const distDir = 'C:/Users/39120/AppData/Local/Temp/omnicore-build';
    const file = path.win32.join('C:\\Users\\39120\\AppData\\Local\\Temp\\omnicore-build-other', 'omnicore-core.js');

    expect(isPathInsideDirectory(file, distDir)).toBe(false);
  });
});
