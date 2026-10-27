import { describe, it, expect } from 'vitest';
import {
  parseGoProOrder,
  sortGoProFiles,
  VideoFileItem,
} from '../src/core/fs/fileSystemAdapter';

describe('GoPro Chapter Parser & Chronological Sorter', () => {
  it('detecta correctamente capítulos de GoPro HERO Session / HERO 5 Session / HERO 4 / 5', () => {
    // Capítulo inicial: GOPR0012.MP4
    const first = parseGoProOrder('GOPR0012.MP4');
    expect(first.isGoPro).toBe(true);
    expect(first.session).toBe('0012');
    expect(first.chapter).toBe(1);

    // Capítulo 2: GP010012.MP4
    const second = parseGoProOrder('GP010012.MP4');
    expect(second.isGoPro).toBe(true);
    expect(second.session).toBe('0012');
    expect(second.chapter).toBe(2);

    // Capítulo 3: GP020012.MP4
    const third = parseGoProOrder('C:\\DCIM\\100GOPRO\\GP020012.MP4');
    expect(third.isGoPro).toBe(true);
    expect(third.session).toBe('0012');
    expect(third.chapter).toBe(3);
  });

  it('detecta correctamente capítulos de GoPro modernas (HERO 6, 7, 8, 9, 10, 11, 12, 13)', () => {
    const ch1 = parseGoProOrder('GH010450.MP4');
    expect(ch1.isGoPro).toBe(true);
    expect(ch1.session).toBe('0450');
    expect(ch1.chapter).toBe(1);

    const ch2 = parseGoProOrder('GH020450.MP4');
    expect(ch2.isGoPro).toBe(true);
    expect(ch2.session).toBe('0450');
    expect(ch2.chapter).toBe(2);

    const hevc = parseGoProOrder('GX010450.MP4');
    expect(hevc.isGoPro).toBe(true);
    expect(hevc.session).toBe('0450');
    expect(hevc.chapter).toBe(1);
  });

  it('ordena automáticamente capítulos de GoPro HERO Session desordenados cronológicamente', () => {
    const rawFiles: VideoFileItem[] = [
      { id: '1', name: 'GP020005.MP4', path: '/path/GP020005.MP4', size: 4000000000 },
      { id: '2', name: 'GOPR0005.MP4', path: '/path/GOPR0005.MP4', size: 4000000000 },
      { id: '3', name: 'GP010005.MP4', path: '/path/GP010005.MP4', size: 4000000000 },
    ];

    const sorted = sortGoProFiles(rawFiles);
    expect(sorted.map((f) => f.name)).toEqual([
      'GOPR0005.MP4', // Capítulo 1
      'GP010005.MP4', // Capítulo 2
      'GP020005.MP4', // Capítulo 3
    ]);
  });

  it('clasifica múltiples sesiones y capítulos respetando el orden de cada sesión', () => {
    const rawFiles: VideoFileItem[] = [
      { id: '1', name: 'GH020002.MP4', path: '/path/GH020002.MP4', size: 3000 },
      { id: '2', name: 'GH010001.MP4', path: '/path/GH010001.MP4', size: 3000 },
      { id: '3', name: 'GH020001.MP4', path: '/path/GH020001.MP4', size: 3000 },
      { id: '4', name: 'GH010002.MP4', path: '/path/GH010002.MP4', size: 3000 },
    ];

    const sorted = sortGoProFiles(rawFiles);
    expect(sorted.map((f) => f.name)).toEqual([
      'GH010001.MP4',
      'GH020001.MP4',
      'GH010002.MP4',
      'GH020002.MP4',
    ]);
  });

  it('aplica orden natural a vídeos no GoPro o genéricos', () => {
    const rawFiles: VideoFileItem[] = [
      { id: '1', name: 'tanda_kart_10.mp4', path: 'tanda_kart_10.mp4', size: 100 },
      { id: '2', name: 'tanda_kart_2.mp4', path: 'tanda_kart_2.mp4', size: 100 },
      { id: '3', name: 'tanda_kart_1.mp4', path: 'tanda_kart_1.mp4', size: 100 },
    ];

    const sorted = sortGoProFiles(rawFiles);
    expect(sorted.map((f) => f.name)).toEqual([
      'tanda_kart_1.mp4',
      'tanda_kart_2.mp4',
      'tanda_kart_10.mp4',
    ]);
  });
});
