// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { MapViewport } from '../src/obsidian/map/viewport';
import { readViewportState } from '../src/core/render/viewport-state';
import { installObsidianDom } from './stubs/obsidian-dom';

installObsidianDom();
Object.assign(HTMLElement.prototype, {
  setCssStyles(this: HTMLElement, styles: Partial<CSSStyleDeclaration>) {
    Object.assign(this.style, styles);
  },
});

function open() {
  const scroller = document.createElement('div');
  const surface = scroller.appendChild(document.createElement('div'));
  const canvas = surface.appendChild(document.createElement('div'));
  const viewport = new MapViewport(scroller, surface, canvas);

  viewport.sizeSurface(4000, 3000);

  return { viewport, scroller, surface, canvas };
}

describe('remembered viewport', () => {
  it('restores zoom and both positions in a new viewport after layout', () => {
    const first = open();

    first.viewport.restore(1.4);
    first.scroller.scrollLeft = 2345;
    first.scroller.scrollTop = 2678;
    const stored: unknown = JSON.parse(
      JSON.stringify(first.viewport.snapshot()),
    );

    first.viewport.destroy();
    const second = open();
    const state = readViewportState(stored)!;

    second.viewport.restorePosition(state);
    second.viewport.sizeSurface(5000, 4000);
    expect(second.viewport.snapshot()).toEqual(state);
    expect(second.canvas.style.transform).toBe('scale(1.4)');
    second.viewport.destroy();
  });

  it('centers a node by scrolling only the map viewport', () => {
    const { viewport, scroller, canvas } = open();
    const node = canvas.appendChild(document.createElement('div'));

    vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(100, 100, 400, 300),
    );
    vi.spyOn(node, 'getBoundingClientRect').mockReturnValue(
      new DOMRect(350, 280, 100, 40),
    );
    viewport.centerElement(node);

    expect(scroller.scrollLeft).toBe(260);
    expect(scroller.scrollTop).toBe(210);
    viewport.destroy();
  });

  it('sizes the scroll range to the current zoom and centers small maps', () => {
    const { viewport, scroller, surface, canvas } = open();

    Object.defineProperties(scroller, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
    });
    viewport.refreshViewportSize();
    expect(surface.style.width).toBe('4320px');
    expect(surface.style.height).toBe('3320px');

    viewport.restore(0.05);
    expect(canvas.style.left).toBe('460px');
    expect(canvas.style.top).toBe('385px');
    expect(surface.style.width).toBe('1120px');
    expect(surface.style.height).toBe('920px');
    viewport.destroy();
  });

  it('moves an unreachable legacy position to the smaller scroll range', () => {
    const { viewport, scroller, surface } = open();

    Object.defineProperties(scroller, {
      clientWidth: { value: 800 },
      clientHeight: { value: 600 },
      scrollWidth: { get: () => Number.parseFloat(surface.style.width) },
      scrollHeight: { get: () => Number.parseFloat(surface.style.height) },
    });
    viewport.sizeSurface(600, 400);
    viewport.restorePosition({ zoom: 1, left: 2048, top: 2048 });
    expect(viewport.snapshot()).toEqual({ zoom: 1, left: 260, top: 260 });
    viewport.destroy();
  });

  it.each([
    null,
    {},
    { zoom: 0, left: 1, top: 2 },
    { zoom: 1, left: -1, top: 2 },
    { zoom: 1, left: 1, top: Infinity },
    { zoom: '1', left: 1, top: 2 },
  ])('ignores invalid stored data: %j', (value) => {
    expect(readViewportState(value)).toBeNull();
  });
});

describe('canvas gestures', () => {
  it('moves both axes during a two-finger scroll, even as its speed changes', () => {
    const { viewport, scroller } = open();
    const dispatchWheel = (deltaX: number, deltaY: number) => {
      const event = new WheelEvent('wheel', {
        bubbles: true,
        cancelable: true,
        deltaX,
        deltaY,
      });

      scroller.dispatchEvent(event);

      return event;
    };

    expect(dispatchWheel(18, 22).defaultPrevented).toBe(true);
    expect(dispatchWheel(35, 95).defaultPrevented).toBe(true);
    expect(scroller.scrollLeft).toBe(213);
    expect(scroller.scrollTop).toBe(277);
    expect(viewport.value).toBe(1);
    viewport.destroy();
  });

  it('keeps a coarse mouse wheel and trackpad pinch for zoom', () => {
    const wheel = open();
    const coarse = new WheelEvent('wheel', {
      cancelable: true,
      deltaY: 100,
    });

    wheel.scroller.dispatchEvent(coarse);
    expect(coarse.defaultPrevented).toBe(true);
    wheel.viewport.destroy();

    const pinch = open();
    const gesture = new WheelEvent('wheel', {
      cancelable: true,
      ctrlKey: true,
      deltaY: 4,
    });

    pinch.scroller.dispatchEvent(gesture);
    expect(gesture.defaultPrevented).toBe(true);
    pinch.viewport.destroy();
  });

  it('switches a fast scroll to panning as soon as it gains a horizontal axis', () => {
    const { viewport, scroller } = open();
    const first = new WheelEvent('wheel', {
      cancelable: true,
      deltaY: 100,
    });
    const diagonal = new WheelEvent('wheel', {
      cancelable: true,
      deltaX: 20,
      deltaY: 30,
    });

    scroller.dispatchEvent(first);
    scroller.dispatchEvent(diagonal);

    expect(first.defaultPrevented).toBe(true);
    expect(diagonal.defaultPrevented).toBe(true);
    expect(scroller.scrollLeft).toBe(180);
    expect(scroller.scrollTop).toBe(190);
    expect(viewport.value).toBe(1);
    viewport.destroy();
  });

  it('pans with two touching fingers without changing zoom', () => {
    const { viewport, scroller } = open();
    const touch = (type: string, points: [number, number][]) => {
      const event = new Event(type, { cancelable: true });

      Object.defineProperty(event, 'touches', {
        value: points.map(([clientX, clientY]) => ({ clientX, clientY })),
      });
      scroller.dispatchEvent(event);
    };

    touch('touchstart', [
      [100, 100],
      [200, 100],
    ]);
    touch('touchmove', [
      [120, 130],
      [220, 130],
    ]);

    expect(viewport.value).toBe(1);
    expect(scroller.scrollLeft).toBe(140);
    expect(scroller.scrollTop).toBe(130);
    viewport.destroy();
  });
});
