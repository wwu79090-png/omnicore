#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const DEFAULT_EXTENSIONS = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.json']);

const ANALYSIS_RULES = [
  {
    id: 'phaser-scene-lifecycle',
    framework: 'phaser',
    risk: 'low',
    omnicoreTarget: 'OmniCore Scene',
    detects: [
      /extends\s+Phaser\.Scene/,
      /new\s+Phaser\.Game\s*\(/,
      /\bpreload\s*\([^)]*\)\s*{/,
      /\bcreate\s*\([^)]*\)\s*{/
    ],
    recommendation: 'Map preload/create/update into an OmniCore Scene; keep asset keys stable while replacing loader calls.'
  },
  {
    id: 'phaser-arcade-physics',
    framework: 'phaser',
    risk: 'medium',
    omnicoreTarget: 'loadPhysics() + PhysicsWorld',
    detects: [
      /this\.physics\.add\./,
      /this\.physics\.world/,
      /arcade\s*:/i,
      /physics\s*:\s*{[^}]*arcade/is
    ],
    recommendation: 'Audit Arcade collision and velocity behavior, then move physics setup behind loadPhysics() with focused gameplay tests.'
  },
  {
    id: 'phaser-loader-assets',
    framework: 'phaser',
    risk: 'low',
    omnicoreTarget: 'AssetLoader manifest',
    detects: [
      /this\.load\.(image|spritesheet|atlas|audio)\s*\(/,
      /\.load\.(image|spritesheet|atlas|audio)\s*\(/
    ],
    recommendation: 'Move Phaser preload calls into an OmniCore asset manifest and keep asset keys unchanged during the first migration pass.'
  },
  {
    id: 'phaser-display-factory',
    framework: 'phaser',
    risk: 'low',
    omnicoreTarget: 'Scene.add(new Sprite())',
    detects: [
      /this\.add\.(sprite|image|existing)\s*\(/,
      /\.add\.(sprite|image|existing)\s*\(/
    ],
    recommendation: 'Wrap Phaser display factory calls with createPhaserCompatScene, then replace them with explicit OmniCore Scene children.'
  },
  {
    id: 'phaser-input-keyboard',
    framework: 'phaser',
    risk: 'medium',
    omnicoreTarget: 'InputManager keyboard bindings',
    detects: [
      /this\.input\.keyboard\.(on|addKey)\s*\(/,
      /\.input\.keyboard\.(on|addKey)\s*\(/
    ],
    recommendation: 'Map keyboard events to OmniCore InputManager bindings and replay the same input sequence in migration tests.'
  },
  {
    id: 'phaser-tween-timeline',
    framework: 'phaser',
    risk: 'medium',
    omnicoreTarget: 'Tween / Timeline',
    detects: [
      /this\.tweens\.(add|timeline)\s*\(/,
      /\.tweens\.(add|timeline)\s*\(/
    ],
    recommendation: 'Convert Phaser tweens into OmniCore Tween or Timeline entries and keep duration/easing values visible in review.'
  },
  {
    id: 'construct-event-sheet',
    framework: 'construct',
    risk: 'low',
    omnicoreTarget: 'JSON Event Sheet + VisualEventGraph',
    detects: [
      /"eventSheets"\s*:/i,
      /"eventSheet"\s*:/i,
      /"conditions"\s*:\s*\[/i,
      /"actions"\s*:\s*\[/i,
      /Construct\s*3/i
    ],
    recommendation: 'Convert conditions and actions to OmniCore JSON Event Sheet entries, then inspect the result with VisualEventGraph.'
  },
  {
    id: 'cocos-component',
    framework: 'cocos',
    risk: 'medium',
    omnicoreTarget: 'addComponent() / addon component',
    detects: [
      /from\s+['"]cc['"]/,
      /extends\s+Component\b/,
      /@ccclass\s*\(/,
      /cc\.Component/
    ],
    recommendation: 'Rewrite Cocos lifecycle methods as explicit OmniCore components mounted on Scene entities.'
  },
  {
    id: 'cocos-prefab',
    framework: 'cocos',
    risk: 'medium',
    omnicoreTarget: 'Prefab / PrefabRegistry',
    detects: [
      /\bPrefab\b/,
      /@property\s*\(\s*Prefab\s*\)/,
      /\.prefab\b/i,
      /instantiate\s*\(/
    ],
    recommendation: 'Move prefab defaults into OmniCore PrefabRegistry and add tests for nested overrides before replacing editor assets.'
  }
];

export function migrateSource({ source, file = '', from = '1.x', to = '2.x' } = {}) {
  const changes = [];
  let output = source;
  output = replace(output, 'OmniCore.Backend.use(', 'OmniCore.Backend.switch(', 'Backend.use -> Backend.switch', changes, 'OmniCore.Backend.use');
  output = replace(output, 'game.scene.currentScene', 'game.store.get("currentScene")', 'scene.currentScene -> store currentScene', changes, 'game.scene.currentScene');
  output = replace(output, 'new OmniCore.Game(', 'OmniCore.createGame(', 'OmniCore.Game -> OmniCore.createGame', changes, 'OmniCore.Game');
  output = replace(output, 'OmniCore.Entity.create(', 'OmniCore.createEntity(', 'Entity.create -> createEntity', changes, 'OmniCore.Entity.create');
  output = replace(output, 'Entity.create(', 'Entity.createEntity(', 'Entity.create -> Entity.createEntity', changes, 'Entity.create');
  output = replace(output, 'Store.set(', 'Store.setValue(', 'Store.set -> Store.setValue', changes, 'Store.set');
  output = replace(output, '.store.set(', '.store.setValue(', 'Store#set -> Store#setValue', changes, 'Store#set');
  output = replace(output, 'store.set(', 'store.setValue(', 'Store#set -> Store#setValue', changes, 'Store#set');
  return { file, from, to, output, changes };
}

export function analyzeMigrationSource({ source = '', file = '' } = {}) {
  const findings = ANALYSIS_RULES
    .filter((rule) => rule.detects.some((pattern) => pattern.test(source) || pattern.test(file)))
    .map(({ id, framework, risk, omnicoreTarget, recommendation }) => ({
      id,
      framework,
      risk,
      omnicoreTarget,
      recommendation
    }));
  return {
    file,
    framework: inferFramework(findings),
    findings,
    risk: summarizeRisk(findings)
  };
}

export function migrateProject({
  root = process.cwd(),
  write = false,
  report = null,
  from = '1.x',
  to = '2.x',
  dryRun = false
} = {}) {
  const files = walkFiles(path.resolve(root));
  const scanned = files.map((file) => {
    const source = fs.readFileSync(file, 'utf8');
    const result = migrateSource({ source, file, from, to });
    const analysis = analyzeMigrationSource({ source, file });
    if (write && !dryRun && result.output !== source) fs.writeFileSync(file, result.output, 'utf8');
    return { ...result, analysis };
  });
  const results = scanned.filter((result) => result.changes.length > 0);
  const analyses = scanned
    .map((result) => result.analysis)
    .filter((analysis) => analysis.findings.length > 0);
  const summary = summarizeChanges(results);
  const analysisSummary = summarizeAnalysis(analyses);
  if (report) {
    fs.mkdirSync(path.dirname(path.resolve(report)), { recursive: true });
    fs.writeFileSync(report, renderMarkdownReport({
      root,
      from,
      to,
      results,
      summary,
      analyses,
      analysisSummary
    }), 'utf8');
  }
  return { root, from, to, files: results, summary, analyses, analysisSummary, dryRun };
}

function replace(source, needle, replacement, label, changes, api = needle) {
  if (!source.includes(needle)) return source;
  const count = source.split(needle).length - 1;
  changes.push({ api, label, from: needle, to: replacement, count });
  return source.split(needle).join(replacement);
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const stat = fs.statSync(root);
  if (stat.isFile()) return DEFAULT_EXTENSIONS.has(path.extname(root)) ? [root] : [];
  const output = [];
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue;
    output.push(...walkFiles(path.join(root, entry.name)));
  }
  return output;
}

function summarizeChanges(results) {
  const summary = new Map();
  for (const result of results) {
    for (const change of result.changes) {
      const current = summary.get(change.api) || { api: change.api, count: 0, replacement: change.to };
      current.count += change.count || 1;
      summary.set(change.api, current);
    }
  }
  return [...summary.values()];
}

function inferFramework(findings) {
  if (findings.length === 0) return 'unknown';
  const counts = new Map();
  for (const finding of findings) counts.set(finding.framework, (counts.get(finding.framework) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function summarizeRisk(findings) {
  if (findings.some((finding) => finding.risk === 'high')) return 'high';
  if (findings.some((finding) => finding.risk === 'medium')) return 'medium';
  if (findings.some((finding) => finding.risk === 'low')) return 'low';
  return 'none';
}

function summarizeAnalysis(analyses) {
  const frameworks = new Set();
  const risks = { low: 0, medium: 0, high: 0 };
  const findings = new Map();
  for (const analysis of analyses) {
    if (analysis.framework !== 'unknown') frameworks.add(analysis.framework);
    for (const finding of analysis.findings) {
      risks[finding.risk] = (risks[finding.risk] || 0) + 1;
      const current = findings.get(finding.id) || {
        id: finding.id,
        framework: finding.framework,
        risk: finding.risk,
        omnicoreTarget: finding.omnicoreTarget,
        count: 0
      };
      current.count += 1;
      findings.set(finding.id, current);
    }
  }
  return {
    frameworks: [...frameworks].sort(),
    risks,
    findings: [...findings.values()].sort((a, b) => a.id.localeCompare(b.id))
  };
}

function renderMarkdownReport({ root, from, to, results, summary, analyses = [], analysisSummary = summarizeAnalysis([]) }) {
  const rows = summary.length
    ? summary.map((item) => `| \`${item.api}\` | ${item.count} | \`${item.replacement}\` |`).join('\n')
    : '| 无 | 0 | 无 |';
  const files = results.length
    ? results.map((item) => `- ${path.relative(root, item.file) || item.file}: ${item.changes.length} rule(s)`).join('\n')
    : '- No files changed';
  const analysisRows = analysisSummary.findings.length
    ? analysisSummary.findings
      .map((item) => `| \`${item.id}\` | ${item.framework} | ${item.risk} | \`${item.omnicoreTarget}\` | ${item.count} |`)
      .join('\n')
    : '| 无 | unknown | none | 无 | 0 |';
  const analysisFiles = analyses.length
    ? analyses.map((item) => `- ${path.relative(root, item.file) || item.file}: ${item.framework}, ${item.risk}`).join('\n')
    : '- No cross-engine migration findings';
  return [
    '# OmniCore Migration Report',
    '',
    `From: ${from}`,
    `To: ${to}`,
    '',
    '| Deprecated API | Count | Replacement |',
    '| --- | ---: | --- |',
    rows,
    '',
    '## Files',
    '',
    files,
    '',
    '## Cross-Engine Analysis',
    '',
    `Frameworks: ${analysisSummary.frameworks.join(', ') || 'none'}`,
    '',
    '| Finding | Framework | Risk | OmniCore Target | Files |',
    '| --- | --- | --- | --- | ---: |',
    analysisRows,
    '',
    '## Analysis Files',
    '',
    analysisFiles,
    ''
  ].join('\n');
}

function renderDryRunReport(result) {
  const lines = [
    'OmniCore Migration Dry Run',
    `Root: ${result.root}`,
    `API rewrite files: ${result.files.length}`,
    `Detected frameworks: ${result.analysisSummary.frameworks.join(', ') || 'none'}`,
    ''
  ];
  if (result.analysisSummary.findings.length === 0) {
    lines.push('No Phaser, Construct, or Cocos migration findings detected.');
  } else {
    lines.push('Findings:');
    for (const finding of result.analysisSummary.findings) {
      lines.push(`- ${finding.id} [${finding.framework}/${finding.risk}] -> ${finding.omnicoreTarget} (${finding.count} file(s))`);
    }
  }
  return `${lines.join('\n')}\n`;
}

function parseArgs(argv) {
  const options = { root: process.cwd(), write: false, report: null, dryRun: false, format: 'json' };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--root') {
      index += 1;
      options.root = argv[index];
    } else if (arg === '--write') {
      options.write = true;
    } else if (arg === '--dry-run') {
      options.dryRun = true;
      options.write = false;
      options.format = 'text';
    } else if (arg === '--json') {
      options.format = 'json';
    } else if (arg === '--report') {
      index += 1;
      options.report = argv[index];
    } else if (arg === '--from') {
      index += 1;
      options.from = argv[index];
    } else if (arg === '--to') {
      index += 1;
      options.to = argv[index];
    }
  }
  return options;
}

function isCli() {
  return process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
}

if (isCli()) {
  const options = parseArgs(process.argv.slice(2));
  const result = migrateProject(options);
  if (options.format === 'text') {
    console.log(renderDryRunReport(result));
  } else {
    console.log(JSON.stringify({
      files: result.files.length,
      changes: result.summary.reduce((total, item) => total + item.count, 0),
      summary: result.summary,
      analysis: result.analysisSummary
    }, null, 2));
  }
}

export default migrateSource;
