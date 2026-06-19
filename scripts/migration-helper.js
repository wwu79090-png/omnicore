#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export function cloneJson(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

export function backupKey(storage, key, version) {
  const value = storage.get(key);
  const backupKeyName = `omnicore:backup:${version}:${key}`;
  if (value !== null && value !== undefined && storage.get(backupKeyName) === null) {
    storage.set(backupKeyName, cloneJson(value));
  }
  return backupKeyName;
}

export function migrateStorageKey(storage, fromKey, toKey, mapper, version) {
  const original = storage.get(fromKey);
  backupKey(storage, fromKey, version);
  const migrated = mapper(cloneJson(original));
  storage.set(toKey, migrated);
  return migrated;
}

export async function loadMigration(filePath) {
  const absolute = path.resolve(filePath);
  return import(pathToFileURL(absolute).href);
}

async function runCli() {
  const [, , inputFile, migrationFile, outputFile] = process.argv;
  if (!inputFile || !migrationFile || !outputFile) {
    console.log('Usage: node scripts/migration-helper.js <input.json> <migration.js> <output.json>');
    return;
  }

  const input = JSON.parse(await readFile(inputFile, 'utf8'));
  const migration = await loadMigration(migrationFile);
  const migrated = await migration.migrate(input);
  await writeFile(outputFile, `${JSON.stringify(migrated, null, 2)}\n`);
  console.log(`Migration written to ${outputFile}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  runCli().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
