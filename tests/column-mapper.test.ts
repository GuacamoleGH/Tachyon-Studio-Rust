import { describe, it, expect } from 'vitest';
import { detectColumnMapping } from '../src/core/csv/columnMapper';

describe('Column Mapper', () => {
  it('detecta cabeceras oficiales de Tachyon y marca formato oficial', () => {
    const headers = [
      'time_offset_video_sec',
      'time_offset_session_sec',
      'timestamp_utc_ms',
      'iso_time',
      'monotonic_nanos',
      'latitude',
      'longitude',
      'altitude_m',
      'gps_speed_kmh',
      'bearing_deg',
      'accuracy_m',
      'lateral_g',
      'longitudinal_g',
      'engine_rpm',
      'obd_speed_kmh',
      'throttle_pct',
      'coolant_temp_c',
      'accel_x',
      'accel_y',
      'accel_z',
    ];

    const mapping = detectColumnMapping(headers);
    expect(mapping.detectedFormat).toBe('official_wide');
    expect(mapping.headerToSignal['latitude']).toBe('latitude');
    expect(mapping.headerToSignal['engine_rpm']).toBe('engine_rpm');
    expect(mapping.headerToSignal['lateral_g']).toBe('lateral_g');
    expect(mapping.unitConversions['gps_speed_kmh']).toBeUndefined(); // Ya viene en km/h
  });

  it('detecta cabeceras sintéticas y activa conversiones de m/s y m/s2', () => {
    const headers = [
      'time_offset_video_sec',
      'utc_ms',
      'elapsed_realtime_nanos',
      'source',
      'lat',
      'lon',
      'speed_ms',
      'accel_lat_ms2',
      'accel_long_ms2',
      'rpm',
    ];

    const mapping = detectColumnMapping(headers);
    expect(mapping.detectedFormat).toBe('sparse_multisource');
    expect(mapping.headerToSignal['lat']).toBe('latitude');
    expect(mapping.headerToSignal['lon']).toBe('longitude');
    expect(mapping.headerToSignal['speed_ms']).toBe('gps_speed_kmh');
    expect(mapping.headerToSignal['rpm']).toBe('engine_rpm');

    // Comprobar funciones de conversión
    const speedConv = mapping.unitConversions['gps_speed_kmh'];
    expect(speedConv).toBeDefined();
    expect(speedConv!(10)).toBeCloseTo(36); // 10 m/s = 36 km/h

    const gConv = mapping.unitConversions['lateral_g'];
    expect(gConv).toBeDefined();
    expect(gConv!(9.80665)).toBeCloseTo(1.0);
  });
});
