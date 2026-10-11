export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 3;
export const ZOOM_STEP = 0.1;
// Twice the default logarithmic wheel/trackpad zoom sensitivity.
const WHEEL_ZOOM_BASE = 1.006780635395421;

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));
}

/** Keeps Graph View's exponential feel with a faster local wheel curve. */
export function wheelZoom(zoom: number, delta: number): number {
  return clampZoom(zoom * WHEEL_ZOOM_BASE ** -delta);
}
