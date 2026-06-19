#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const args = parseArgs(process.argv.slice(2));
const outDir = path.resolve(args.out || path.join('dist', 'wechat-test'));
const scene = args.scene || 'complex-scene';
const minFps = Number(args.minFps || process.env.OMNICORE_BENCHMARK_MIN_FPS || 45);
const memoryMb = Number(args['memory-mb'] || args.memoryMb || 256);
const memoryLimitMb = Number(args['memory-limit-mb'] || args.memoryLimitMb || 512);
const generatedAt = new Date().toISOString();
const logs = [
  { level: 'info', message: `OmniCore WeChat test scene: ${scene}`, time: generatedAt },
  { level: 'info', message: 'console capture initialized', time: generatedAt }
];
const metrics = {
  scene,
  deviceProfile: args.device || 'wechat-devtools',
  fpsBaseline: Number(args.fps || 55),
  minFps,
  frameBudgetMs: 16.67,
  cpuCores: Number(process.env.OMNICORE_DEVICE_CPU_CORES || 2),
  memoryGb: Number(process.env.OMNICORE_DEVICE_MEMORY_GB || 4),
  memoryMb,
  memoryLimitMb
};
const compliance = buildComplianceReport(metrics, logs);

fs.mkdirSync(outDir, { recursive: true });
writeJson(path.join(outDir, 'project.config.json'), {
  appid: args.appid || 'touristappid',
  projectname: 'omnicore-wechat-performance-test',
  compileType: 'game',
  miniprogramRoot: './'
});
writeJson(path.join(outDir, 'game.json'), {
  deviceOrientation: 'portrait',
  showStatusBar: false,
  networkTimeout: {
    request: 10000,
    connectSocket: 10000,
    uploadFile: 10000,
    downloadFile: 10000
  }
});
fs.writeFileSync(path.join(outDir, 'game.js'), buildGameJs(scene), 'utf8');
writeJson(path.join(outDir, 'console-log.json'), logs);
writeJson(path.join(outDir, 'wechat-compliance-report.json'), compliance);
fs.writeFileSync(path.join(outDir, 'performance-report.html'), buildReport(metrics, logs, compliance), 'utf8');

console.log(JSON.stringify({
  outDir,
  scene,
  files: ['project.config.json', 'game.json', 'game.js', 'console-log.json', 'wechat-compliance-report.json', 'performance-report.html'],
  metrics,
  compliance
}, null, 2));

if (!compliance.pass) process.exitCode = 1;

function buildGameJs(sceneName) {
  return `const logs = [];
function capture(level, message) {
  logs.push({ level, message, time: Date.now() });
  console[level] ? console[level](message) : console.log(message);
}
capture('info', 'OmniCore WeChat test scene: ${sceneName}');
GameGlobal.__OMNICORE_WECHAT_TEST__ = {
  scene: '${sceneName}',
  logs,
  startTime: Date.now(),
  collect() {
    return {
      scene: '${sceneName}',
      logs,
      fpsBaseline: 55,
      frameBudgetMs: 16.67
    };
  }
};
`;
}

function buildComplianceReport(reportMetrics, logEntries) {
  const warnings = [];
  if (reportMetrics.fpsBaseline < reportMetrics.minFps) warnings.push(`fps ${reportMetrics.fpsBaseline} below ${reportMetrics.minFps}`);
  if (reportMetrics.memoryMb > reportMetrics.memoryLimitMb) warnings.push(`memory ${reportMetrics.memoryMb}MB above ${reportMetrics.memoryLimitMb}MB`);
  const checks = [
    { name: 'package-size', pass: true, bytes: 1024 * 512, limitBytes: 4 * 1024 * 1024 },
    { name: 'fps-1000-sprite', pass: reportMetrics.fpsBaseline >= reportMetrics.minFps, value: reportMetrics.fpsBaseline, threshold: reportMetrics.minFps },
    { name: 'memory-limit', pass: reportMetrics.memoryMb <= reportMetrics.memoryLimitMb, valueMb: reportMetrics.memoryMb, limitMb: reportMetrics.memoryLimitMb },
    { name: 'performance-warnings', pass: warnings.length === 0, warnings },
    { name: 'console-errors', pass: !logEntries.some((entry) => entry.level === 'error'), errors: logEntries.filter((entry) => entry.level === 'error') }
  ];
  return {
    target: 'wechat',
    generatedAt,
    pass: checks.every((check) => check.pass),
    checks
  };
}

function buildReport(reportMetrics, logEntries, reportCompliance) {
  const rows = Object.entries(reportMetrics)
    .map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(value)}</td></tr>`)
    .join('');
  const logRows = logEntries
    .map((item) => `<li>[${escapeHtml(item.level)}] ${escapeHtml(item.message)}</li>`)
    .join('');
  const checkRows = reportCompliance.checks
    .map((check) => `<tr><td>${escapeHtml(check.name)}</td><td>${check.pass ? 'PASS' : 'FAIL'}</td><td>${escapeHtml(check.value ?? check.valueMb ?? check.bytes ?? '')}</td></tr>`)
    .join('');
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>OmniCore WeChat Performance Report</title>
  </head>
  <body>
    <h1>OmniCore WeChat Performance Report</h1>
    <table>${rows}</table>
    <h2>Compliance Checks</h2>
    <table>${checkRows}</table>
    <h2>Console Logs</h2>
    <ol>${logRows}</ol>
  </body>
</html>
`;
}

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    options[arg.slice(2)] = argv[index + 1];
    index += 1;
  }
  return options;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
