/* global module */

/**
 * Rule: no-diagram-overlaps
 *
 * Reports an ERROR wherever the DIAGRAM draws one thing on top of another,
 * read from the DI alone: `bpmndi:BPMNShape` bounds, the `bpmndi:BPMNLabel`
 * bounds inside shapes and edges, and `bpmndi:BPMNEdge` waypoints. Five kinds:
 *
 *   1. two shapes that overlap, unless one is a frame (a pool, a lane, a
 *      group), one contains the other in the model (a subprocess and its
 *      children) or one is a boundary event on the other;
 *   2. a label that overlaps a shape (its own included: text drawn over the
 *      symbol it names) or another label, or that crosses the border of a
 *      pool, a lane, a group or an expanded subprocess;
 *   3. an edge segment that passes through a shape other than the edge's own
 *      source or target;
 *   4. an edge segment that runs over a label other than the edge's own;
 *   5. two edges drawn along the same line for more than a few pixels.
 *
 * Each finding names both elements and where they meet, in diagram
 * coordinates. It is reported on one of the two: the first shape in DI order
 * in (1), the element whose label it is in (2), the edge in (3) and (4), the
 * first edge in DI order in (5) -- the other one when the first has no model
 * element to report on.
 *
 * WHAT IS CHECKED IS DECIDED BY THE DI, NOT BY THE MODEL. Every BPMNShape with
 * bounds and every BPMNEdge with two waypoints is something a reader sees, so
 * every one takes part, whatever its element is:
 *
 *   - an EXTENSION element such as BOS's `sese:assetShape` (a `bpmn:Artifact`
 *     in BOS's `sese.json`), which BOS draws at its DI bounds. Picking shapes
 *     by BPMN type is exactly how bpmnlint's `no-overlapping-elements` misses
 *     such a box drawn over a task: measured on 2026-10-29, 0 findings on the
 *     box with its schema loaded and resolving, 2 on a start event moved onto
 *     the same task in the same run;
 *   - a DI entry whose `bpmnElement` did NOT RESOLVE, because the moddle
 *     reading the file lacks the extension's schema -- as the bpmnlint CLI
 *     does with this repository's `.bpmnlintrc` (no `moddleExtensions`), and
 *     this repository's modeller, which registers no `sese` schema; the one in
 *     `example/resources/sese.json` describes `Duration` only. The box is
 *     still in the file and BOS still draws it there; a diagram is judged by
 *     what it draws, not by what one reader of it can parse. Such a shape is
 *     named by its DI id. An edge drawn to it has no model end on that side,
 *     so the shape under the edge's first or last waypoint is taken as that
 *     end.
 *
 * Labels are the exception, and on evidence: an external label is drawn only
 * for the element types bpmn-js draws one for (`BpmnImporter.add`), and BOS
 * draws an asset box's text from the box's own bounds, inside it or under it
 * (`drawAssetFigure` in BOS's `assetShapeRenderer.ts`), never at DI label
 * bounds.
 *
 * WHAT IT DOES NOT SEE. A label is checked only where the DI gives its bounds;
 * one without them is placed by the modeller at render time, and nothing here
 * guesses where. The same holds for text a renderer draws outside its own
 * shape, as BOS does under an asset box drawn as a file page. Shapes are compared as their bounding boxes, which is how
 * bpmn-js itself lays them out, so a label tucked into the corner of a
 * gateway's box counts even where the diamond leaves that corner empty.
 * Pools, lanes and groups are frames, not obstacles: an edge may cross them
 * (a message flow must), and only a label straddling their border is reported.
 *
 * bpmnlint's own `no-overlapping-elements` (in `bpmnlint:recommended`) also
 * reports (1) between sibling flow elements and pools, as "Element overlaps
 * with other element" without naming the other one. This rule names both,
 * compares shapes across nesting levels and element types, and adds (2) to
 * (5).
 */


/**
 * How far two drawn things may overlap and still read as touching.
 *
 * bpmn-js strokes every shape outline and every edge 2px wide (`shapeStyle`
 * and `lineStyle` in bpmn-js `lib/draw/BpmnRenderer.js`), and modellers write
 * DI in whole pixels. Two boxes overlapping by no more than that, a line
 * entering a box by no more than that, or two lines whose centres are no more
 * than that apart, are what a layout placing things edge to edge produces.
 */
const STROKE_PX = 2;

/**
 * How long two edges may run along the same line and still read as meeting.
 *
 * Two edges leaving or entering the same docking point meet there by
 * construction, and with waypoints rounded to whole pixels that contact can
 * stretch a few pixels along a common line. Longer than this, a visible length
 * of one edge is drawn over the other.
 */
const MIN_SHARED_LENGTH_PX = 5;


module.exports = function() {

  function check(node, reporter) {

    if (!is(node, 'bpmndi:BPMNPlane')) {
      return;
    }

    const drawing = readPlane(node);

    reportShapeOverlaps(drawing, reporter);
    reportLabelOverlaps(drawing, reporter);
    reportEdgesThroughShapes(drawing, reporter);
    reportEdgesOverLabels(drawing, reporter);
    reportSharedLines(drawing, reporter);
  }

  return { check: check };
};


// the five checks ///////////////

function reportShapeOverlaps(drawing, reporter) {

  const obstacles = drawing.shapes.filter(function(shape) {
    return !shape.frame;
  });

  forEachPair(obstacles, function(a, b) {

    if (belongTogether(a.element, b.element)) {
      return;
    }

    const overlap = intersection(a.box, b.box);

    if (overlap) {
      reporter.report(
        reportedId(a, b),
        `Shape ${ name(a) } overlaps shape ${ name(b) } at ${ area(overlap) }`
      );
    }
  });
}

function reportLabelOverlaps(drawing, reporter) {

  drawing.labels.forEach(function(label) {

    drawing.shapes.forEach(function(shape) {

      if (shape.container) {

        // a frame's own label sits on the frame by design
        if (shape.element === label.element) {
          return;
        }

        if (intersection(label.box, shape.box) && !contains(shape.box, label.box)) {
          reporter.report(
            label.element.id,
            `Label of ${ describe(label.element) } at ${ area(label.box) } crosses the border of ${ name(shape) }`
          );
        }

        return;
      }

      const overlap = intersection(label.box, shape.box);

      if (overlap) {
        reporter.report(
          label.element.id,
          `Label of ${ describe(label.element) } overlaps shape ${ name(shape) } at ${ area(overlap) }`
        );
      }
    });
  });

  forEachPair(drawing.labels, function(a, b) {

    const overlap = intersection(a.box, b.box);

    if (overlap) {
      reporter.report(
        a.element.id,
        `Label of ${ describe(a.element) } overlaps the label of ${ describe(b.element) } at ${ area(overlap) }`
      );
    }
  });
}

function reportEdgesThroughShapes(drawing, reporter) {

  drawing.edges.forEach(function(edge) {

    drawing.shapes.forEach(function(shape) {

      // pools, lanes and groups are frames an edge may cross
      if (edge.ends.indexOf(shape) !== -1 || shape.frame) {
        return;
      }

      // an expanded subprocess is crossed legitimately only by edges that
      // start or end inside it
      if (shape.container) {

        const endsInside = edge.ends.some(function(end) {
          return end.element !== undefined && isAncestor(shape.element, end.element);
        });

        if (endsInside) {
          return;
        }
      }

      const crossings = clipPolyline(edge.points, shape.box);

      if (crossings.length) {
        reporter.report(
          reportedId(edge, shape),
          `Edge ${ name(edge) } passes through shape ${ name(shape) } ${ stretches(crossings) }`
        );
      }
    });
  });
}

function reportEdgesOverLabels(drawing, reporter) {

  drawing.edges.forEach(function(edge) {

    drawing.labels.forEach(function(label) {

      if (label.element === edge.element) {
        return;
      }

      const crossings = clipPolyline(edge.points, label.box);

      if (crossings.length) {
        reporter.report(
          reportedId(edge, label),
          `Edge ${ name(edge) } runs over the label of ${ describe(label.element) } ${ stretches(crossings) }`
        );
      }
    });
  });
}

function reportSharedLines(drawing, reporter) {

  forEachPair(drawing.edges, function(a, b) {

    const pieces = [];

    segments(a.points).forEach(function(segmentA) {
      segments(b.points).forEach(function(segmentB) {

        const piece = sharedPiece(segmentA, segmentB);

        if (piece) {
          pieces.push(piece);
        }
      });
    });

    // a waypoint in the middle of a straight run splits one shared stretch
    // into pieces: they are joined before they are measured
    const shared = joinPieces(pieces).filter(function(stretch) {
      return distance(stretch.from, stretch.to) > MIN_SHARED_LENGTH_PX;
    });

    if (shared.length) {
      const length = shared.reduce(function(sum, stretch) {
        return sum + distance(stretch.from, stretch.to);
      }, 0);

      reporter.report(
        reportedId(a, b),
        `Edge ${ name(a) } and edge ${ name(b) } run along the same line for ` +
        `${ Math.round(length) }px ${ stretches(shared) }`
      );
    }
  });
}


// reading the DI ///////////////

/**
 * The shapes, labels and edges one plane draws.
 *
 * Every shape with bounds and every edge with two waypoints, whether or not
 * its `bpmnElement` resolved (see the header). A shape without bounds and an
 * edge with fewer than two waypoints draw nothing, so they are left out.
 */
function readPlane(plane) {

  const shapes = [];
  const labels = [];
  const edges = [];

  plane.get('planeElement').forEach(function(di) {

    // undefined when the reference did not resolve
    const element = di.bpmnElement;

    if (is(di, 'bpmndi:BPMNShape') && di.bounds) {
      shapes.push({
        di: di,
        element: element,
        box: toBox(di.bounds),
        frame: isFrame(element),
        container: isFrame(element) || isExpandedSubProcess(element, di)
      });
    }

    if (is(di, 'bpmndi:BPMNEdge') && di.get('waypoint').length > 1) {
      edges.push({
        di: di,
        element: element,
        points: di.get('waypoint').map(function(waypoint) {
          return { x: waypoint.x, y: waypoint.y };
        })
      });
    }

    // `di.label` is optional in BPMN DI, and bpmn-js draws an external label
    // only for the element types below and only when there is text to draw
    if (di.label && di.label.bounds && isLabelExternal(element) && labelText(element)) {
      labels.push({
        di: di,
        element: element,
        box: toBox(di.label.bounds)
      });
    }
  });

  edges.forEach(function(edge) {
    edge.ends = endShapes(edge, shapes);
  });

  return {
    shapes: shapes,
    labels: labels,
    edges: edges
  };
}

/**
 * Pools, lanes and groups: shapes drawn as a frame around others rather than
 * as an obstacle.
 */
function isFrame(element) {
  return is(element, 'bpmn:Participant') ||
    is(element, 'bpmn:Lane') ||
    is(element, 'bpmn:Group');
}

function isExpandedSubProcess(element, di) {
  return is(element, 'bpmn:SubProcess') && di.isExpanded === true;
}

/**
 * The shapes an edge is drawn between.
 *
 * The model's references say which, and a data association's activity is
 * not among them: bpmn-js draws a data association to or from its parent. A
 * side the model cannot name -- its reference unresolved, or the edge's own
 * element unresolved -- is the shape under the edge's waypoint on that side,
 * which is where the DI draws the edge to.
 */
function endShapes(edge, shapes) {

  const connection = edge.element;

  const sources = references(connection, 'sourceRef');
  const targets = references(connection, 'targetRef');

  if (is(connection, 'bpmn:DataOutputAssociation')) {
    sources.push(connection.$parent);
  }

  if (is(connection, 'bpmn:DataInputAssociation')) {
    targets.push(connection.$parent);
  }

  const first = edge.points[0];
  const last = edge.points[edge.points.length - 1];

  return shapes.filter(function(shape) {

    if (shape.element !== undefined && (sources.indexOf(shape.element) !== -1 || targets.indexOf(shape.element) !== -1)) {
      return true;
    }

    return (sources.length === 0 && covers(shape.box, first)) ||
      (targets.length === 0 && covers(shape.box, last));
  });
}

/**
 * The elements a connection's reference resolved to: a list on data
 * associations, a single element elsewhere, nothing when it did not resolve
 * or the edge's element itself did not.
 */
function references(connection, name) {

  if (connection === undefined) {
    return [];
  }

  const value = connection.get(name);

  if (Array.isArray(value)) {
    return value.slice();
  }

  return value === undefined ? [] : [ value ];
}

/**
 * The element types whose label bpmn-js draws outside the shape, at the
 * DI's label bounds (`isLabelExternal` in bpmn-js `lib/util/LabelUtil.js`).
 * Every other type draws its name inside its own shape.
 */
function isLabelExternal(element) {
  return is(element, 'bpmn:Event') ||
    is(element, 'bpmn:Gateway') ||
    is(element, 'bpmn:DataStoreReference') ||
    is(element, 'bpmn:DataObjectReference') ||
    is(element, 'bpmn:DataInput') ||
    is(element, 'bpmn:DataOutput') ||
    is(element, 'bpmn:SequenceFlow') ||
    is(element, 'bpmn:MessageFlow') ||
    is(element, 'bpmn:Group');
}

/**
 * The text bpmn-js draws as the element's label (`getLabel` in bpmn-js
 * `lib/util/LabelUtil.js`): a group's category value, everybody else's name.
 */
function labelText(element) {

  if (is(element, 'bpmn:Group')) {
    return element.categoryValueRef ? element.categoryValueRef.value : undefined;
  }

  return element.name;
}


// geometry ///////////////

function toBox(bounds) {
  return {
    left: bounds.x,
    top: bounds.y,
    right: bounds.x + bounds.width,
    bottom: bounds.y + bounds.height
  };
}

/**
 * The area two boxes share, or null when they share no more than a stroke's
 * width on either axis.
 */
function intersection(a, b) {

  const box = {
    left: Math.max(a.left, b.left),
    top: Math.max(a.top, b.top),
    right: Math.min(a.right, b.right),
    bottom: Math.min(a.bottom, b.bottom)
  };

  if (box.right - box.left <= STROKE_PX || box.bottom - box.top <= STROKE_PX) {
    return null;
  }

  return box;
}

/**
 * Whether `inner` lies inside `outer`, letting it stick out by a stroke.
 */
function contains(outer, inner) {
  return inner.left >= outer.left - STROKE_PX &&
    inner.top >= outer.top - STROKE_PX &&
    inner.right <= outer.right + STROKE_PX &&
    inner.bottom <= outer.bottom + STROKE_PX;
}

/**
 * Whether a point lies in a box or on its border, give or take a stroke.
 */
function covers(box, point) {
  return point.x >= box.left - STROKE_PX && point.x <= box.right + STROKE_PX &&
    point.y >= box.top - STROKE_PX && point.y <= box.bottom + STROKE_PX;
}

function segments(points) {

  const result = [];

  for (let i = 1; i < points.length; i++) {
    result.push([ points[i - 1], points[i] ]);
  }

  return result;
}

/**
 * The pieces of a polyline that cross a box, for every segment that enters it
 * by more than a stroke's width. The pieces are cut at the box's own border,
 * which is where a reader sees the line go in and come out.
 */
function clipPolyline(points, box) {

  const inner = {
    left: box.left + STROKE_PX,
    top: box.top + STROKE_PX,
    right: box.right - STROKE_PX,
    bottom: box.bottom - STROKE_PX
  };

  // a box no wider than two strokes has no inside to cross
  if (inner.right <= inner.left || inner.bottom <= inner.top) {
    return [];
  }

  const pieces = [];

  segments(points).forEach(function(segment) {

    if (clipSegment(segment[0], segment[1], inner)) {
      pieces.push(clipSegment(segment[0], segment[1], box));
    }
  });

  return pieces;
}

/**
 * Liang-Barsky: the part of segment p-q strictly inside the box, or null.
 */
function clipSegment(p, q, box) {

  const dx = q.x - p.x;
  const dy = q.y - p.y;

  const edges = [
    [ -dx, p.x - box.left ],
    [ dx, box.right - p.x ],
    [ -dy, p.y - box.top ],
    [ dy, box.bottom - p.y ]
  ];

  let enter = 0;
  let leave = 1;

  for (let i = 0; i < edges.length; i++) {

    const direction = edges[i][0];
    const room = edges[i][1];

    if (direction === 0) {

      // parallel to this side: on it or beyond it is not inside
      if (room <= 0) {
        return null;
      }

      continue;
    }

    const t = room / direction;

    if (direction < 0) {
      enter = Math.max(enter, t);
    } else {
      leave = Math.min(leave, t);
    }
  }

  if (leave <= enter) {
    return null;
  }

  return {
    from: { x: p.x + enter * dx, y: p.y + enter * dy },
    to: { x: p.x + leave * dx, y: p.y + leave * dy }
  };
}

/**
 * The piece of segment A that segment B draws along the same line, or null
 * when B lies further than a stroke from A's line or shares no length with it.
 */
function sharedPiece(segmentA, segmentB) {

  const a1 = segmentA[0];
  const a2 = segmentA[1];
  const b1 = segmentB[0];
  const b2 = segmentB[1];

  const length = distance(a1, a2);

  if (length === 0 || distance(b1, b2) === 0 || !isOnLine(segmentA, b1) || !isOnLine(segmentA, b2)) {
    return null;
  }

  const from = Math.max(0, Math.min(along(segmentA, b1), along(segmentA, b2)));
  const to = Math.min(length, Math.max(along(segmentA, b1), along(segmentA, b2)));

  if (to <= from) {
    return null;
  }

  return {
    from: pointAlong(segmentA, from),
    to: pointAlong(segmentA, to)
  };
}

/**
 * Join pieces that lie on one line and overlap or touch, until none do.
 */
function joinPieces(pieces) {

  const joined = pieces.slice();

  for (let join = findJoin(joined); join; join = findJoin(joined)) {
    joined[join.into] = join.piece;
    joined.splice(join.from, 1);
  }

  return joined;
}

/**
 * The first two pieces that can be joined, and the piece they make.
 */
function findJoin(pieces) {

  for (let i = 0; i < pieces.length; i++) {
    for (let j = i + 1; j < pieces.length; j++) {

      const a = pieces[i];
      const b = pieces[j];

      const line = [ a.from, a.to ];

      if (!isOnLine(line, b.from) || !isOnLine(line, b.to)) {
        continue;
      }

      // a runs from 0 to its length along the line; b anywhere on it
      const lengthA = distance(a.from, a.to);
      const startB = Math.min(along(line, b.from), along(line, b.to));
      const endB = Math.max(along(line, b.from), along(line, b.to));

      if (startB <= lengthA + STROKE_PX && endB >= -STROKE_PX) {

        const positions = [ 0, lengthA, startB, endB ];

        return {
          into: i,
          from: j,
          piece: {
            from: pointAlong(line, Math.min.apply(null, positions)),
            to: pointAlong(line, Math.max.apply(null, positions))
          }
        };
      }
    }
  }

  return null;
}

/**
 * Whether `point` lies within a stroke of the line through `segment`.
 */
function isOnLine(segment, point) {

  const start = segment[0];
  const end = segment[1];
  const length = distance(start, end);

  const offset = Math.abs((point.x - start.x) * (end.y - start.y) - (point.y - start.y) * (end.x - start.x)) / length;

  return offset <= STROKE_PX;
}

/**
 * How far along the line through `segment`, from its start, `point` falls.
 */
function along(segment, point) {

  const start = segment[0];
  const end = segment[1];
  const length = distance(start, end);

  return ((point.x - start.x) * (end.x - start.x) + (point.y - start.y) * (end.y - start.y)) / length;
}

function pointAlong(segment, position) {

  const start = segment[0];
  const end = segment[1];
  const length = distance(start, end);

  return {
    x: start.x + (end.x - start.x) * position / length,
    y: start.y + (end.y - start.y) * position / length
  };
}

function distance(p, q) {
  return Math.hypot(q.x - p.x, q.y - p.y);
}


// the model ///////////////

function isAncestor(ancestor, element) {

  for (let parent = element.$parent; parent; parent = parent.$parent) {
    if (parent === ancestor) {
      return true;
    }
  }

  return false;
}

function isAttachedTo(boundaryEvent, host) {
  return is(boundaryEvent, 'bpmn:BoundaryEvent') && boundaryEvent.attachedToRef === host;
}

/**
 * Whether two shapes' elements are drawn on each other by design: a
 * subprocess and what it contains, a boundary event and its host. A shape
 * whose element did not resolve belongs with nothing.
 */
function belongTogether(a, b) {

  if (a === undefined || b === undefined) {
    return false;
  }

  return isAncestor(a, b) || isAncestor(b, a) || isAttachedTo(a, b) || isAttachedTo(b, a);
}

/**
 * Whether an element is of a type. An unresolved element, `undefined`, is of
 * none.
 */
function is(element, type) {
  return element !== undefined && typeof element.$instanceOf === 'function' && element.$instanceOf(type);
}

function forEachPair(items, fn) {

  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      fn(items[i], items[j]);
    }
  }
}


// messages ///////////////

/**
 * A shape or an edge, as a finding names it: by its element, or by its DI id
 * when the element did not resolve.
 */
function name(item) {

  if (item.element !== undefined) {
    return describe(item.element);
  }

  return `${ item.di.id } (drawn in the DI; its bpmnElement did not resolve)`;
}

/**
 * The id a finding is reported on: the first of the two that has a model
 * element, which is what bpmn-js-bpmnlint can attach it to; the first one's
 * DI id when neither has.
 */
function reportedId(first, second) {

  if (first.element !== undefined) {
    return first.element.id;
  }

  if (second.element !== undefined) {
    return second.element.id;
  }

  return first.di.id;
}

function describe(element) {

  const text = labelText(element);

  if (typeof text === 'string' && text.trim()) {
    return `"${ text.replace(/\s+/g, ' ').trim() }" (${ element.id })`;
  }

  return element.id;
}

function area(box) {
  return `x ${ Math.round(box.left) }..${ Math.round(box.right) }, y ${ Math.round(box.top) }..${ Math.round(box.bottom) }`;
}

function point(p) {
  return `(${ Math.round(p.x) }, ${ Math.round(p.y) })`;
}

function stretches(pieces) {
  return pieces.map(function(piece) {
    return `from ${ point(piece.from) } to ${ point(piece.to) }`;
  }).join('; ');
}
