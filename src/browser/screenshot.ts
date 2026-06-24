// Capture + in-browser annotation. The browser does the compositing — we inject
// CSS + DOM nodes (rectangles, SVG arrows, labels) before page.screenshot(),
// which avoids any native image-processing dependency.

import type { Page } from 'playwright';

export interface Annotation {
  selector?: string;
  coords?: { x: number; y: number; width?: number; height?: number };
  kind: 'arrow' | 'highlight' | 'circle';
  label?: string;
}

export interface CaptureOptions {
  wait_for?: string;
  viewport?: { width: number; height: number };
  annotations?: Annotation[];
  clip_to_selector?: string;
}

export interface CaptureResult {
  buffer: Uint8Array;
  width: number;
  height: number;
  capturedAt: string;
}

const ANNOTATION_CSS = `
.kb-anno-highlight, .kb-anno-circle {
  position: fixed;
  pointer-events: none;
  z-index: 2147483647;
  border: 4px solid #f97316;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.18);
}
.kb-anno-highlight { border-radius: 6px; }
.kb-anno-circle   { border-radius: 50%; box-shadow: none; }
.kb-anno-label {
  position: fixed;
  background: #f97316;
  color: #fff;
  font: 600 14px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  padding: 6px 10px;
  border-radius: 6px;
  pointer-events: none;
  z-index: 2147483647;
  box-shadow: 0 2px 8px rgba(0,0,0,.18);
  white-space: nowrap;
}
.kb-anno-arrow-svg {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 2147483647;
  overflow: visible;
}
`;

export async function performCapture(page: Page, opts: CaptureOptions): Promise<CaptureResult> {
  if (opts.viewport) {
    await page.setViewportSize(opts.viewport);
  }

  if (opts.wait_for) {
    await page.waitForSelector(opts.wait_for, { timeout: 15000 });
  } else {
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  }

  let clip: { x: number; y: number; width: number; height: number } | undefined;
  if (opts.clip_to_selector) {
    const handle = await page.$(opts.clip_to_selector);
    if (!handle) {
      throw new Error(`clip_to_selector not found: ${opts.clip_to_selector}`);
    }
    const box = await handle.boundingBox();
    if (!box) {
      throw new Error(`clip_to_selector has no bounding box: ${opts.clip_to_selector}`);
    }
    clip = { x: box.x, y: box.y, width: box.width, height: box.height };
  }

  if (opts.annotations && opts.annotations.length > 0) {
    await page.addStyleTag({ content: ANNOTATION_CSS });
    for (const anno of opts.annotations) {
      await drawAnnotation(page, anno);
    }
    // Allow the browser one frame + a small buffer to layout the overlays.
    await page.waitForTimeout(150);
  }

  const buffer = await page.screenshot({
    type: 'png',
    fullPage: !clip,
    clip,
  });

  const viewport = page.viewportSize();
  return {
    buffer,
    width: clip?.width ?? viewport?.width ?? 1440,
    height: clip?.height ?? viewport?.height ?? 900,
    capturedAt: new Date().toISOString(),
  };
}

async function drawAnnotation(page: Page, anno: Annotation): Promise<void> {
  let rect: { x: number; y: number; width: number; height: number } | null = null;
  if (anno.selector) {
    const handle = await page.$(anno.selector);
    if (!handle) {
      console.error(`pylon-kb-mcp: annotation selector not found, skipping: ${anno.selector}`);
      return;
    }
    const box = await handle.boundingBox();
    if (!box) return;
    rect = box;
  } else if (anno.coords) {
    rect = {
      x: anno.coords.x,
      y: anno.coords.y,
      width: anno.coords.width ?? 24,
      height: anno.coords.height ?? 24,
    };
  }
  if (!rect) return;

  await page.evaluate(
    ({ rect, kind, label }) => {
      const PAD = 6;

      if (kind === 'highlight') {
        const div = document.createElement('div');
        div.className = 'kb-anno-highlight';
        Object.assign(div.style, {
          left: `${rect.x - PAD}px`,
          top: `${rect.y - PAD}px`,
          width: `${rect.width + PAD * 2}px`,
          height: `${rect.height + PAD * 2}px`,
        });
        document.body.appendChild(div);
      } else if (kind === 'circle') {
        const size = Math.max(rect.width, rect.height) + PAD * 4;
        const div = document.createElement('div');
        div.className = 'kb-anno-circle';
        Object.assign(div.style, {
          left: `${rect.x + rect.width / 2 - size / 2}px`,
          top: `${rect.y + rect.height / 2 - size / 2}px`,
          width: `${size}px`,
          height: `${size}px`,
        });
        document.body.appendChild(div);
      } else if (kind === 'arrow') {
        const ARROW_LEN = 90;
        const targetX = rect.x;
        const targetY = rect.y + rect.height / 2;
        const startX = Math.max(targetX - ARROW_LEN, 12);
        const startY = targetY;

        const svgNS = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(svgNS, 'svg');
        svg.setAttribute('class', 'kb-anno-arrow-svg');
        svg.setAttribute('viewBox', `0 0 ${window.innerWidth} ${window.innerHeight}`);

        const defs = document.createElementNS(svgNS, 'defs');
        const marker = document.createElementNS(svgNS, 'marker');
        const markerId = `kb-anno-head-${Math.random().toString(36).slice(2)}`;
        marker.setAttribute('id', markerId);
        marker.setAttribute('viewBox', '0 0 10 10');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '5');
        marker.setAttribute('markerWidth', '6');
        marker.setAttribute('markerHeight', '6');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS(svgNS, 'polygon');
        polygon.setAttribute('points', '0,0 10,5 0,10');
        polygon.setAttribute('fill', '#f97316');
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);

        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', String(startX));
        line.setAttribute('y1', String(startY));
        line.setAttribute('x2', String(targetX - 4));
        line.setAttribute('y2', String(targetY));
        line.setAttribute('stroke', '#f97316');
        line.setAttribute('stroke-width', '4');
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('marker-end', `url(#${markerId})`);
        svg.appendChild(line);
        document.body.appendChild(svg);

        if (label) {
          const lbl = document.createElement('div');
          lbl.className = 'kb-anno-label';
          lbl.textContent = label;
          Object.assign(lbl.style, {
            left: `${Math.max(8, startX - 24)}px`,
            top: `${Math.max(8, startY - 36)}px`,
          });
          document.body.appendChild(lbl);
        }
      }
    },
    { rect, kind: anno.kind, label: anno.label ?? null },
  );
}
