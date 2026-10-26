import { describe, it, expect } from 'vitest';
import {
  formatTimeMinutes,
  parseTimeToSeconds,
  formatDurationHuman,
} from '../src/core/utils/timeFormat';

describe('Time formatting and parsing utilities', () => {
  it('formats seconds into mm:ss and mm:ss.s', () => {
    expect(formatTimeMinutes(0)).toBe('00:00');
    expect(formatTimeMinutes(67)).toBe('01:07');
    expect(formatTimeMinutes(842)).toBe('14:02');
    expect(formatTimeMinutes(67.4, true)).toBe('01:07.4');
    expect(formatTimeMinutes(842.0, true)).toBe('14:02');
  });

  it('parses mm:ss, mm:ss.s, hh:mm:ss and numeric seconds', () => {
    expect(parseTimeToSeconds('01:07')).toBe(67);
    expect(parseTimeToSeconds('1:07')).toBe(67);
    expect(parseTimeToSeconds('14:02')).toBe(842);
    expect(parseTimeToSeconds('14:02.5')).toBe(842.5);
    expect(parseTimeToSeconds('01:00:15')).toBe(3615);
    expect(parseTimeToSeconds('687.4')).toBe(687.4);
    expect(parseTimeToSeconds('0')).toBe(0);
    expect(parseTimeToSeconds('')).toBeNull();
    expect(parseTimeToSeconds('invalid:text')).toBeNull();
  });

  it('formats duration nicely into human readable format', () => {
    expect(formatDurationHuman(45)).toBe('45s');
    expect(formatDurationHuman(67)).toBe('1m 07s');
    expect(formatDurationHuman(842)).toBe('14m 02s');
    expect(formatDurationHuman(3665)).toBe('1h 1m 5s');
  });
});
