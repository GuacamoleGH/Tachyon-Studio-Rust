import { describe, it, expect } from 'vitest';
import {
  TEMPLATE_MYCHRON_5,
  TEMPLATE_MINIMALISTA,
  BUILTIN_TEMPLATES,
  scaleTemplate,
} from '../src/core/templates/templateModel';
import { OverlayRenderer } from '../src/engine/canvas/overlayRenderer';
import { SpeedometerWidget } from '../src/engine/widgets/SpeedometerWidget';
import { GMeterWidget } from '../src/engine/widgets/GMeterWidget';

describe('Overlay Template Model & Serialization', () => {
  it('valida que la plantilla MyChron 5 contiene los 7 widgets base con posiciones válidas', () => {
    expect(TEMPLATE_MYCHRON_5.widgets.length).toBe(7);
    for (const w of TEMPLATE_MYCHRON_5.widgets) {
      expect(w.bounds.width).toBeGreaterThan(0);
      expect(w.bounds.height).toBeGreaterThan(0);
      expect(w.bounds.x).toBeGreaterThanOrEqual(0);
      expect(w.bounds.y).toBeGreaterThanOrEqual(0);
      expect(w.visible).toBe(true);
    }
  });

  it('escala proporcionalmente una plantilla a resolución 2K (2560x1440) manteniendo el layout relativo', () => {
    const scaled2K = scaleTemplate(TEMPLATE_MYCHRON_5, 2560, 1440);
    expect(scaled2K.resolution.width).toBe(2560);
    expect(scaled2K.resolution.height).toBe(1440);

    const origTach = TEMPLATE_MYCHRON_5.widgets.find((w) => w.type === 'tachometer_circular')!;
    const scaledTach = scaled2K.widgets.find((w) => w.type === 'tachometer_circular')!;

    // 2560 / 1280 = 2x
    expect(scaledTach.bounds.x).toBe(origTach.bounds.x * 2);
    expect(scaledTach.bounds.y).toBe(origTach.bounds.y * 2);
    expect(scaledTach.bounds.width).toBe(origTach.bounds.width * 2);
    expect(scaledTach.bounds.height).toBe(origTach.bounds.height * 2);
  });

  it('aplica correctamente una plantilla a OverlayRenderer preservando tipos y propiedades', () => {
    const renderer = new OverlayRenderer(1280, 720);
    renderer.applyTemplate(TEMPLATE_MYCHRON_5);

    expect(renderer.widgets.length).toBe(7);

    const speedWidget = renderer.widgets.find((w) => w.type === 'speedometer') as SpeedometerWidget;
    expect(speedWidget).toBeDefined();
    expect(speedWidget.preferredSource).toBe('GPS');

    const gMeter = renderer.widgets.find((w) => w.type === 'g_meter') as GMeterWidget;
    expect(gMeter).toBeDefined();
    expect(gMeter.maxScaleG).toBe(1.5);
  });

  it('serializa la disposición actual de vuelta a un objeto OverlayTemplate versionado', () => {
    const renderer = new OverlayRenderer(1280, 720);
    renderer.applyTemplate(TEMPLATE_MINIMALISTA);
    renderer.resize(1920, 1080);

    const serialized = renderer.toTemplate('Plantilla de Prueba');
    expect(serialized.schema_version).toBe('1.0.0');
    expect(serialized.name).toBe('Plantilla de Prueba');
    expect(serialized.resolution.width).toBe(1920);
    expect(serialized.resolution.height).toBe(1080);
    expect(serialized.widgets.length).toBe(TEMPLATE_MINIMALISTA.widgets.length);
  });

  it('valida que todas las plantillas integradas se aplican sin errores y tienen widgets bien formados', () => {
    const renderer = new OverlayRenderer(1280, 720);
    expect(BUILTIN_TEMPLATES.length).toBe(8);

    for (const t of BUILTIN_TEMPLATES) {
      expect(() => renderer.applyTemplate(t)).not.toThrow();
      expect(renderer.widgets.length).toBe(t.widgets.length);
      for (const w of t.widgets) {
        expect(w.bounds.width).toBeGreaterThan(0);
        expect(w.bounds.height).toBeGreaterThan(0);
      }
    }
  });
});
