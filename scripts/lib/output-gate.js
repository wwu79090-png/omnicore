const DEFAULT_RISK_PATTERNS = [
  { keyword: 'DeprecationWarning', pattern: /\bDeprecationWarning\b/i, level: 'warning' },
  { keyword: 'UnhandledPromiseRejection', pattern: /\bUnhandledPromiseRejection\b/i, level: 'error' },
  { keyword: 'unhandled rejection', pattern: /\bunhandled\s+rejection\b/i, level: 'error' },
  { keyword: 'warning', pattern: /\bwarn(?:ing)?\b/i, level: 'warning' },
  { keyword: 'error', pattern: /\berror\b/i, level: 'error' },
  { keyword: 'failed', pattern: /\bfailed\b/i, level: 'error' }
];

const BENIGN_PATTERNS = [
  /packages are looking for funding/i,
  /run `?npm fund`?/i,
  /found 0 vulnerabilities/i,
  /audited \d+ packages/i,
  /up to date/i,
  /^$/i
];

export function detectOutputRisks({ stdout = '', stderr = '' } = {}) {
  return [
    ...scanStream('stdout', stdout),
    ...scanStream('stderr', stderr)
  ];
}

export function createNoWarningSummary(results = []) {
  const riskyCommands = results
    .filter((result) => Array.isArray(result.outputRisks) && result.outputRisks.length > 0)
    .map((result) => ({
      name: result.name,
      risks: result.outputRisks.length
    }));
  return {
    ok: riskyCommands.length === 0,
    commands: results.length,
    riskCount: riskyCommands.reduce((total, item) => total + item.risks, 0),
    riskyCommands
  };
}

function scanStream(stream, text) {
  return String(text || '')
    .split(/\r?\n/)
    .flatMap((line, index) => scanLine({ stream, line, lineNumber: index + 1 }));
}

function scanLine({ stream, line, lineNumber }) {
  const trimmed = line.trim();
  if (BENIGN_PATTERNS.some((pattern) => pattern.test(trimmed))) return [];
  return DEFAULT_RISK_PATTERNS
    .filter((definition) => definition.pattern.test(trimmed))
    .map((definition) => ({
      level: definition.level,
      stream,
      keyword: matchKeyword(trimmed, definition),
      line: trimmed,
      lineNumber
    }));
}

function matchKeyword(line, definition) {
  const match = line.match(definition.pattern);
  return match?.[0] || definition.keyword;
}
