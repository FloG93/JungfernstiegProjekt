import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from './index';

describe('Protokoll', () => {
  it('hat die Version 1 (15.6)', () => {
    expect(PROTOCOL_VERSION).toBe(1);
  });
});
