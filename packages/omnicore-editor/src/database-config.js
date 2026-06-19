import fs from 'node:fs';
import path from 'node:path';

export function normalizeDatabaseConfig(tables = {}) {
  const output = {};
  for (const [tableName, records] of Object.entries(tables || {})) {
    output[tableName] = {};
    const list = Array.isArray(records) ? records : Object.values(records || {});
    for (const record of list) {
      if (!record?.id) continue;
      output[tableName][record.id] = { ...record };
    }
  }
  return output;
}

export function saveDatabaseConfig({
  root = process.cwd(),
  file = path.join('config', 'db.json'),
  tables = {}
} = {}) {
  const target = path.resolve(root, file);
  if (!target.startsWith(path.resolve(root))) {
    return { ok: false, path: target, error: 'Target path escapes project root.' };
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(normalizeDatabaseConfig(tables), null, 2)}\n`, 'utf8');
  return { ok: true, path: target };
}

export default saveDatabaseConfig;
