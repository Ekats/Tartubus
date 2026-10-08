// Check that a release tag agrees with package.json: the tag drives the Android
// versionName/versionCode and the desktop builds, package.json drives the website's
// Settings text. A release built from a tag that disagrees ships two version numbers.
// Run with: npm run check:version

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

/**
 * @param {{refType?: string, refName?: string, packageVersion: string, lockVersion?: string}} input
 * @returns {{ok: boolean, message: string}}
 */
export function checkVersion({ refType, refName, packageVersion, lockVersion }) {
  // Manual workflow_dispatch runs build whatever package.json says - nothing to match
  if (refType !== 'tag') {
    return { ok: true, message: `Not a tag (ref type '${refType || 'none'}') - building version ${packageVersion}` };
  }

  if (refName !== `v${packageVersion}`) {
    return {
      ok: false,
      message: `Tag '${refName}' does not match package.json version ${packageVersion} (expected tag 'v${packageVersion}').\n`
        + `Fix: npm version ${refName?.replace(/^v/, '') || '<x.y.z>'} --no-git-tag-version, commit, then re-tag.`
    };
  }

  if (lockVersion !== packageVersion) {
    return {
      ok: false,
      message: `package-lock.json version ${lockVersion} does not match package.json version ${packageVersion}.\n`
        + `Fix: npm version ${packageVersion} --no-git-tag-version, commit, then re-tag.`
    };
  }

  return { ok: true, message: `Tag '${refName}' matches package.json and package-lock.json version ${packageVersion}` };
}

// Only run when executed directly (not when imported by tests)
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const version = file => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8')).version;
  const { ok, message } = checkVersion({
    refType: process.env.GITHUB_REF_TYPE,
    refName: process.env.GITHUB_REF_NAME,
    packageVersion: version('package.json'),
    lockVersion: version('package-lock.json')
  });

  if (!ok) {
    console.error(`::error::Release version mismatch`);
    console.error(`❌ ${message}`);
    process.exit(1);
  }

  console.log(`✅ ${message}`);
}
