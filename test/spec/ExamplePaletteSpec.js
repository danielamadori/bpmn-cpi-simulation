import TokenSimulationModelerModules from '../..';

import {
  bootstrapModeler,
  getBpmnJS,
  inject,
  injectStyles
} from 'test/TestHelper';

import { expect } from 'chai';

import {
  fitViewportClearOfPalette,
  paletteFootprint,
  viewboxClearOfReserve
} from '../../example/src/fit-viewport';

const exampleStyles = require('../../example/style.css');

const allDiagram = require('../../example/resources/all.bpmn');


injectStyles();


/**
 * Where `inner` lands on screen once `viewbox` is set on a canvas of size
 * `outer`.
 */
function screenBox(inner, outer, viewbox) {
  const scale = outer.width / viewbox.width;

  return {
    left: (inner.x - viewbox.x) * scale,
    right: (inner.x + inner.width - viewbox.x) * scale,
    top: (inner.y - viewbox.y) * scale,
    bottom: (inner.y + inner.height - viewbox.y) * scale
  };
}

/**
 * Ids of the elements whose drawing overlaps the palette's rendered box.
 */
function elementsUnderPalette() {
  return getBpmnJS().invoke(function(canvas, elementRegistry) {
    const palette = canvas.getContainer().querySelector('.djs-palette').getBoundingClientRect();

    const root = canvas.getRootElement();

    return elementRegistry.filter(function(element) {
      if (element === root) {
        return false;
      }

      const box = canvas.getGraphics(element).getBoundingClientRect();

      return box.width > 0 && box.height > 0 &&
        box.right > palette.left && box.left < palette.right &&
        box.bottom > palette.top && box.top < palette.bottom;
    }).map(function(element) {
      return element.id;
    });
  });
}

function rect(selector) {
  return document.querySelector(selector).getBoundingClientRect();
}


describe('example modeler: palette', function() {

  describe('viewboxClearOfReserve', function() {

    const outer = { width: 800, height: 600 };


    it('should equal diagram-js when nothing is reserved and the diagram fits', function() {

      // given
      const inner = { x: 100, y: 50, width: 300, height: 200 };

      // then -- diagram-js keeps the origin: max(inner extent, outer) per axis
      expect(viewboxClearOfReserve(inner, outer, 0)).to.eql({ x: 0, y: 0, width: 800, height: 600 });
    });


    it('should equal diagram-js when nothing is reserved and the diagram is too big', function() {

      // given
      const inner = { x: -50, y: 20, width: 1600, height: 400 };

      // then -- diagram-js: scale min(1, 800 / 1600, 600 / 400), viewbox at the box's corner
      expect(viewboxClearOfReserve(inner, outer, 0)).to.eql({ x: -50, y: 20, width: 1600, height: 1200 });
    });


    it('should keep the origin when the diagram already clears the reserve', function() {

      // given
      const inner = { x: 100, y: 50, width: 300, height: 200 };

      // then
      expect(viewboxClearOfReserve(inner, outer, 88)).to.eql({ x: 0, y: 0, width: 800, height: 600 });
    });


    it('should move a diagram that starts inside the reserve, without shrinking it', function() {

      // given
      const inner = { x: 10, y: 10, width: 300, height: 200 };

      // when
      const viewbox = viewboxClearOfReserve(inner, outer, 88);

      // then
      expect(viewbox.width).to.equal(outer.width);
      expect(screenBox(inner, outer, viewbox).left).to.be.closeTo(88, 1e-9);
    });


    it('should fit a big diagram into the canvas right of the reserve', function() {

      // given
      const inner = { x: -50, y: 20, width: 1600, height: 400 };

      // when
      const viewbox = viewboxClearOfReserve(inner, outer, 88);

      const box = screenBox(inner, outer, viewbox);

      // then
      expect(box.left).to.be.closeTo(88, 1e-9);
      expect(box.right).to.be.closeTo(800, 1e-9);
      expect(box.top).to.be.closeTo(0, 1e-9);
      expect(box.bottom).to.be.at.most(600);
    });


    it('should refuse a canvas with no room right of the reserve', function() {

      // given
      const inner = { x: 0, y: 0, width: 100, height: 100 };

      // then
      expect(function() {
        viewboxClearOfReserve(inner, { width: 80, height: 600 }, 88);
      }).to.throw('a 80x600 canvas leaves no room right of a 88px palette reserve');

      expect(function() {
        viewboxClearOfReserve(inner, { width: 0, height: 0 }, 0);
      }).to.throw('a 0x0 canvas leaves no room right of a 0px palette reserve');
    });

  });


  describe('fitViewportClearOfPalette', function() {

    beforeEach(bootstrapModeler(allDiagram, {
      additionalModules: [
        TokenSimulationModelerModules
      ]
    }));


    it('should draw nothing under the palette', inject(function(canvas) {

      // assume -- diagram-js's own fit draws the diagram's left edge under it
      canvas.zoom('fit-viewport');

      expect(elementsUnderPalette()).not.to.be.empty;

      // when
      fitViewportClearOfPalette(canvas);

      // then
      expect(elementsUnderPalette()).to.be.empty;
    }));


    it('should keep the footprint free when fitted in simulation mode', inject(function(canvas, toggleMode) {

      // given -- the palette is display: none in simulation mode
      toggleMode.toggleMode(true);

      expect(rect('.djs-palette').width).to.equal(0);

      // when
      fitViewportClearOfPalette(canvas);

      toggleMode.toggleMode(false);

      // then -- leaving simulation mode brings the palette back over nothing
      expect(elementsUnderPalette()).to.be.empty;
    }));


    it('should measure the same footprint whether the palette is shown or hidden', inject(function(canvas, toggleMode) {

      // given
      const container = canvas.getContainer();

      const palette = rect('.djs-palette');
      const canvasLeft = container.getBoundingClientRect().left;

      // the palette's left offset, its width, and that offset again
      const rendered = (palette.right - canvasLeft) + (palette.left - canvasLeft);

      // then
      expect(paletteFootprint(container)).to.be.closeTo(rendered, 0.5);

      toggleMode.toggleMode(true);

      expect(paletteFootprint(container)).to.be.closeTo(rendered, 0.5);
    }));


    it('should refuse a canvas without a palette', function() {

      expect(function() {
        paletteFootprint(document.createElement('div'));
      }).to.throw('the canvas container holds no .djs-palette, so there is no footprint to keep clear');
    });

  });


  describe('example stylesheet', function() {

    let style;

    beforeEach(function() {
      style = document.createElement('style');
      style.textContent = exampleStyles;

      document.head.appendChild(style);
    });

    afterEach(function() {
      style.remove();

      document.documentElement.classList.remove('dark-mode');
    });

    beforeEach(bootstrapModeler(allDiagram, {
      additionalModules: [
        TokenSimulationModelerModules
      ]
    }));


    /**
     * The side panels' rule, which the palette and the context pad must not
     * inherit, is in force on a `.group` outside them.
     */
    function expectPanelRuleInForce() {
      const panel = document.createElement('div');
      panel.className = 'group';

      document.body.appendChild(panel);

      const display = window.getComputedStyle(panel).display;

      panel.remove();

      expect(display).to.equal('flex');
    }


    it('should lay out one palette column 46px per entry', inject(function(palette) {

      // assume
      expectPanelRuleInForce();

      // when
      palette._toggleState({ twoColumn: false });

      // then
      const hand = rect('.djs-palette .entry[data-action="hand-tool"]');
      const lasso = rect('.djs-palette .entry[data-action="lasso-tool"]');

      expect(lasso.top - hand.top).to.be.closeTo(46, 0.5);
      expect(lasso.left).to.be.closeTo(hand.left, 0.5);
    }));


    it('should lay out two palette columns side by side', inject(function(palette) {

      // assume
      expectPanelRuleInForce();

      // when
      palette._toggleState({ twoColumn: true });

      // then
      const hand = rect('.djs-palette .entry[data-action="hand-tool"]');
      const lasso = rect('.djs-palette .entry[data-action="lasso-tool"]');

      expect(lasso.top).to.be.closeTo(hand.top, 0.5);
      expect(lasso.left - hand.left).to.be.closeTo(46, 0.5);
    }));


    it('should lay out context pad entries in rows', inject(function(contextPad, elementRegistry) {

      // assume
      expectPanelRuleInForce();

      // when
      contextPad.open(elementRegistry.filter(function(element) {
        return element.type === 'bpmn:Task';
      })[0]);

      // then -- every group of two or more starts a row of them
      const groups = Array.from(document.querySelectorAll('.djs-context-pad.open .group')).filter(function(group) {
        return group.querySelectorAll('.entry').length > 1;
      });

      expect(groups).not.to.be.empty;

      groups.forEach(function(group) {
        const entries = group.querySelectorAll('.entry');

        expect(entries[1].getBoundingClientRect().top).to.be.closeTo(entries[0].getBoundingClientRect().top, 0.5);
      });
    }));


    it('should paint the palette with the dark theme', function() {

      // when
      document.documentElement.classList.add('dark-mode');

      // then -- the side panels' raised surface, and a light icon
      const palette = document.querySelector('.djs-palette');
      const entry = palette.querySelector('.entry');
      const group = palette.querySelector('.group');

      expect(window.getComputedStyle(palette).backgroundColor).to.equal('rgb(58, 58, 58)');
      expect(window.getComputedStyle(entry).color).to.equal('rgb(241, 241, 241)');
      expect(window.getComputedStyle(group).backgroundColor).to.equal('rgba(0, 0, 0, 0)');
    });


    it('should keep the palette inside a short canvas', inject(function(canvas, palette) {

      // given
      canvas.getContainer().style.height = '300px';

      canvas.resized();

      palette._toggleState({});

      // then
      const container = canvas.getContainer().getBoundingClientRect();

      expect(rect('.djs-palette').bottom).to.be.at.most(container.bottom);
    }));

  });

});
