#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

async function main() {
  const repo = arg('--repo');
  const out = path.resolve(ROOT, arg('--out', '.knowledge-base/patterns.json'));
  const limit = Number(arg('--limit', '100')) || 100;
  if (!repo) throw new Error('Usage: node scripts/extract-knowledge-from-issues.js --repo owner/name [--limit 100]');

  const issues = loadIssues(repo, limit);
  const existing = JSON.parse(await readFile(out, 'utf8'));
  const extracted = issues.map((issue, index) => summarizeIssue(issue, repo, index + 1));
  const merged = dedupeById([...extracted, ...existing]);
  await writeFile(out, `${JSON.stringify(merged.slice(0, Math.max(100, merged.length)), null, 2)}\n`);
  console.log(JSON.stringify({ repo, issues: issues.length, output: path.relative(ROOT, out).replace(/\\/g, '/') }));
}

function loadIssues(repo, limit) {
  const result = spawnSync('gh', [
    'issue',
    'list',
    '--repo',
    repo,
    '--state',
    'closed',
    '--limit',
    String(limit),
    '--json',
    'number,title,body,labels'
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`GitHub Issue extraction failed. Configure gh auth and pass --repo owner/name.\n${result.stderr}`);
  }
  return JSON.parse(result.stdout || '[]');
}

function summarizeIssue(issue, repo, ordinal) {
  const text = `${issue.title || ''}\n${issue.body || ''}`;
  const keyword = inferKeyword(text);
  return {
    id: `issue-${issue.number || ordinal}`,
    title: (issue.title || `Resolved Issue ${issue.number || ordinal}`).slice(0, 80),
    pattern: keyword.pattern,
    flags: 'i',
    trigger: keyword.trigger,
    intent: '从已解决 GitHub Issue 中提取可运行时识别的常见错误模式。',
    solution: keyword.solution,
    example: keyword.example,
    docs: issue.number ? `https://github.com/${repo}/issues/${issue.number}` : 'docs/DX.md#knowledge-base',
    severity: keyword.severity,
    source: { type: 'github-issue', issue: String(issue.number || ordinal), repo }
  };
}

function inferKeyword(text) {
  if (/store|state|type/i.test(text)) {
    return {
      pattern: 'Store.*(?:type|state|set)',
      trigger: 'Issue 描述了 Store 状态写入或类型迁移问题。',
      solution: '保持 Store 字段类型稳定，并用 migration/emergencyPatch 处理变更。',
      example: "store.set('score', Number(score));",
      severity: 'warn'
    };
  }
  if (/event|emit|recursion|loop/i.test(text)) {
    return {
      pattern: 'EventBus|emit|recursion|event loop',
      trigger: 'Issue 描述了事件派发顺序或递归问题。',
      solution: '用 queueEvent 分帧处理事件，避免同步递归 emit。',
      example: "events.queueEvent('spawn', payload);",
      severity: 'error'
    };
  }
  if (/physics|collision|body/i.test(text)) {
    return {
      pattern: 'physics|collision|rigid.?body|backend',
      trigger: 'Issue 描述了物理体、碰撞或后端初始化问题。',
      solution: '先初始化物理后端，再创建并同步刚体状态。',
      example: "await physics.setBackend('matter', { module: Matter });",
      severity: 'warn'
    };
  }
  return {
    pattern: escapeRegExp((text.split(/\s+/).find((word) => word.length > 6) || 'OmniCore').slice(0, 40)),
    trigger: 'Issue 描述了 OmniCore 运行时或构建流程中的常见错误。',
    solution: '根据 Issue 中的已解决方案调整调用顺序、配置或资源路径。',
    example: '// See linked resolved issue for the exact fix.',
    severity: 'info'
  };
}

function dedupeById(entries) {
  const seen = new Set();
  return entries.filter((entry) => {
    if (seen.has(entry.id)) return false;
    seen.add(entry.id);
    return true;
  });
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
