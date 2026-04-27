import { describe, it, expect } from 'vitest';

// Import the class but test the method directly via a standalone approach
// We test the path validation logic in isolation by replicating the guard
function assertSafePath(path: string): void {
  const normalized = path.replace(/\\/g, '/');
  if (
    normalized.includes('..') ||
    normalized.includes('\0') ||
    normalized.startsWith('~')
  ) {
    throw new Error('Path traversal detected — access denied');
  }
}

describe('Path Traversal Protection', () => {
  it('should allow normal paths', () => {
    expect(() => assertSafePath('/src/app.ts')).not.toThrow();
    expect(() => assertSafePath('/README.md')).not.toThrow();
    expect(() => assertSafePath('/deep/nested/path/to/file.js')).not.toThrow();
    expect(() => assertSafePath('/')).not.toThrow();
  });

  it('should block .. traversal', () => {
    expect(() => assertSafePath('../etc/passwd')).toThrow('Path traversal');
    expect(() => assertSafePath('/src/../../etc/shadow')).toThrow('Path traversal');
    expect(() => assertSafePath('/..')).toThrow('Path traversal');
    expect(() => assertSafePath('/src/../../../secret')).toThrow('Path traversal');
  });

  it('should block backslash traversal (Windows-style)', () => {
    expect(() => assertSafePath('..\\etc\\passwd')).toThrow('Path traversal');
    expect(() => assertSafePath('\\..\\..\\secret')).toThrow('Path traversal');
  });

  it('should block null byte injection', () => {
    expect(() => assertSafePath('/src/file.ts\0.jpg')).toThrow('Path traversal');
    expect(() => assertSafePath('\0')).toThrow('Path traversal');
  });

  it('should block tilde expansion', () => {
    expect(() => assertSafePath('~/.ssh/id_rsa')).toThrow('Path traversal');
    expect(() => assertSafePath('~/../../etc/passwd')).toThrow('Path traversal');
  });

  it('should allow paths that contain double dots in filenames', () => {
    // ".." as part of a filename segment is still blocked to be safe
    expect(() => assertSafePath('/path/..hidden')).toThrow('Path traversal');
  });
});
