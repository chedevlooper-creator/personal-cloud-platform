import { describe, expect, it } from 'vitest';
import { isSafeNavigationUrl, isSafeUrl } from './service';

describe('isSafeUrl', () => {
  it('accepts plain http(s) public URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com/path?x=1')).toBe(true);
  });

  it('rejects non-http schemes', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('ftp://example.com')).toBe(false);
  });

  it('rejects loopback and link-local', () => {
    expect(isSafeUrl('http://localhost')).toBe(false);
    expect(isSafeUrl('http://127.0.0.1')).toBe(false);
    expect(isSafeUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
    expect(isSafeUrl('http://[::1]/')).toBe(false);
  });

  it('rejects private IPv4 ranges', () => {
    expect(isSafeUrl('http://10.0.0.1')).toBe(false);
    expect(isSafeUrl('http://0.0.0.0')).toBe(false);
    expect(isSafeUrl('http://100.64.0.1')).toBe(false);
    expect(isSafeUrl('http://192.168.1.1')).toBe(false);
    expect(isSafeUrl('http://172.16.0.1')).toBe(false);
    expect(isSafeUrl('http://172.31.0.1')).toBe(false);
    expect(isSafeUrl('http://224.0.0.1')).toBe(false);
  });

  it('rejects IPv4-mapped IPv6 private addresses', () => {
    expect(isSafeUrl('http://[::ffff:127.0.0.1]/')).toBe(false);
    expect(isSafeUrl('http://[::ffff:10.0.0.1]/')).toBe(false);
  });

  it('accepts non-private 172 ranges', () => {
    expect(isSafeUrl('http://172.32.0.1')).toBe(true);
  });

  it('rejects garbage', () => {
    expect(isSafeUrl('not a url')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });

  it('rejects hostnames that resolve to private addresses', async () => {
    await expect(isSafeNavigationUrl('http://localhost')).resolves.toBe(false);
  });
});
