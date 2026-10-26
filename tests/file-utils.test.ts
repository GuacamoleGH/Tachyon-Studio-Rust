import { describe, it, expect } from 'vitest';
import { sanitizeFilename } from '../src/core/utils/fileUtils';

describe('sanitizeFilename', () => {
  it('removes colons and slashes from titles like dates and timestamps', () => {
    // Exact case from the user: "Sesión 25/10/2026 17:53"
    const input = 'Sesión 25/10/2026 17:53';
    const result = sanitizeFilename(input);
    expect(result).toBe('Sesion_25_10_2026_17_53');
    expect(result).not.toContain(':');
    expect(result).not.toContain('/');
  });

  it('removes all Windows reserved characters < > : " / \\ | ? *', () => {
    const input = 'video:part<1>*final?"hello"|pipe\\slash?';
    const result = sanitizeFilename(input);
    expect(result).toBe('video_part_1_final_hello_pipe_slash');
  });

  it('handles empty and whitespace-only inputs with fallback', () => {
    expect(sanitizeFilename('')).toBe('archivo');
    expect(sanitizeFilename('   ')).toBe('archivo');
    expect(sanitizeFilename('???')).toBe('archivo');
  });

  it('guards against Windows reserved device names like CON, PRN, AUX', () => {
    expect(sanitizeFilename('con')).toBe('con_file');
    expect(sanitizeFilename('AUX')).toBe('AUX_file');
    expect(sanitizeFilename('nul')).toBe('nul_file');
  });
});
