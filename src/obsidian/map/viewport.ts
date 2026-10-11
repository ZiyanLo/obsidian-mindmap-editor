import type { ViewportState } from '../../core/render/viewport-state';
import {
  clampZoom,
  MAX_ZOOM,
  MIN_ZOOM,
  wheelZoom,
  ZOOM_STEP,
} from '../../core/render/zoom';

/** Small amount of room to pan beyond the map's edges. */
export const PAN_INSET = 160;
const LEGACY_PAN_INSET = 2048;
/** Breathing room between a fitted map and the viewport edges. */
const FIT_INSET = 32;

interface ZoomAnchor {
  viewportX: number;
  viewportY: number;
  contentX: number;
  contentY: number;
}

interface PanStart {
  x: number;
  y: number;
  left: number;
  top: number;
}

interface PinchStart {
  distance: number;
  zoom: number;
  anchor: ZoomAnchor;
}

/** Owns zoom, touch gestures, and the scrollable surface around a mind map. */
export class MapViewport {
  private zoom = 1;
  private zoomTarget = 1;
  private zoomFrame: number | null = null;
  private zoomAnchor: ZoomAnchor | null = null;
  private initialized = false;
  private zoomOutActionEl: HTMLElement | null = null;
  private zoomInActionEl: HTMLElement | null = null;
  private contentWidth = 0;
  private contentHeight = 0;
  private insetX = PAN_INSET;
  private insetY = PAN_INSET;
  private wheelGesture: 'pan' | 'zoom' | null = null;
  private lastWheelAt = 0;
  private readonly abort = new AbortController();

  constructor(
    private readonly scrollerEl: HTMLElement,
    private readonly surfaceEl: HTMLElement,
    private readonly canvasEl: HTMLElement,
    initialZoom = 1,
  ) {
    this.zoom = clampZoom(initialZoom);
    this.zoomTarget = this.zoom;
    canvasEl.setCssStyles({
      top: `${PAN_INSET}px`,
      left: `${PAN_INSET}px`,
    });
    this.applyZoom();
    this.listen('wheel', (event) => this.onWheel(event), { passive: false });
    this.registerTouchGestures();
  }

  get value(): number {
    return this.zoom;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  /** Obsidian removes plugin CSS before asking closing views for their state. */
  get canCapturePosition(): boolean {
    const styles = this.scrollerEl.win.getComputedStyle(this.scrollerEl);
    const scrollable = (overflow: string): boolean =>
      overflow === 'auto' || overflow === 'scroll';

    return scrollable(styles.overflowX) && scrollable(styles.overflowY);
  }

  snapshot(): ViewportState {
    return {
      zoom: this.zoom,
      left: this.scrollerEl.scrollLeft,
      top: this.scrollerEl.scrollTop,
    };
  }

  restorePosition(state: ViewportState): void {
    this.restore(state.zoom);
    const maxLeft = Math.max(
      0,
      this.scrollerEl.scrollWidth - this.scrollerEl.clientWidth,
    );
    const maxTop = Math.max(
      0,
      this.scrollerEl.scrollHeight - this.scrollerEl.clientHeight,
    );
    const hasScrollBounds =
      this.scrollerEl.scrollWidth > this.scrollerEl.clientWidth;
    let left = state.left;
    let top = state.top;

    // Old releases used a 2048px origin. Move an otherwise unreachable saved
    // position to the new origin when reopening a map after this change.
    if (hasScrollBounds && left > maxLeft + 1) {
      left += this.insetX - LEGACY_PAN_INSET;
    }
    if (hasScrollBounds && top > maxTop + 1) {
      top += this.insetY - LEGACY_PAN_INSET;
    }
    this.scrollerEl.scrollLeft = left;
    this.scrollerEl.scrollTop = top;
  }

  bindActions(out: HTMLElement, into: HTMLElement): void {
    this.zoomOutActionEl = out;
    this.zoomInActionEl = into;
    this.syncActions();
  }

  zoomIn(): void {
    this.smoothZoom(this.zoomTarget + ZOOM_STEP);
  }

  zoomOut(): void {
    this.smoothZoom(this.zoomTarget - ZOOM_STEP);
  }

  restore(value: number): void {
    this.cancelSmoothZoom();
    this.zoom = clampZoom(value);
    this.zoomTarget = this.zoom;
    this.applyZoom();
    this.syncActions();
  }

  sizeSurface(width: number, height: number): void {
    this.contentWidth = width;
    this.contentHeight = height;
    this.refreshSurface();
    if (!this.initialized) {
      this.scrollerEl.scrollLeft = this.insetX;
      this.scrollerEl.scrollTop = this.insetY;
      this.initialized = true;
    }
  }

  refreshViewportSize(): void {
    this.refreshSurface();
  }

  /** Returns the transformed map to the middle without changing its zoom. */
  center(): void {
    this.cancelSmoothZoom();
    this.zoomTarget = this.zoom;
    this.scrollerEl.scrollLeft =
      this.insetX +
      (this.canvasEl.offsetWidth * this.zoom - this.scrollerEl.clientWidth) / 2;
    this.scrollerEl.scrollTop =
      this.insetY +
      (this.canvasEl.offsetHeight * this.zoom - this.scrollerEl.clientHeight) /
        2;
    this.syncActions();
  }

  /** Centers an item without asking ancestor panes to scroll with it. */
  centerElement(el: HTMLElement): void {
    const viewport = this.scrollerEl.getBoundingClientRect();
    const target = el.getBoundingClientRect();

    this.scrollerEl.scrollLeft +=
      target.left + target.width / 2 - (viewport.left + viewport.width / 2);
    this.scrollerEl.scrollTop +=
      target.top + target.height / 2 - (viewport.top + viewport.height / 2);
  }

  /** Zooms until the whole map fits, then places it in the middle. */
  fit(): void {
    const width = this.canvasEl.offsetWidth;
    const height = this.canvasEl.offsetHeight;

    if (!width || !height) {
      return;
    }
    const availableWidth = Math.max(
      1,
      this.scrollerEl.clientWidth - FIT_INSET * 2,
    );
    const availableHeight = Math.max(
      1,
      this.scrollerEl.clientHeight - FIT_INSET * 2,
    );

    this.restore(Math.min(availableWidth / width, availableHeight / height));
    this.center();
  }

  destroy(): void {
    this.cancelSmoothZoom();
    this.abort.abort();
  }

  private listen<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ): void {
    this.scrollerEl.addEventListener(type, listener, {
      ...options,
      signal: this.abort.signal,
    });
  }

  /** Keeps the toolbar's accessible labels and limit states in sync. */
  private syncActions(): void {
    const percent = Math.round(this.zoom * 100);
    const atMinimum = this.zoom <= MIN_ZOOM;
    const atMaximum = this.zoom >= MAX_ZOOM;

    this.zoomOutActionEl?.setAttribute('aria-label', `Zoom out (${percent}%)`);
    this.zoomInActionEl?.setAttribute('aria-label', `Zoom in (${percent}%)`);
    this.zoomOutActionEl?.toggleClass('is-disabled', atMinimum);
    this.zoomInActionEl?.toggleClass('is-disabled', atMaximum);
    this.zoomOutActionEl?.setAttribute('aria-disabled', String(atMinimum));
    this.zoomInActionEl?.setAttribute('aria-disabled', String(atMaximum));
  }

  /** Moves toward a target over several frames, like Obsidian's Graph View. */
  private smoothZoom(next: number, clientX?: number, clientY?: number): void {
    this.zoomTarget = clampZoom(next);
    if (Math.abs(this.zoomTarget - this.zoom) < 0.001) {
      this.cancelSmoothZoom();
      this.syncActions();

      return;
    }
    this.zoomAnchor = this.captureZoomAnchor(clientX, clientY);
    if (this.zoomFrame === null) {
      this.zoomFrame = this.canvasEl.win.requestAnimationFrame(() =>
        this.stepSmoothZoom(),
      );
    }
  }

  private stepSmoothZoom(): void {
    const distance = this.zoomTarget - this.zoom;
    const done = Math.abs(distance) < 0.001;
    const next = done ? this.zoomTarget : this.zoom + distance * 0.28;

    this.zoomFrame = null;
    if (this.zoomAnchor) {
      this.applyZoomAtAnchor(next, this.zoomAnchor);
    }
    if (done) {
      this.zoomAnchor = null;
      this.syncActions();
    } else {
      this.zoomFrame = this.canvasEl.win.requestAnimationFrame(() =>
        this.stepSmoothZoom(),
      );
    }
  }

  private cancelSmoothZoom(): void {
    if (this.zoomFrame !== null) {
      this.canvasEl.win.cancelAnimationFrame(this.zoomFrame);
      this.zoomFrame = null;
    }
    this.zoomAnchor = null;
  }

  /** Applies a zoom while keeping the chosen point fixed in the viewport. */
  private setZoom(next: number, clientX?: number, clientY?: number): void {
    const zoom = clampZoom(next);

    this.cancelSmoothZoom();
    this.zoomTarget = zoom;
    this.applyZoomAt(zoom, clientX, clientY);
    this.syncActions();
  }

  private applyZoomAt(zoom: number, clientX?: number, clientY?: number): void {
    if (Math.abs(zoom - this.zoom) < 0.0001) {
      return;
    }
    this.applyZoomAtAnchor(zoom, this.captureZoomAnchor(clientX, clientY));
  }

  private captureZoomAnchor(clientX?: number, clientY?: number): ZoomAnchor {
    const box = this.scrollerEl.getBoundingClientRect();
    const viewportX = (clientX ?? box.left + box.width / 2) - box.left;
    const viewportY = (clientY ?? box.top + box.height / 2) - box.top;

    return {
      viewportX,
      viewportY,
      contentX:
        (this.scrollerEl.scrollLeft + viewportX - this.insetX) / this.zoom,
      contentY:
        (this.scrollerEl.scrollTop + viewportY - this.insetY) / this.zoom,
    };
  }

  private applyZoomAtAnchor(zoom: number, anchor: ZoomAnchor): void {
    if (Math.abs(zoom - this.zoom) < 0.0001) {
      return;
    }
    this.zoom = zoom;
    this.applyZoom();
    this.scrollerEl.scrollLeft =
      this.insetX + anchor.contentX * zoom - anchor.viewportX;
    this.scrollerEl.scrollTop =
      this.insetY + anchor.contentY * zoom - anchor.viewportY;
  }

  private applyZoom(): void {
    // Nodes remain absolutely positioned; only the surface's scroll bounds
    // follow the scale rather than reserving space for 300% at every size.
    this.canvasEl.style.setProperty('transform', `scale(${this.zoom})`);
    this.refreshSurface();
  }

  private refreshSurface(): void {
    if (!this.contentWidth || !this.contentHeight) {
      return;
    }
    const scaledWidth = this.contentWidth * this.zoom;
    const scaledHeight = this.contentHeight * this.zoom;
    const insetX = Math.max(
      PAN_INSET,
      (this.scrollerEl.clientWidth - scaledWidth) / 2 + PAN_INSET,
    );
    const insetY = Math.max(
      PAN_INSET,
      (this.scrollerEl.clientHeight - scaledHeight) / 2 + PAN_INSET,
    );
    const deltaX = insetX - this.insetX;
    const deltaY = insetY - this.insetY;

    this.insetX = insetX;
    this.insetY = insetY;
    this.canvasEl.setCssStyles({ left: `${insetX}px`, top: `${insetY}px` });
    this.surfaceEl.setCssStyles({
      width: `${scaledWidth + insetX * 2}px`,
      height: `${scaledHeight + insetY * 2}px`,
    });
    if (this.initialized) {
      this.scrollerEl.scrollLeft += deltaX;
      this.scrollerEl.scrollTop += deltaY;
    }
  }

  private onWheel(event: WheelEvent): void {
    if (!event.deltaX && !event.deltaY) {
      return;
    }
    const now = this.scrollerEl.win.performance.now();
    const forcedZoom = event.ctrlKey || event.metaKey;

    if (!forcedZoom && event.deltaX !== 0) {
      this.wheelGesture = 'pan';
    } else if (
      !forcedZoom &&
      (now - this.lastWheelAt > 220 || !this.wheelGesture)
    ) {
      const coarseWheel =
        event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL ||
        (event.deltaX === 0 &&
          Math.abs(event.deltaY) >= 80 &&
          (Math.abs(event.deltaY % 100) < 0.001 ||
            Math.abs(event.deltaY % 120) < 0.001));

      this.wheelGesture = coarseWheel ? 'zoom' : 'pan';
    }
    if (!forcedZoom) {
      this.lastWheelAt = now;
    }
    if (!forcedZoom && this.wheelGesture === 'pan') {
      this.cancelSmoothZoom();
      this.zoomTarget = this.zoom;
      event.preventDefault();
      this.scrollerEl.scrollLeft += event.deltaX;
      this.scrollerEl.scrollTop += event.deltaY;

      return;
    }
    if (!event.deltaY) {
      return;
    }
    event.preventDefault();
    this.smoothZoom(
      wheelZoom(this.zoomTarget, event.deltaY),
      event.clientX,
      event.clientY,
    );
  }

  /** One-finger background pan; two fingers can slide or pinch the canvas. */
  private registerTouchGestures(): void {
    let pan: PanStart | null = null;
    let pinch: PinchStart | null = null;
    const distance = (touches: TouchList): number =>
      Math.hypot(
        touches[0]!.clientX - touches[1]!.clientX,
        touches[0]!.clientY - touches[1]!.clientY,
      );

    this.listen(
      'touchstart',
      (event) => {
        if (event.touches.length === 2) {
          const startDistance = distance(event.touches);

          if (!startDistance) {
            return;
          }
          this.cancelSmoothZoom();
          this.zoomTarget = this.zoom;
          const first = event.touches[0]!;
          const second = event.touches[1]!;

          pinch = {
            distance: startDistance,
            zoom: this.zoom,
            anchor: this.captureZoomAnchor(
              (first.clientX + second.clientX) / 2,
              (first.clientY + second.clientY) / 2,
            ),
          };
          pan = null;
          event.preventDefault();
        } else if (
          event.touches.length === 1 &&
          !(event.target as Element | null)?.closest('.mindmap-node')
        ) {
          const touch = event.touches[0]!;

          pan = this.panStart(touch);
        }
      },
      { passive: false },
    );
    this.listen(
      'touchmove',
      (event) => {
        if (event.touches.length === 2 && pinch) {
          const first = event.touches[0]!;
          const second = event.touches[1]!;
          const box = this.scrollerEl.getBoundingClientRect();
          const viewportX = (first.clientX + second.clientX) / 2 - box.left;
          const viewportY = (first.clientY + second.clientY) / 2 - box.top;
          const zoom = clampZoom(
            pinch.zoom * (distance(event.touches) / pinch.distance),
          );

          event.preventDefault();
          this.zoom = zoom;
          this.zoomTarget = zoom;
          this.applyZoom();
          this.scrollerEl.scrollLeft =
            this.insetX + pinch.anchor.contentX * zoom - viewportX;
          this.scrollerEl.scrollTop =
            this.insetY + pinch.anchor.contentY * zoom - viewportY;
          this.syncActions();
        } else if (event.touches.length === 1 && pan) {
          const touch = event.touches[0]!;

          event.preventDefault();
          this.scrollerEl.scrollLeft = pan.left - (touch.clientX - pan.x);
          this.scrollerEl.scrollTop = pan.top - (touch.clientY - pan.y);
        }
      },
      { passive: false },
    );
    const end = (event: TouchEvent): void => {
      if (event.touches.length < 2) {
        pinch = null;
      }
      if (event.touches.length === 1) {
        pan = this.panStart(event.touches[0]!);
      } else if (event.touches.length === 0) {
        pan = null;
      }
    };

    this.listen('touchend', end);
    this.listen('touchcancel', end);
  }

  private panStart(touch: Touch): PanStart {
    return {
      x: touch.clientX,
      y: touch.clientY,
      left: this.scrollerEl.scrollLeft,
      top: this.scrollerEl.scrollTop,
    };
  }
}
