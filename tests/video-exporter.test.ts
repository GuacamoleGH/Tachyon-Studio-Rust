import { describe, it, expect } from 'vitest';
import {
  isWebCodecsSupported,
  isFileSystemAccessSupported,
} from '../src/engine/export/videoExporter';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';

describe('Video Exporter & WebCodecs Capabilities', () => {
  it('detecta soporte de WebCodecs y File System Access', () => {
    expect(typeof isWebCodecsSupported()).toBe('boolean');
    expect(typeof isFileSystemAccessSupported()).toBe('boolean');
  });

  it('inicializa un contenedor MP4 compatible con VideoEncoder', () => {
    const target = new Mp4ArrayBufferTarget();
    const muxer = new Mp4Muxer({
      target,
      video: {
        codec: 'avc',
        width: 1920,
        height: 1080,
      },
      fastStart: 'in-memory',
    });

    expect(muxer).toBeDefined();
    expect(target).toBeDefined();
  });

  it('inicializa un contenedor WebM con canal alfa para overlay transparente', () => {
    const target = new WebmArrayBufferTarget();
    const muxer = new WebmMuxer({
      target,
      video: {
        codec: 'V_VP9',
        width: 1280,
        height: 720,
        alpha: true,
      },
    });

    expect(muxer).toBeDefined();
    muxer.finalize();
    expect(target.buffer).toBeDefined();
    expect(target.buffer.byteLength).toBeGreaterThan(0);
  });
});
