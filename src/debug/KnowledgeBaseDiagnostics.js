import patterns from '../../.knowledge-base/patterns.json';

const REFERENCE_PATTERN = /(?:[A-Za-z]:)?(?:[\w.-]+[\\/])*[\w.-]+\.(?:js|mjs|cjs|ts|tsx|jsx|json|c|h):\d+(?::\d+)?/;

const compiledPatterns = patterns.map((entry) => ({
  ...entry,
  matcher: compilePattern(entry)
}));

export class KnowledgeBaseDiagnostics {
  static count() {
    return compiledPatterns.length;
  }

  static analyze(error) {
    const message = error?.message || String(error || '');
    for (const entry of compiledPatterns) {
      if (!entry.matcher.test(message)) continue;
      entry.matcher.lastIndex = 0;
      return {
        title: entry.title,
        message: entry.trigger,
        intent: entry.intent,
        solution: entry.solution,
        example: entry.example,
        docs: entry.docs,
        severity: entry.severity || 'warn',
        knowledgeId: entry.id,
        reference: extractReference(message)
      };
    }
    return null;
  }
}

function compilePattern(entry) {
  try {
    return new RegExp(entry.pattern, entry.flags || 'i');
  } catch {
    return new RegExp(escapeRegExp(entry.pattern), 'i');
  }
}

function extractReference(message) {
  return message.match(REFERENCE_PATTERN)?.[0] || 'unknown';
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default KnowledgeBaseDiagnostics;
