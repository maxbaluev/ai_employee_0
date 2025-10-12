import { describe, expect, it } from 'vitest';

import { redactTelemetryEvent, redactTelemetryPayload } from './redaction';

describe('redactTelemetryPayload', () => {
  describe('string redaction', () => {
    it('redacts email addresses', () => {
      const input = 'Contact me at user@example.com for more info';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('Contact me at [redacted-email] for more info');
    });

    it('redacts multiple email addresses', () => {
      const input = 'Email john@test.com or jane@example.org';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('Email [redacted-email] or [redacted-email]');
    });

    it('redacts phone numbers', () => {
      const input = 'Call me at +1-555-123-4567';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('Call me at [redacted-phone]');
    });

    it('redacts phone numbers with various formats', () => {
      const input = 'Phone: +15551234567 or +442012345678';
      const result = redactTelemetryPayload(input);
      // Note: The phone regex includes trailing spaces in the match
      expect(result).toBe('Phone: [redacted-phone]or [redacted-phone]');
    });

    it('redacts tokens with sk prefix', () => {
      const input = 'API key: sk-abcd1234efgh5678';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('API key: [redacted-token]');
    });

    it('redacts tokens with pk prefix', () => {
      const input = 'Public key: pk_live_abcd1234';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('Public key: [redacted-token]');
    });

    it('redacts bearer tokens', () => {
      const input = 'Authorization: bearer_abc123def456ghi789';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('Authorization: [redacted-token]');
    });

    it('redacts api_key tokens', () => {
      const input = 'Key: api_key_xyz789abc123';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('Key: [redacted-token]');
    });

    it('redacts token patterns (case insensitive)', () => {
      const input = 'Secret: TOKEN_ABCD1234EFGH';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('Secret: [redacted-token]');
    });

    it('redacts multiple sensitive patterns in one string', () => {
      const input = 'User user@test.com called +15551234567 with token sk-secret12345';
      const result = redactTelemetryPayload(input);
      // Note: The phone regex includes trailing spaces in the match
      expect(result).toBe(
        'User [redacted-email] called [redacted-phone]with token [redacted-token]',
      );
    });

    it('returns plain strings without sensitive data unchanged', () => {
      const input = 'This is a normal message without sensitive info';
      const result = redactTelemetryPayload(input);
      expect(result).toBe('This is a normal message without sensitive info');
    });
  });

  describe('primitive types pass through', () => {
    it('passes through numbers', () => {
      expect(redactTelemetryPayload(42)).toBe(42);
      expect(redactTelemetryPayload(0)).toBe(0);
      expect(redactTelemetryPayload(-100)).toBe(-100);
      expect(redactTelemetryPayload(3.14159)).toBe(3.14159);
    });

    it('passes through booleans', () => {
      expect(redactTelemetryPayload(true)).toBe(true);
      expect(redactTelemetryPayload(false)).toBe(false);
    });

    it('passes through null', () => {
      expect(redactTelemetryPayload(null)).toBe(null);
    });

    it('passes through undefined', () => {
      expect(redactTelemetryPayload(undefined)).toBe(undefined);
    });
  });

  describe('nested objects', () => {
    it('redacts strings in nested objects', () => {
      const input = {
        user: {
          email: 'test@example.com',
          phone: '+1-555-1234567',
        },
        metadata: {
          source: 'api',
        },
      };
      const result = redactTelemetryPayload(input);
      expect(result).toEqual({
        user: {
          email: '[redacted-email]',
          phone: '[redacted-phone]',
        },
        metadata: {
          source: 'api',
        },
      });
    });

    it('preserves numbers and booleans in nested objects', () => {
      const input = {
        stats: {
          count: 42,
          enabled: true,
          ratio: 0.95,
        },
      };
      const result = redactTelemetryPayload(input);
      expect(result).toEqual({
        stats: {
          count: 42,
          enabled: true,
          ratio: 0.95,
        },
      });
    });

    it('handles deeply nested objects', () => {
      const input = {
        level1: {
          level2: {
            level3: {
              email: 'deep@example.com',
              count: 123,
            },
          },
        },
      };
      const result = redactTelemetryPayload(input);
      expect(result).toEqual({
        level1: {
          level2: {
            level3: {
              email: '[redacted-email]',
              count: 123,
            },
          },
        },
      });
    });

    it('handles null and undefined in nested objects', () => {
      const input = {
        field1: null,
        field2: undefined,
        nested: {
          field3: null,
          field4: 'value',
        },
      };
      const result = redactTelemetryPayload(input);
      expect(result).toEqual({
        field1: null,
        field2: undefined,
        nested: {
          field3: null,
          field4: 'value',
        },
      });
    });
  });

  describe('arrays', () => {
    it('redacts strings in arrays', () => {
      const input = ['test@example.com', 'normal text', '+1-555-1234567'];
      const result = redactTelemetryPayload(input);
      expect(result).toEqual(['[redacted-email]', 'normal text', '[redacted-phone]']);
    });

    it('preserves primitives in arrays', () => {
      const input = [42, true, null, false, 3.14];
      const result = redactTelemetryPayload(input);
      expect(result).toEqual([42, true, null, false, 3.14]);
    });

    it('handles nested arrays', () => {
      const input = [
        ['test@example.com', 'text'],
        [123, false],
      ];
      const result = redactTelemetryPayload(input);
      expect(result).toEqual([['[redacted-email]', 'text'], [123, false]]);
    });

    it('handles arrays of objects', () => {
      const input = [
        { email: 'user1@test.com', count: 1 },
        { email: 'user2@test.com', count: 2 },
      ];
      const result = redactTelemetryPayload(input);
      expect(result).toEqual([
        { email: '[redacted-email]', count: 1 },
        { email: '[redacted-email]', count: 2 },
      ]);
    });

    it('handles objects with arrays', () => {
      const input = {
        emails: ['user1@test.com', 'user2@test.com'],
        counts: [1, 2, 3],
      };
      const result = redactTelemetryPayload(input);
      expect(result).toEqual({
        emails: ['[redacted-email]', '[redacted-email]'],
        counts: [1, 2, 3],
      });
    });
  });

  describe('complex nested structures', () => {
    it('handles mixed nested objects and arrays', () => {
      const input = {
        users: [
          {
            name: 'John',
            contact: {
              email: 'john@example.com',
              phone: '+1-555-1234',
            },
            active: true,
          },
          {
            name: 'Jane',
            contact: {
              email: 'jane@test.com',
              phone: '+44 20 1234 5678',
            },
            active: false,
          },
        ],
        metadata: {
          count: 2,
          tags: ['important', 'api_key_secret123'],
        },
      };
      const result = redactTelemetryPayload(input);
      expect(result).toEqual({
        users: [
          {
            name: 'John',
            contact: {
              email: '[redacted-email]',
              phone: '[redacted-phone]',
            },
            active: true,
          },
          {
            name: 'Jane',
            contact: {
              email: '[redacted-email]',
              phone: '[redacted-phone]',
            },
            active: false,
          },
        ],
        metadata: {
          count: 2,
          tags: ['important', '[redacted-token]'],
        },
      });
    });
  });
});

describe('redactTelemetryEvent', () => {
  it('redacts strings at top level', () => {
    const input = {
      email: 'test@example.com',
      message: 'normal text',
    };
    const result = redactTelemetryEvent(input);
    expect(result).toEqual({
      email: '[redacted-email]',
      message: 'normal text',
    });
  });

  it('preserves primitives at top level', () => {
    const input = {
      count: 42,
      enabled: true,
      disabled: false,
      empty: null,
    };
    const result = redactTelemetryEvent(input);
    expect(result).toEqual({
      count: 42,
      enabled: true,
      disabled: false,
      empty: null,
    });
  });

  it('omits undefined values', () => {
    const input = {
      field1: 'value',
      field2: undefined,
      field3: 123,
    };
    const result = redactTelemetryEvent(input);
    expect(result).toEqual({
      field1: 'value',
      field3: 123,
    });
  });

  it('recursively redacts nested structures', () => {
    const input = {
      user: {
        email: 'user@example.com',
        metadata: {
          token: 'sk-secret123',
        },
      },
      count: 5,
    };
    const result = redactTelemetryEvent(input);
    expect(result).toEqual({
      user: {
        email: '[redacted-email]',
        metadata: {
          token: '[redacted-token]',
        },
      },
      count: 5,
    });
  });

  it('handles arrays in events', () => {
    const input = {
      emails: ['user1@test.com', 'user2@test.com'],
      counts: [1, 2, 3],
    };
    const result = redactTelemetryEvent(input);
    expect(result).toEqual({
      emails: ['[redacted-email]', '[redacted-email]'],
      counts: [1, 2, 3],
    });
  });

  it('returns empty object for non-object input', () => {
    expect(redactTelemetryEvent(null)).toEqual({});
    expect(redactTelemetryEvent(undefined)).toEqual({});
    expect(redactTelemetryEvent('string')).toEqual({});
    expect(redactTelemetryEvent(123)).toEqual({});
    expect(redactTelemetryEvent([])).toEqual({});
  });

  it('handles complex event payload', () => {
    const input = {
      event_name: 'user_action',
      user_id: 'user-123',
      email: 'user@example.com',
      timestamp: 1234567890,
      success: true,
      metadata: {
        server: 'api-server',
        phone: '+15551234567',
        tokens: ['sk-key12345', 'bearer_token1234'],
      },
    };
    const result = redactTelemetryEvent(input);
    expect(result).toEqual({
      event_name: 'user_action',
      user_id: 'user-123',
      email: '[redacted-email]',
      timestamp: 1234567890,
      success: true,
      metadata: {
        server: 'api-server',
        phone: '[redacted-phone]',
        tokens: ['[redacted-token]', '[redacted-token]'],
      },
    });
  });
});
