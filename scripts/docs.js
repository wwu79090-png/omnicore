#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DEFAULT_GENERATED_AT = '2026-06-20T00:00:00.000Z';
const CORE_FILES = [
  'src/core/Bootstrap.js',
  'src/core/EventBus.js',
  'src/store/Store.js',
  'src/microkernel/RendererAdapter.js',
  'src/microkernel/Kernel.js'
];

function resolveGeneratedAt() {
  if (process.env.OMNICORE_GENERATED_AT) return process.env.OMNICORE_GENERATED_AT;
  if (process.env.SOURCE_DATE_EPOCH) {
    const epoch = Number(process.env.SOURCE_DATE_EPOCH);
    if (Number.isFinite(epoch)) return new Date(epoch * 1000).toISOString();
  }
  return DEFAULT_GENERATED_AT;
}

function extractPublicMembers(source) {
  const members = [];
  const lines = source.split('\n');
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const fn = line.match(/^export function ([a-zA-Z_$][\w$]*)\(([^)]*)\)/u);
    const method = line.match(/^\s{2}(?:async\s+)?(?:static\s+)?([a-zA-Z_$][\w$]*)\(([^)]*)\)/u);
    const name = fn?.[1] || method?.[1];
    const params = fn?.[2] ?? method?.[2];
    if (!name || name === 'constructor' || name.startsWith('_')) continue;
    members.push({ name, params: params.split(',').map((item) => item.trim()).filter(Boolean), line: index });
  }
  return members;
}

function readJsdoc(lines, lineIndex) {
  const block = [];
  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    const line = lines[index];
    block.unshift(line);
    if (line.includes('/**')) return block.join('\n');
    if (!line.trim().startsWith('*') && !line.trim().startsWith('*/')) break;
  }
  return '';
}

function assertDocumented(file, source) {
  const lines = source.split('\n');
  const findings = [];
  const members = extractPublicMembers(source);
  const docs = [];

  for (const member of members) {
    const jsdoc = readJsdoc(lines, member.line);
    if (!jsdoc.includes('/**')) findings.push(`${file}: ${member.name} missing JSDoc block`);
    if (!/@returns\s+\{[^}]+\}/u.test(jsdoc)) findings.push(`${file}: ${member.name} missing @returns type`);
    for (const param of member.params) {
      const paramName = param.replace(/[=\s].*$/u, '').replace(/^\.\.\./u, '');
      if (!paramName || /^[{[]/u.test(paramName)) continue;
      const escapedParam = paramName.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
      if (!new RegExp(`@param\\s+\\{[^}]+\\}\\s+${escapedParam}\\b`, 'u').test(jsdoc)) {
        findings.push(`${file}: ${member.name} missing @param type for ${paramName}`);
      }
    }
    docs.push(`### ${member.name}\n\n${jsdoc.replace(/^ \* ?/gmu, '').replace(/^\/\*\*|\*\/$/gu, '').trim()}\n`);
  }

  return { findings, docs };
}

async function loadTelemetryInsights() {
  try {
    const source = await readFile(path.join(ROOT, 'docs', 'release-notes', 'telemetry-insights.json'), 'utf8');
    return JSON.parse(source);
  } catch {
    return null;
  }
}

function telemetryEntries(insights) {
  return Object.entries(insights?.apiUsage || {})
    .map(([api, value]) => ({
      api,
      count: Number(value.count || 0),
      avgDuration: Number(value.avgDuration || 0)
    }))
    .filter((entry) => entry.count > 0)
    .sort((left, right) => right.count - left.count || left.api.localeCompare(right.api));
}

function telemetrySection(entries) {
  if (!entries.length) return [];
  return [
    '## 高频 API',
    '',
    ...entries.map((entry) => `- ${entry.api} - ${entry.count} calls, avg ${entry.avgDuration.toFixed(2)} ms`),
    ''
  ];
}

function tutorialGapDocument(entries, apiOutput) {
  const gaps = entries.filter((entry) => !apiOutput.includes(`### ${entry.api}`));
  const lines = [
    '# 教程缺失区',
    '',
    '以下 API 来自 debug 遥测热度，但当前文档中缺少独立教程或示例入口。',
    '',
    ...(gaps.length
      ? gaps.map((entry) => `- ${entry.api}: ${entry.count} calls`)
      : ['- 暂无缺失项'])
  ];
  return `${lines.join('\n')}\n`;
}

async function main() {
  const allFindings = [];
  const sections = ['# OmniCore API Reference', '', `Generated: ${resolveGeneratedAt()}`, ''];
  const telemetry = telemetryEntries(await loadTelemetryInsights());
  sections.push(...telemetrySection(telemetry));

  for (const relative of CORE_FILES) {
    const source = await readFile(path.join(ROOT, relative), 'utf8');
    const { findings, docs } = assertDocumented(relative, source);
    allFindings.push(...findings);
    sections.push(`## ${relative}`, '', ...docs);
  }

  const output = `${sections.join('\n')}\n`;
  if (/\bunknown\b/i.test(output)) allFindings.push('docs/api.md would contain unknown type');

  await mkdir(path.join(ROOT, 'docs'), { recursive: true });
  await writeFile(path.join(ROOT, 'docs', 'api.md'), output);
  await writeFile(path.join(ROOT, 'docs', 'tutorial-gaps.md'), tutorialGapDocument(telemetry, output));

  if (allFindings.length) {
    console.error(allFindings.join('\n'));
    process.exitCode = 1;
    return;
  }
  console.log('API docs generated without unknown types');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
