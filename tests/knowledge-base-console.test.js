import { describe, expect, it } from 'vitest';
import ErrorDiagnostics from '../src/debug/ErrorDiagnostics.js';
import KnowledgeBaseDiagnostics from '../src/debug/KnowledgeBaseDiagnostics.js';

describe('knowledge-base runtime diagnostics', () => {
  it('ships at least 100 open knowledge patterns', () => {
    expect(KnowledgeBaseDiagnostics.count()).toBeGreaterThanOrEqual(100);
  });

  it('matches known error patterns with solution and line reference hints', () => {
    const diagnostic = ErrorDiagnostics.analyze('Store set type mismatch at src/game.js:12');

    expect(diagnostic.title).toContain('Store');
    expect(diagnostic.solution).toContain('保持状态类型稳定');
    expect(diagnostic.reference).toContain('src/game.js:12');
    expect(diagnostic.intent).toContain('状态');
  });
});
