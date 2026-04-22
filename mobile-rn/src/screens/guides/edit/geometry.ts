/** Letterbox math for image `contain` inside a box (layout coordinates). */

export function containLayout(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number
): { scale: number; ox: number; oy: number; dw: number; dh: number } {
  if (imgW <= 0 || imgH <= 0 || boxW <= 0 || boxH <= 0) {
    return { scale: 1, ox: 0, oy: 0, dw: boxW, dh: boxH };
  }
  const scale = Math.min(boxW / imgW, boxH / imgH);
  const dw = imgW * scale;
  const dh = imgH * scale;
  const ox = (boxW - dw) / 2;
  const oy = (boxH - dh) / 2;
  return { scale, ox, oy, dw, dh };
}

export function layoutToImage(
  lx: number,
  ly: number,
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number
): { ix: number; iy: number } {
  const { scale, ox, oy } = containLayout(imgW, imgH, boxW, boxH);
  return {
    ix: (lx - ox) / scale,
    iy: (ly - oy) / scale,
  };
}

export function imageRectToLayout(
  cropX: number,
  cropY: number,
  cropW: number,
  cropH: number,
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number
): { left: number; top: number; width: number; height: number } {
  const { scale, ox, oy } = containLayout(imgW, imgH, boxW, boxH);
  return {
    left: ox + cropX * scale,
    top: oy + cropY * scale,
    width: cropW * scale,
    height: cropH * scale,
  };
}

export function clampCrop(
  x: number,
  y: number,
  w: number,
  h: number,
  imgW: number,
  imgH: number,
  minSize = 16
): { x: number; y: number; w: number; h: number } {
  let nx = Math.max(0, Math.min(x, imgW - minSize));
  let ny = Math.max(0, Math.min(y, imgH - minSize));
  let nw = Math.max(minSize, Math.min(w, imgW - nx));
  let nh = Math.max(minSize, Math.min(h, imgH - ny));
  if (nx + nw > imgW) {
    nw = imgW - nx;
  }
  if (ny + nh > imgH) {
    nh = imgH - ny;
  }
  return { x: nx, y: ny, w: nw, h: nh };
}

/**
 * Apply an aspect-ratio lock when resizing from a corner.
 * Given the proposed new rect, snap width or height to match the locked ratio.
 * `anchorX/Y` is the corner that stays fixed (opposite to the dragged corner).
 */
export function applyAspectLock(
  x: number,
  y: number,
  w: number,
  h: number,
  ratio: number | null,
  anchorX: number,
  anchorY: number,
  imgW: number,
  imgH: number
): { x: number; y: number; w: number; h: number } {
  if (!ratio || ratio <= 0) {
    return clampCrop(x, y, w, h, imgW, imgH);
  }
  const newH = w / ratio;
  const newY = anchorY < y ? anchorY : anchorY - newH;
  return clampCrop(x, newY, w, newH, imgW, imgH);
}

/**
 * Hit-test a point against a crop frame.
 * The four corners each claim a `cornerZone × cornerZone` px square.
 * Everything else inside the frame is 'move'.
 * Returns null if the point is outside the frame entirely.
 */
export type HandleKind = 'tl' | 'tr' | 'bl' | 'br' | 'move';

export function hitTestHandle(
  lx: number,
  ly: number,
  frame: { left: number; top: number; width: number; height: number },
  /** Side length of the corner touch zone in layout pixels (default 56). */
  cornerZone = 56
): HandleKind | null {
  const { left, top, width, height } = frame;
  const right = left + width;
  const bottom = top + height;

  if (lx < left || lx > right || ly < top || ly > bottom) {
    return null;
  }

  const inL = lx - left <= cornerZone;
  const inR = right - lx <= cornerZone;
  const inT = ly - top <= cornerZone;
  const inB = bottom - ly <= cornerZone;

  if (inT && inL) { return 'tl'; }
  if (inT && inR) { return 'tr'; }
  if (inB && inL) { return 'bl'; }
  if (inB && inR) { return 'br'; }
  return 'move';
}
