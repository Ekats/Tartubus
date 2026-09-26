// Check that every translation key used in the code exists in every locale,
// and that all locales define the same keys.
// Run with: npm run lint:i18n

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC_DIR = path.join(__dirname, '..', 'src');
const LOCALES_DIR = path.join(SRC_DIR, 'locales');

// Static keys only: t('a.b') / t("a.b"). Template-literal keys can't be checked.
const KEY_PATTERN = /\bt\(\s*['"]([\w.-]+)['"]/g;

function flatten(obj, prefix = '') {
  return Object.entries(obj).flatMap(([key, value]) =>
    value && typeof value === 'object' ? flatten(value, `${prefix}${key}.`) : [`${prefix}${key}`]
  );
}

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full);
    return /\.(js|jsx)$/.test(entry.name) ? [full] : [];
  });
}

const locales = Object.fromEntries(
  fs.readdirSync(LOCALES_DIR)
    .filter(name => name.endsWith('.json'))
    .map(name => [name, new Set(flatten(JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, name), 'utf8'))))])
);

const problems = [];

// 1. Keys used in code but missing from a locale
for (const file of sourceFiles(SRC_DIR)) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [, key] of line.matchAll(KEY_PATTERN)) {
      const missingIn = Object.keys(locales).filter(name => !locales[name].has(key));
      if (missingIn.length > 0) {
        problems.push(`${path.relative(process.cwd(), file)}:${i + 1}  '${key}' missing in ${missingIn.join(', ')}`);
      }
    }
  });
}

// 2. Keys defined in some locales but not others
const allKeys = new Set(Object.values(locales).flatMap(keys => [...keys]));
for (const key of [...allKeys].sort()) {
  const missingIn = Object.keys(locales).filter(name => !locales[name].has(key));
  if (missingIn.length > 0) {
    problems.push(`'${key}' defined in some locales but missing in ${missingIn.join(', ')}`);
  }
}

if (problems.length > 0) {
  console.error(`❌ ${problems.length} translation problem(s):\n` + problems.map(p => `  ${p}`).join('\n'));
  process.exit(1);
}

console.log(`✅ Translations consistent across ${Object.keys(locales).length} locales (${allKeys.size} keys)`);
