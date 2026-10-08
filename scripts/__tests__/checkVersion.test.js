// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { checkVersion } from '../checkVersion.js';

const tag = (refName, packageVersion, lockVersion = packageVersion) =>
  checkVersion({ refType: 'tag', refName, packageVersion, lockVersion });

describe('checkVersion', () => {
  it('passes when the tag is v + the package.json version', () => {
    expect(tag('v3.4.6', '3.4.6').ok).toBe(true);
  });

  it('fails when the tag and package.json disagree, naming both versions', () => {
    const { ok, message } = tag('v3.4.6', '3.4.5');
    expect(ok).toBe(false);
    expect(message).toContain('v3.4.6');
    expect(message).toContain('3.4.5');
    expect(message).toContain('npm version 3.4.6 --no-git-tag-version');
  });

  it('fails when package-lock.json lags behind package.json', () => {
    const { ok, message } = tag('v3.4.6', '3.4.6', '3.4.5');
    expect(ok).toBe(false);
    expect(message).toContain('package-lock.json version 3.4.5');
    expect(message).toContain('3.4.6');
  });

  it('passes a non-tag ref even when the versions differ', () => {
    expect(checkVersion({
      refType: 'branch', refName: 'master', packageVersion: '3.4.5', lockVersion: '3.4.4'
    }).ok).toBe(true);
    expect(checkVersion({ packageVersion: '3.4.5', lockVersion: '3.4.5' }).ok).toBe(true);
  });

  it('fails a tag without the v prefix or with a suffix', () => {
    expect(tag('3.4.6', '3.4.6').ok).toBe(false);
    expect(tag('v3.4.6-rc1', '3.4.6').ok).toBe(false);
  });
});
