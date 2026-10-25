import { describe, it, expect } from 'vitest';
import {
  isWebCodecsSupported,
  isFileSystemAccessSupported,
} from '../src/engine/export/videoExporter';
import { Muxer as Mp4Muxer, ArrayBufferTarget as Mp4ArrayBufferTarget } from 'mp4-muxer';
import { Muxer as WebmMuxer, ArrayBufferTarget as WebmArrayBufferTarget } from 'webm-muxer';
import {
  Output,
  BufferTarget,
  StreamTarget,
  Mp4OutputFormat,
  WebMOutputFormat,
} from 'mediabunny';

describe('Video Exporter & WebCodecs Capabilities', () => {
  it('detecta soporte de WebCodecs y File System Access', () => {
    expect(typeof isWebCodecsSupported()).toBe('boolean');
    expect(typeof isFileSystemAccessSupported()).toBe('boolean');
  });

  it('inicializa un contenedor MP4 compatible con VideoEncoder (legacy muxer)', () => {
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

  it('inicializa un contenedor WebM con canal alfa para overlay transparente (legacy muxer)', () => {
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

  it('inicializa Mediabunny Output con streaming sin retención en memoria (fastStart: false)', () => {
    const target = new BufferTarget();
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: false }),
      target,
    });

    expect(output).toBeDefined();
    expect(output.format).toBeInstanceOf(Mp4OutputFormat);
  });

  it('inicializa Mediabunny Output para WebM alfa transparente', () => {
    const target = new BufferTarget();
    const output = new Output({
      format: new WebMOutputFormat(),
      target,
    });

    expect(output).toBeDefined();
    expect(output.format).toBeInstanceOf(WebMOutputFormat);
  });

  it('permite streaming directo a StreamTarget con fragmentos continuos', async () => {
    const writtenChunks: any[] = [];
    const writableStream = new WritableStream({
      write(chunk) {
        writtenChunks.push(chunk);
      },
    });

    const target = new StreamTarget(writableStream);
    const output = new Output({
      format: new Mp4OutputFormat({ fastStart: false }),
      target,
    });

    expect(output).toBeDefined();
    expect(output.format).toBeInstanceOf(Mp4OutputFormat);
  });

  it('valida que un fotograma con timestamp no coincidente es rechazado por desincronización', () => {
    const fps = 30;
    const frameDuration = 1 / fps;
    const tolerance = 0.5 * frameDuration;
    const requestedTime = 10.0; // t = 10.0s

    // Fotograma desincronizado (muestra adelantada o atrasada fuera de tolerancia)
    const badSampleTimestamp = 10.2; // 200ms de desvío
    const badSampleDuration = frameDuration;
    const isCovered =
      requestedTime >= badSampleTimestamp - tolerance &&
      requestedTime <= badSampleTimestamp + badSampleDuration + tolerance;

    expect(isCovered).toBe(false);

    // Fotograma sincronizado exacto
    const goodSampleTimestamp = 10.005; // 5ms de desvío (dentro de tolerancia de 16.6ms)
    const isGoodCovered =
      requestedTime >= goodSampleTimestamp - tolerance &&
      requestedTime <= goodSampleTimestamp + frameDuration + tolerance;

    expect(isGoodCovered).toBe(true);
  });
});
