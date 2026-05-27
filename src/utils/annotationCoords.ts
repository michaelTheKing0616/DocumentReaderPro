/**
 * Normalized annotation coordinates (0–1) relative to page content size.
 * Enables correct rendering when PDF zoom / layout changes.
 */
export interface NormalizedRect {
  xNorm: number;
  yNorm: number;
  widthNorm: number;
  heightNorm: number;
}

export function toNormalizedRect(
  x: number,
  y: number,
  width: number,
  height: number,
  layoutWidth: number,
  layoutHeight: number
): NormalizedRect {
  const w = Math.max(layoutWidth, 1);
  const h = Math.max(layoutHeight, 1);
  return {
    xNorm: x / w,
    yNorm: y / h,
    widthNorm: Math.abs(width) / w,
    heightNorm: Math.abs(height) / h,
  };
}

export function fromNormalizedRect(
  rect: NormalizedRect,
  layoutWidth: number,
  layoutHeight: number
): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.xNorm * layoutWidth,
    y: rect.yNorm * layoutHeight,
    width: rect.widthNorm * layoutWidth,
    height: rect.heightNorm * layoutHeight,
  };
}

export function denormalizeAnnotation<T extends { x: number; y: number; width?: number; height?: number }>(
  annotation: T,
  layoutWidth: number,
  layoutHeight: number
): T & { x: number; y: number; width: number; height: number } {
  const w = layoutWidth;
  const h = layoutHeight;
  const usesNorm =
    annotation.x >= 0 &&
    annotation.x <= 1 &&
    annotation.y >= 0 &&
    annotation.y <= 1 &&
    (annotation.width ?? 0) <= 1;

  if (!usesNorm) {
    return {
      ...annotation,
      width: annotation.width ?? 80,
      height: annotation.height ?? 24,
    };
  }

  const denorm = fromNormalizedRect(
    {
      xNorm: annotation.x,
      yNorm: annotation.y,
      widthNorm: annotation.width ?? 0.1,
      heightNorm: annotation.height ?? 0.03,
    },
    w,
    h
  );
  return { ...annotation, ...denorm };
}

export function normalizeAnnotationCoords(
  x: number,
  y: number,
  width: number,
  height: number,
  layoutWidth: number,
  layoutHeight: number
): { x: number; y: number; width: number; height: number } {
  const norm = toNormalizedRect(x, y, width, height, layoutWidth, layoutHeight);
  return {
    x: norm.xNorm,
    y: norm.yNorm,
    width: norm.widthNorm,
    height: norm.heightNorm,
  };
}
