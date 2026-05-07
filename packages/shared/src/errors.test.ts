import { describe, it, expect } from 'vitest';
import {
  DomainError,
  NotFoundError,
  ValidationError,
  ConflictError,
  QuotaExceededError,
  apiErrorCodeFromStatus,
  defaultApiErrorMessage,
} from './errors';

describe('DomainError hierarchy', () => {
  it('NotFoundError has correct statusCode and code', () => {
    const err = new NotFoundError('User not found');
    expect(err.statusCode).toBe(404);
    expect(err.code).toBe('NOT_FOUND');
    expect(err.message).toBe('User not found');
  });

  it('ValidationError has correct statusCode and code', () => {
    const err = new ValidationError('Invalid input');
    expect(err.statusCode).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.message).toBe('Invalid input');
  });

  it('ConflictError has correct statusCode and code', () => {
    const err = new ConflictError('Already exists');
    expect(err.statusCode).toBe(409);
    expect(err.code).toBe('CONFLICT');
    expect(err.message).toBe('Already exists');
  });

  it('QuotaExceededError has correct statusCode and code', () => {
    const err = new QuotaExceededError('Storage full');
    expect(err.statusCode).toBe(413);
    expect(err.code).toBe('QUOTA_EXCEEDED');
    expect(err.message).toBe('Storage full');
  });

  it('all subclasses are instances of DomainError', () => {
    expect(new NotFoundError('x')).toBeInstanceOf(DomainError);
    expect(new ValidationError('x')).toBeInstanceOf(DomainError);
    expect(new ConflictError('x')).toBeInstanceOf(DomainError);
    expect(new QuotaExceededError('x')).toBeInstanceOf(DomainError);
  });

  it('all subclasses are instances of Error', () => {
    expect(new NotFoundError('x')).toBeInstanceOf(Error);
    expect(new ValidationError('x')).toBeInstanceOf(Error);
    expect(new ConflictError('x')).toBeInstanceOf(Error);
    expect(new QuotaExceededError('x')).toBeInstanceOf(Error);
  });

  it('DomainError name is set correctly', () => {
    expect(new NotFoundError('x').name).toBe('NotFoundError');
    expect(new ValidationError('x').name).toBe('ValidationError');
  });
});

describe('apiErrorCodeFromStatus', () => {
  it('maps 413 to QUOTA_EXCEEDED', () => {
    expect(apiErrorCodeFromStatus(413)).toBe('QUOTA_EXCEEDED');
  });

  it('maps 409 to CONFLICT', () => {
    expect(apiErrorCodeFromStatus(409)).toBe('CONFLICT');
  });
});

describe('defaultApiErrorMessage', () => {
  it('returns correct message for QUOTA_EXCEEDED', () => {
    expect(defaultApiErrorMessage('QUOTA_EXCEEDED')).toBe('Quota exceeded');
  });
});
