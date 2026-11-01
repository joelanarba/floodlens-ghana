import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

// Mock MapLibre GL JS for jsdom unit/component tests
vi.mock('maplibre-gl', () => {
  class MockMap {
    private listeners: Record<string, Array<(e?: unknown) => void>> = {};
    private sources: Record<string, { setData: ReturnType<typeof vi.fn> }> = {};
    private layers: Set<string> = new Set();

    constructor() {
      setTimeout(() => {
        this.emit('load');
      }, 0);
    }

    addControl = vi.fn();
    on = vi.fn((event: string, layerOrCb: unknown, maybeCb?: unknown) => {
      const cb = typeof layerOrCb === 'function' ? layerOrCb : maybeCb;
      if (typeof cb === 'function') {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(cb as (e?: unknown) => void);
      }
      if (event === 'load' && typeof cb === 'function') {
        (cb as () => void)();
      }
    });
    once = vi.fn((event: string, cb: () => void) => {
      if (event === 'styledata') {
        cb();
      }
    });
    emit(event: string, payload?: unknown) {
      (this.listeners[event] || []).forEach((cb) => cb(payload));
    }
    setStyle = vi.fn();
    flyTo = vi.fn();
    getSource = vi.fn((id: string) => this.sources[id]);
    addSource = vi.fn((id: string) => {
      this.sources[id] = { setData: vi.fn() };
    });
    addLayer = vi.fn((layer: { id: string }) => {
      this.layers.add(layer.id);
    });
    getLayer = vi.fn((id: string) => (this.layers.has(id) ? { id } : undefined));
    setLayoutProperty = vi.fn();
    setFilter = vi.fn();
    getCanvas = vi.fn(() => ({ style: { cursor: '' } }));
    remove = vi.fn();
  }

  class MockNavigationControl {}
  class MockScaleControl {}
  class MockAttributionControl {}
  class MockPopup {
    setLngLat = vi.fn().mockReturnThis();
    setHTML = vi.fn().mockReturnThis();
    addTo = vi.fn().mockReturnThis();
    remove = vi.fn();
  }

  return {
    default: {
      Map: MockMap,
      NavigationControl: MockNavigationControl,
      ScaleControl: MockScaleControl,
      AttributionControl: MockAttributionControl,
      Popup: MockPopup,
    },
    Map: MockMap,
    NavigationControl: MockNavigationControl,
    ScaleControl: MockScaleControl,
    AttributionControl: MockAttributionControl,
    Popup: MockPopup,
  };
});
