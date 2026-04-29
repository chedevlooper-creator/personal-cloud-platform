import { describe, expect, it } from 'vitest';
import { assertPublishImageAllowed, resolvePublishImage } from './policy';

describe('publish image policy', () => {
  it('resolves hosted service kinds to allow-listed images', () => {
    expect(resolvePublishImage('node')).toBe('node:20-alpine');
    expect(resolvePublishImage('vite')).toBe('node:20-alpine');
    expect(resolvePublishImage('static')).toBe('nginxinc/nginx-unprivileged:alpine');
  });

  it('rejects images outside the publish allow-list', () => {
    expect(() => assertPublishImageAllowed('busybox:latest')).toThrow(
      'Publish image is not allowed',
    );
  });
});
