import { describe, expect, it } from 'vitest';
import { clampZoom, MAX_ZOOM, MIN_ZOOM, wheelZoom } from './zoom';

describe('zoom', () => {
  it('clamps zoom to the supported range', () => {
    expect(clampZoom(0.01)).toBe(MIN_ZOOM);
    expect(clampZoom(1.5)).toBe(1.5);
    expect(clampZoom(4)).toBe(MAX_ZOOM);
  });

  it('zooms in twice as fast as the original wheel curve', () => {
    expect(wheelZoom(1, -1)).toBeCloseTo(1.006780635395421);
    expect(wheelZoom(1, -100)).toBeCloseTo(1.9656, 3);
  });

  it('zooms out at the same increased sensitivity', () => {
    expect(wheelZoom(1, 100)).toBeCloseTo(1 / 1.9656, 3);
  });
});
