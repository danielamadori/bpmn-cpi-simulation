/**
 * Fitting the diagram to the canvas without drawing any of it under the
 * palette.
 *
 * diagram-js's own `canvas.zoom('fit-viewport')` fits the diagram to the
 * WHOLE canvas. When the diagram does not fit at its own coordinates, the
 * viewbox starts at the diagram's left edge (`Canvas.prototype._fitViewport`,
 * diagram-js 15.18.0 `lib/core/Canvas.js`), so the leftmost element is drawn
 * at the canvas's x = 0. The palette is an absolutely positioned overlay
 * INSIDE the canvas -- `left: 20px`, 48px wide, 94px in two columns -- so
 * whatever lies in the canvas's first 68 to 114 pixels is drawn under it.
 * Measured on `example/resources/all.bpmn` in edit mode: four shapes under the
 * palette at 1600x900 (the start event `ALL_START` among them), eight at
 * 1280x700.
 *
 * What follows is diagram-js's fit, applied to the part of the canvas right
 * of the palette's footprint.
 */


/**
 * How many screen pixels, from the canvas's left edge, the palette takes:
 * its left offset, its width, and the same offset again as a margin on its
 * right.
 *
 * Read from the COMPUTED style, not from the rendered box, because in
 * simulation mode the palette is `display: none`
 * (`.bjs-container.simulation .djs-palette` in
 * `assets/css/bpmn-js-token-simulation.css`) and has no box at all. The
 * footprint is reserved in that mode too: leaving simulation mode is one
 * click, and it must not bring the palette back over a diagram that was
 * fitted as if the palette were not there.
 *
 * @param {HTMLElement} container the canvas container, `canvas.getContainer()`
 *
 * @return {number}
 */
export function paletteFootprint(container) {
  const palette = container.querySelector('.djs-palette');

  if (palette === null) {
    throw new Error('the canvas container holds no .djs-palette, so there is no footprint to keep clear');
  }

  const style = window.getComputedStyle(palette);

  const left = parseFloat(style.left);
  const width = parseFloat(style.width);

  if (!Number.isFinite(left) || !Number.isFinite(width)) {
    throw new Error(
      `the palette's computed left (${ style.left }) and width (${ style.width }) must both be lengths`
    );
  }

  return left + width + left;
}


/**
 * The viewbox diagram-js's `_fitViewport` sets (not centred), computed for a
 * canvas whose leftmost `reserve` screen pixels must stay free.
 *
 * With `reserve` 0 it is exactly diagram-js's result, in both of its branches.
 *
 * @param {{ x: number, y: number, width: number, height: number }} inner the
 *   diagram's bounding box, in diagram coordinates (`canvas.viewbox().inner`)
 * @param {{ width: number, height: number }} outer the canvas size, in screen
 *   pixels (`canvas.viewbox().outer`)
 * @param {number} reserve screen pixels to keep free at the canvas's left
 *
 * @return {{ x: number, y: number, width: number, height: number }}
 */
export function viewboxClearOfReserve(inner, outer, reserve) {
  const availableWidth = outer.width - reserve;

  if (availableWidth <= 0 || outer.height <= 0) {
    throw new Error(
      `a ${ outer.width }x${ outer.height } canvas leaves no room right of a ${ reserve }px palette reserve`
    );
  }

  // The diagram already lies in the free part of the canvas at its own
  // coordinates and at scale 1: diagram-js leaves the origin where it is,
  // and so does this.
  if (
    inner.x >= reserve &&
    inner.y >= 0 &&
    inner.x + inner.width <= outer.width &&
    inner.y + inner.height <= outer.height
  ) {
    return {
      x: 0,
      y: 0,
      width: outer.width,
      height: outer.height
    };
  }

  // Never zoomed in beyond 1, as in diagram-js. An empty diagram has a 0x0
  // box, which makes both ratios Infinity and leaves the scale at 1.
  const scale = Math.min(1, availableWidth / inner.width, outer.height / inner.height);

  return {
    x: inner.x - reserve / scale,
    y: inner.y,
    width: outer.width / scale,
    height: outer.height / scale
  };
}


/**
 * Fit the whole diagram into the canvas, right of the palette.
 *
 * @param {Object} canvas the diagram-js `canvas` service
 */
export function fitViewportClearOfPalette(canvas) {
  const { inner, outer } = canvas.viewbox();

  canvas.viewbox(viewboxClearOfReserve(inner, outer, paletteFootprint(canvas.getContainer())));
}
