// Fitting the map to a route, a trip or a journey so that nothing of it ends up under what lies over
// the map (the filter button and counter at the top, the tab bar, the round buttons) or off its edge.
// Rectangles here are { left, top, right, bottom } in pixels from the map's top left corner.

// Free space kept between the fitted thing and the nearest edge or control
export const FIT_MARGIN = 24;
// Free space kept between a stop's label box and the nearest edge or control
export const LABEL_MARGIN = 6;
// A control wider than this share of the map is cleared by keeping below/above it, a narrower one by keeping beside it
const WIDE = 0.4;

/**
 * The part of the map that is free of controls.
 * @param size - { width, height } of the map
 * @param topControlsBottom - how far down the controls at the top reach (0 without any)
 * @param tabBarHeight - the tab bar lies over the map's bottom edge
 * @param buttons - rectangle of the buttons in the bottom right corner, or null
 */
export function freeArea({ size, topControlsBottom = 0, tabBarHeight = 0, buttons = null }) {
  const area = { left: 0, top: Math.max(0, topControlsBottom), right: size.width, bottom: size.height - tabBarHeight };
  if (buttons && buttons.right > buttons.left && buttons.bottom > buttons.top) {
    if (buttons.right - buttons.left > size.width * WIDE) {
      area.bottom = Math.min(area.bottom, buttons.top);
    } else {
      area.right = Math.min(area.right, buttons.left);
    }
  }
  return area;
}

/** The padding for MapLibre's fitBounds that keeps the fitted points `margin` inside `area` */
export function paddingFor(size, area, margin = FIT_MARGIN) {
  return {
    top: Math.round(area.top + margin),
    left: Math.round(area.left + margin),
    right: Math.round(size.width - area.right + margin),
    bottom: Math.round(size.height - area.bottom + margin),
  };
}

/** How far the boxes stick out of `area` (less `margin`) on each side; 0 where they don't */
export function overflowOf(area, boxes, margin = LABEL_MARGIN) {
  const over = { top: 0, left: 0, right: 0, bottom: 0 };
  for (const box of boxes) {
    over.top = Math.max(over.top, area.top + margin - box.top);
    over.left = Math.max(over.left, area.left + margin - box.left);
    over.right = Math.max(over.right, box.right - (area.right - margin));
    over.bottom = Math.max(over.bottom, box.bottom - (area.bottom - margin));
  }
  return over;
}

export const hasOverflow = (over) => over.top > 0 || over.left > 0 || over.right > 0 || over.bottom > 0;

/**
 * `padding` grown by what stuck out. null when that leaves the map no room to fit anything in
 * (less than `minRoom` pixels across or down) - the caller then keeps the fit it has.
 */
export function grownPadding(padding, over, size, minRoom = 60) {
  const next = {
    top: padding.top + Math.ceil(over.top),
    left: padding.left + Math.ceil(over.left),
    right: padding.right + Math.ceil(over.right),
    bottom: padding.bottom + Math.ceil(over.bottom),
  };
  if (size.width - next.left - next.right < minRoom || size.height - next.top - next.bottom < minRoom) return null;
  return next;
}

/** Does any of the boxes (points are boxes without size) come within `margin` of the rectangle `control`? */
export function anyUnder(control, boxes, margin = LABEL_MARGIN) {
  return boxes.some(box =>
    box.left < control.right + margin && box.right > control.left - margin &&
    box.top < control.bottom + margin && box.bottom > control.top - margin);
}
