import { describe, expect, it, vi } from 'vitest';
import { BrowserService, isSafeNavigationUrl, isSafeUrl } from './service';

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
    expect(isSafeUrl('http://[::ffff:7f00:1]/')).toBe(false);
  });

  it('rejects normalized IPv4 and special-use ranges', () => {
    expect(isSafeUrl('http://2130706433')).toBe(false);
    expect(isSafeUrl('http://0177.0.0.1')).toBe(false);
    expect(isSafeUrl('http://192.0.2.10')).toBe(false);
    expect(isSafeUrl('http://198.18.0.1')).toBe(false);
    expect(isSafeUrl('http://203.0.113.10')).toBe(false);
  });

  it('rejects IPv6 multicast and documentation ranges', () => {
    expect(isSafeUrl('http://[ff02::1]/')).toBe(false);
    expect(isSafeUrl('http://[2001:db8::1]/')).toBe(false);
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

describe('BrowserService session isolation', () => {
  it('lists and closes sessions only for the owning user', async () => {
    const context = { close: vi.fn(async () => undefined) };
    const service = new BrowserService();
    const sessions = (service as unknown as { sessions: Map<string, unknown> }).sessions;
    sessions.set('session-1', {
      id: 'session-1',
      userId: 'user-1',
      url: 'https://example.com',
      title: 'Example',
      createdAt: new Date('2026-04-30T00:00:00.000Z'),
      lastUsedAt: new Date('2026-04-30T00:00:00.000Z'),
      context,
      page: {},
    });

    expect(service.list('user-1')).toHaveLength(1);
    expect(service.list('user-2')).toHaveLength(0);

    await expect(service.close('user-2', 'session-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(context.close).not.toHaveBeenCalled();

    await expect(service.close('user-1', 'session-1')).resolves.toBeUndefined();
    expect(context.close).toHaveBeenCalledOnce();
  });

  it('rejects unsafe navigation before the page is touched', async () => {
    const page = { goto: vi.fn(), url: vi.fn(), title: vi.fn() };
    const service = new BrowserService();
    const sessions = (service as unknown as { sessions: Map<string, unknown> }).sessions;
    sessions.set('session-1', {
      id: 'session-1',
      userId: 'user-1',
      url: 'about:blank',
      title: '',
      createdAt: new Date('2026-04-30T00:00:00.000Z'),
      lastUsedAt: new Date('2026-04-30T00:00:00.000Z'),
      context: { close: vi.fn() },
      page,
    });

    await expect(service.navigate('user-1', 'session-1', 'http://127.0.0.1')).rejects.toMatchObject(
      {
        statusCode: 400,
      },
    );
    expect(page.goto).not.toHaveBeenCalled();
  });
});
