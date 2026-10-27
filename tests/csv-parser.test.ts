import { describe, it, expect } from 'vitest';
import { parseTelemetryCsv } from '../src/core/csv/csvParser';

describe('CSV Parser', () => {
  it('parsea correctamente el formato ancho oficial de Android', () => {
    const csvContent = `time_offset_video_sec,time_offset_session_sec,timestamp_utc_ms,iso_time,monotonic_nanos,latitude,longitude,altitude_m,gps_speed_kmh,bearing_deg,accuracy_m,lateral_g,longitudinal_g,engine_rpm,obd_speed_kmh,throttle_pct,coolant_temp_c,accel_x,accel_y,accel_z
-0.100,0.030,1792878724817,2026-10-24T23:52:04.817Z,777966052193455,,,,,,,-0.081,0.070,,,,,-0.796,-0.572,-0.689
0.020,0.150,1792878724919,2026-10-24T23:52:04.919Z,777966174726535,36.7212916,-4.4179171,17.0,85.50,180.2,2.5,-0.669,0.163,3200,84.0,45.5,90,-6.564,-8.573,-1.594
`;

    const result = parseTelemetryCsv(csvContent);
    expect(result.totalRows).toBe(2);
    expect(result.mappingConfig.detectedFormat).toBe('official_wide');

    // Primera fila con celdas vacías: deben ser null, NUNCA 0
    const p0 = result.points[0];
    expect(p0.time_offset_video_sec).toBe(-0.1);
    expect(p0.lateral_g).toBe(-0.081);
    expect(p0.longitudinal_g).toBe(0.07);
    expect(p0.engine_rpm).toBeNull(); // Ausente -> null
    expect(p0.latitude).toBeNull();   // Ausente -> null
    expect(p0.gps_speed_kmh).toBeNull(); // Ausente -> null

    // Segunda fila completa
    const p1 = result.points[1];
    expect(p1.time_offset_video_sec).toBe(0.02);
    expect(p1.latitude).toBeCloseTo(36.7212916);
    expect(p1.longitude).toBeCloseTo(-4.4179171);
    expect(p1.gps_speed_kmh).toBe(85.5);
    expect(p1.engine_rpm).toBe(3200);
    expect(p1.throttle_pct).toBe(45.5);
    expect(p1.coolant_temp_c).toBe(90);
  });

  it('parsea correctamente el formato disperso multi-fuente con source', () => {
    const csvContent = `time_offset_video_sec,utc_ms,elapsed_realtime_nanos,source,lat,lon,altitude_m,speed_ms,bearing_deg,accuracy_m,speed_accuracy_ms,accel_long_ms2,accel_lat_ms2,accel_x_raw,accel_y_raw,accel_z_raw,gyro_z_rads,rpm,obd_speed_kmh,throttle_pct,pedal_pct,engine_load_pct,coolant_c
-1.200,1792866598800,48212350000000,gps,36.7212916,-4.4179171,17.0,10.0,20.7,3.1,0.22,,,,,,,,,,,,
-1.200,1792866598800,48212350000000,imu,,,,,,,,9.80665,0.0,0.098,2.576,9.959,0.0029,,,,,,
-1.180,1792866598820,48212370000000,obd,,,,,,,,,,,,,,3500,36.0,50.0,,,88
`;

    const result = parseTelemetryCsv(csvContent);
    expect(result.totalRows).toBe(3);
    expect(result.mappingConfig.detectedFormat).toBe('sparse_multisource');

    // Muestra GPS con conversión automática de speed_ms a km/h (10.0 m/s -> 36.0 km/h)
    const pGps = result.points[0];
    expect(pGps.latitude).toBeCloseTo(36.7212916);
    expect(pGps.gps_speed_kmh).toBeCloseTo(36.0);
    expect(pGps.engine_rpm).toBeNull();

    // Muestra IMU con conversión automática de m/s^2 a G (9.80665 m/s^2 -> 1.0 G)
    const pImu = result.points[1];
    expect(pImu.longitudinal_g).toBeCloseTo(1.0);
    expect(pImu.lateral_g).toBeCloseTo(0.0);

    // Muestra OBD
    const pObd = result.points[2];
    expect(pObd.engine_rpm).toBe(3500);
    expect(pObd.coolant_temp_c).toBe(88);
  });

  it('parsea con 100% fidelidad el CSV oficial de 24 columnas documentado en DATOS_REGISTRADOS.md', () => {
    const csvContent = `time_offset_video_sec,time_offset_session_sec,timestamp_utc_ms,iso_time,monotonic_nanos,latitude,longitude,altitude_m,gps_speed_kmh,bearing_deg,accuracy_m,lateral_g,longitudinal_g,engine_rpm,obd_speed_kmh,throttle_pct,coolant_temp_c,gear,boost_bar,fuel_l100km,intake_temp_c,accel_x,accel_y,accel_z
12.450,12.450,1729864200123,2026-10-27T10:30:00.123Z,154823948572000,40.416775,-3.703790,655.4,124.6,184.2,1.8,0.85,-0.92,5850,123.0,100.0,92,3,0.45,14.2,34,0.12,8.25,-1.14
13.000,13.000,1729864200673,2026-10-27T10:30:00.673Z,154824500000000,40.416800,-3.703810,655.8,126.0,184.5,1.7,0.88,-0.10,6000,125.0,80.0,93,R,-0.20,9.5,35,0.05,1.20,-0.80
`;

    const result = parseTelemetryCsv(csvContent);
    expect(result.totalRows).toBe(2);
    expect(result.mappingConfig.detectedFormat).toBe('official_wide');

    const p0 = result.points[0];
    expect(p0.time_offset_video_sec).toBe(12.45);
    expect(p0.latitude).toBeCloseTo(40.416775);
    expect(p0.longitude).toBeCloseTo(-3.70379);
    expect(p0.altitude_m).toBe(655.4);
    expect(p0.gps_speed_kmh).toBe(124.6);
    expect(p0.bearing_deg).toBe(184.2);
    expect(p0.accuracy_m).toBe(1.8);
    expect(p0.lateral_g).toBe(0.85);
    expect(p0.longitudinal_g).toBe(-0.92);
    expect(p0.engine_rpm).toBe(5850);
    expect(p0.obd_speed_kmh).toBe(123.0);
    expect(p0.throttle_pct).toBe(100.0);
    expect(p0.coolant_temp_c).toBe(92);
    expect(p0.gear).toBe('3');
    expect(p0.boost_bar).toBe(0.45);
    expect(p0.fuel_l100km).toBe(14.2);
    expect(p0.intake_temp_c).toBe(34);
    expect(p0.accel_x).toBe(0.12);
    expect(p0.accel_y).toBe(8.25);
    expect(p0.accel_z).toBe(-1.14);
    expect(p0.iso_time).toBe('2026-10-27T10:30:00.123Z');

    const p1 = result.points[1];
    expect(p1.gear).toBe('R');
    expect(p1.boost_bar).toBe(-0.20);
    expect(p1.fuel_l100km).toBe(9.5);
    expect(p1.intake_temp_c).toBe(35);
  });
});
