/**
 * Canvas API Guard
 * Protects 2D canvas operations against non-finite floating point values (NaN, Infinity, undefined)
 * preventing browser engine DOMExceptions such as:
 * "CanvasRenderingContext2D.createLinearGradient: Argument 2 is not a finite floating-point value."
 */

let isInstalled = false;

export function installCanvasGuard() {
  if (isInstalled || typeof window === 'undefined' || !window.CanvasRenderingContext2D) {
    return;
  }
  isInstalled = true;

  const proto = CanvasRenderingContext2D.prototype;

  // 1. Guard createLinearGradient
  const originalCreateLinearGradient = proto.createLinearGradient;
  proto.createLinearGradient = function (
    x0: number,
    y0: number,
    x1: number,
    y1: number
  ): CanvasGradient {
    const safeX0 = Number.isFinite(x0) ? x0 : 0;
    const safeY0 = Number.isFinite(y0) ? y0 : 0;
    const safeX1 = Number.isFinite(x1) ? x1 : safeX0;
    let safeY1 = Number.isFinite(y1) ? y1 : safeY0 + 1;

    // Both points identical creates an empty gradient in some browsers, ensure non-zero distance if identical
    if (safeX0 === safeX1 && safeY0 === safeY1) {
      safeY1 = safeY0 + 1;
    }

    if (!Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(x1) || !Number.isFinite(y1)) {
      console.warn('CanvasGuard: Sanitized non-finite createLinearGradient coords:', { x0, y0, x1, y1 });
    }

    return originalCreateLinearGradient.call(this, safeX0, safeY0, safeX1, safeY1);
  };

  // 2. Guard createRadialGradient
  const originalCreateRadialGradient = proto.createRadialGradient;
  proto.createRadialGradient = function (
    x0: number,
    y0: number,
    r0: number,
    x1: number,
    y1: number,
    r1: number
  ): CanvasGradient {
    const safeX0 = Number.isFinite(x0) ? x0 : 0;
    const safeY0 = Number.isFinite(y0) ? y0 : 0;
    const safeR0 = Number.isFinite(r0) && r0 >= 0 ? r0 : 0;
    const safeX1 = Number.isFinite(x1) ? x1 : safeX0;
    const safeY1 = Number.isFinite(y1) ? y1 : safeY0;
    let safeR1 = Number.isFinite(r1) && r1 >= 0 ? r1 : 1;

    if (safeR1 <= 0 && safeR0 <= 0) {
      safeR1 = 1;
    }

    if (
      !Number.isFinite(x0) || !Number.isFinite(y0) || !Number.isFinite(r0) ||
      !Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(r1)
    ) {
      console.warn('CanvasGuard: Sanitized non-finite createRadialGradient coords:', { x0, y0, r0, x1, y1, r1 });
    }

    return originalCreateRadialGradient.call(this, safeX0, safeY0, safeR0, safeX1, safeY1, safeR1);
  };

  // 3. Guard arc
  const originalArc = proto.arc;
  proto.arc = function (
    x: number,
    y: number,
    radius: number,
    startAngle: number,
    endAngle: number,
    counterclockwise?: boolean
  ): void {
    const safeX = Number.isFinite(x) ? x : 0;
    const safeY = Number.isFinite(y) ? y : 0;
    const safeR = Number.isFinite(radius) && radius >= 0 ? radius : 0;
    const safeStart = Number.isFinite(startAngle) ? startAngle : 0;
    const safeEnd = Number.isFinite(endAngle) ? endAngle : Math.PI * 2;

    return originalArc.call(this, safeX, safeY, safeR, safeStart, safeEnd, counterclockwise);
  };
}

// Automatically install on module evaluation in browser environments
if (typeof window !== 'undefined') {
  installCanvasGuard();
}
