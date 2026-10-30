import { BpmnModdle } from 'bpmn-moddle';

import testRule from 'bpmnlint/lib/test-rule';

import { expect } from 'chai';

import noDiagramOverlaps from '../../bpmnlint-plugin-sese/rules/no-diagram-overlaps';

const plugin = require('../../bpmnlint-plugin-sese');

const bpmnlintrc = require('../../bpmnlintrc.json');


/**
 * A BPMN document for a fixture.
 *
 * `shapes` are `{ type, id, name, bounds, label, parent, attachedTo, expanded,
 * attrs }` and `flows` `{ type, id, name, source, target, waypoints, label }`,
 * where `bounds` and `label` are `[ x, y, width, height ]`, `parent` is the id
 * of the expanded subprocess a shape belongs to, a shape `type` with a prefix
 * (`sese:assetShape`) is written as given and any other in the `bpmn`
 * namespace, and a flow's `type` is `sequenceFlow` unless it says otherwise.
 * `pool`, when given, is `{ id, name, bounds, lanes: [ { id, name, bounds,
 * nodes } ] }`.
 */
function definitions({ pool, shapes, flows }) {

  function attributes(values) {
    return Object.keys(values)
      .filter(key => values[key] !== undefined)
      .map(key => ` ${ key }="${ values[key] }"`)
      .join('');
  }

  function boundsXml(box) {
    return `<dc:Bounds x="${ box[0] }" y="${ box[1] }" width="${ box[2] }" height="${ box[3] }" />`;
  }

  function labelXml(box) {
    return box ? `<bpmndi:BPMNLabel>${ boundsXml(box) }</bpmndi:BPMNLabel>` : '';
  }

  function elementXml(shape) {

    const own = attributes(Object.assign({
      id: shape.id,
      name: shape.name,
      attachedToRef: shape.attachedTo
    }, shape.attrs));

    const children = shapes
      .filter(child => child.parent === shape.id)
      .map(elementXml)
      .join('');

    const tag = shape.type.includes(':') ? shape.type : `bpmn:${ shape.type }`;

    return `<${ tag }${ own }>${ children }</${ tag }>`;
  }

  const processXml = [
    pool ? `<bpmn:laneSet id="LaneSet_1">${ pool.lanes.map(lane =>
      `<bpmn:lane id="${ lane.id }" name="${ lane.name }">${ lane.nodes.map(node =>
        `<bpmn:flowNodeRef>${ node }</bpmn:flowNodeRef>`).join('') }</bpmn:lane>`
    ).join('') }</bpmn:laneSet>` : '',
    shapes.filter(shape => shape.parent === undefined).map(elementXml).join(''),
    flows.map(flow =>
      `<bpmn:${ flow.type === undefined ? 'sequenceFlow' : flow.type }${
        attributes({ id: flow.id, name: flow.name, sourceRef: flow.source, targetRef: flow.target }) } />`
    ).join('')
  ].join('');

  const diShapes = (pool ? [ pool ].concat(pool.lanes) : []).concat(shapes).map(shape =>
    `<bpmndi:BPMNShape${ attributes({
      id: `${ shape.id }_di`,
      bpmnElement: shape.id,
      isExpanded: shape.expanded ? 'true' : undefined
    }) }>${ boundsXml(shape.bounds) }${ labelXml(shape.label) }</bpmndi:BPMNShape>`
  ).join('');

  const diEdges = flows.map(flow =>
    `<bpmndi:BPMNEdge id="${ flow.id }_di" bpmnElement="${ flow.id }">${ flow.waypoints.map(point =>
      `<di:waypoint x="${ point[0] }" y="${ point[1] }" />`).join('') }${ labelXml(flow.label) }</bpmndi:BPMNEdge>`
  ).join('');

  return '<?xml version="1.0" encoding="UTF-8"?>' +
    '<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" ' +
    'xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" ' +
    'xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" ' +
    'xmlns:di="http://www.omg.org/spec/DD/20100524/DI" ' +
    'xmlns:sese="http://example.com/sese/import" ' +
    'id="Definitions_1" targetNamespace="http://bpmn.io/schema/bpmn">' +
    (pool ? `<bpmn:collaboration id="Collaboration_1"><bpmn:participant id="${ pool.id }" name="${ pool.name }" processRef="Process_1" /></bpmn:collaboration>` : '') +
    `<bpmn:process id="Process_1">${ processXml }</bpmn:process>` +
    '<bpmndi:BPMNDiagram id="Diagram_1">' +
    `<bpmndi:BPMNPlane id="Plane_1" bpmnElement="${ pool ? 'Collaboration_1' : 'Process_1' }">${ diShapes }${ diEdges }</bpmndi:BPMNPlane>` +
    '</bpmndi:BPMNDiagram>' +
    '</bpmn:definitions>';
}

/**
 * The messages the rule reports on a fixture read with the given moddle
 * extensions, in reporting order, and the warnings the reading raised.
 */
async function lintWith(fixture, extensions) {

  const { rootElement, warnings } = await new BpmnModdle(extensions).fromXML(definitions(fixture));

  return {
    messages: testRule({ moddleRoot: rootElement, rule: noDiagramOverlaps() }).map(report => report.message),
    warnings: warnings.map(warning => warning.message)
  };
}

/**
 * The messages the rule reports on a plain BPMN fixture, in reporting order.
 */
async function lint(fixture) {

  const { messages, warnings } = await lintWith(fixture, {});

  // a fixture the parser had to repair would test something else
  expect(warnings).to.be.empty;

  return messages;
}

/**
 * What BOS's `server/gui/src/schemi/sese.json` declares about the asset box,
 * and nothing else of that schema.
 */
const ASSET_SCHEMA = {
  name: 'SESE',
  uri: 'http://example.com/sese/import',
  prefix: 'sese',
  xml: { tagAlias: 'lowerCase' },
  types: [
    {
      name: 'AssetShape',
      superClass: [ 'bpmn:Artifact' ],
      meta: { allowedIn: [ 'bpmn:Process', 'bpmn:SubProcess' ] },
      properties: [
        { name: 'resourceRef', isAttr: true, type: 'String' },
        { name: 'roleRef', isAttr: true, type: 'String' },
        { name: 'pattern', isAttr: true, type: 'String' }
      ]
    }
  ]
};

/**
 * An asset box drawn over task A, allocated to task B by an association that
 * starts at the box's centre and crosses task C on its way.
 */
const ASSET_BOX_OVER_A_TASK = {
  shapes: [
    task('Task_A', 'A', [ 100, 100, 100, 80 ]),
    {
      type: 'sese:assetShape', id: 'Asset_1', bounds: [ 150, 150, 170, 64 ],
      attrs: { pattern: '/**/Officina/FresaCNC/*' }
    },
    task('Task_B', 'B', [ 500, 100, 100, 80 ]),
    task('Task_C', 'C', [ 340, 150, 60, 60 ])
  ],
  flows: [
    {
      type: 'association', id: 'Allocation_1', source: 'Asset_1', target: 'Task_B',
      waypoints: [ [ 235, 182 ], [ 420, 182 ], [ 420, 140 ], [ 500, 140 ] ]
    }
  ]
};

function task(id, name, bounds, extra) {
  return Object.assign({ type: 'task', id, name, bounds }, extra);
}


describe('sese/no-diagram-overlaps', function() {

  it('should be wired into the plugin and the modeller config as an error', function() {

    expect(plugin.rules['no-diagram-overlaps']).to.equal('bpmnlint-plugin-sese/rules/no-diagram-overlaps');

    expect(bpmnlintrc.rules['sese/no-diagram-overlaps']).to.equal('error');
  });


  it('should report nothing on a diagram laid out without overlaps', async function() {

    const messages = await lint({
      shapes: [
        { type: 'startEvent', id: 'Start_1', name: 'Start', bounds: [ 100, 100, 36, 36 ], label: [ 93, 143, 50, 14 ] },
        task('Task_A', 'A', [ 190, 78, 100, 80 ]),
        { type: 'boundaryEvent', id: 'Boundary_1', bounds: [ 222, 140, 36, 36 ], attachedTo: 'Task_A' },
        { type: 'endEvent', id: 'End_2', bounds: [ 222, 250, 36, 36 ] },
        { type: 'exclusiveGateway', id: 'Gateway_1', name: 'choose', bounds: [ 345, 93, 50, 50 ], label: [ 345, 72, 50, 14 ] },
        task('Task_B', 'B', [ 450, 78, 100, 80 ]),
        task('Task_C', 'C', [ 450, 198, 100, 80 ]),
        { type: 'exclusiveGateway', id: 'Gateway_2', bounds: [ 605, 93, 50, 50 ] },
        { type: 'endEvent', id: 'End_1', name: 'End', bounds: [ 710, 100, 36, 36 ], label: [ 703, 143, 50, 14 ] },
        { type: 'subProcess', id: 'Sub_1', name: 'S', bounds: [ 800, 40, 300, 160 ], expanded: true },
        task('Task_T', 'T', [ 850, 80, 100, 80 ], { parent: 'Sub_1' })
      ],
      flows: [
        { id: 'Flow_1', source: 'Start_1', target: 'Task_A', waypoints: [ [ 136, 118 ], [ 190, 118 ] ] },
        { id: 'Flow_2', source: 'Task_A', target: 'Gateway_1', waypoints: [ [ 290, 118 ], [ 345, 118 ] ] },
        {
          id: 'Flow_3', name: 'yes', source: 'Gateway_1', target: 'Task_B',
          waypoints: [ [ 395, 118 ], [ 450, 118 ] ], label: [ 405, 98, 30, 14 ]
        },
        { id: 'Flow_4', source: 'Gateway_1', target: 'Task_C', waypoints: [ [ 370, 143 ], [ 370, 238 ], [ 450, 238 ] ] },
        { id: 'Flow_5', source: 'Task_B', target: 'Gateway_2', waypoints: [ [ 550, 118 ], [ 605, 118 ] ] },
        { id: 'Flow_6', source: 'Task_C', target: 'Gateway_2', waypoints: [ [ 550, 238 ], [ 630, 238 ], [ 630, 143 ] ] },
        { id: 'Flow_7', source: 'Gateway_2', target: 'End_1', waypoints: [ [ 655, 118 ], [ 710, 118 ] ] },
        { id: 'Flow_8', source: 'Boundary_1', target: 'End_2', waypoints: [ [ 240, 176 ], [ 240, 250 ] ] }
      ]
    });

    expect(messages).to.eql([]);
  });


  it('should report flow nodes drawn over each other, not a child in its subprocess', async function() {

    const messages = await lint({
      shapes: [
        task('Task_A', 'A', [ 100, 100, 100, 80 ]),
        task('Task_B', 'B', [ 180, 120, 100, 80 ]),

        // edge to edge, and overlapping by no more than a stroke
        task('Task_C', 'C', [ 400, 100, 100, 80 ]),
        task('Task_D', 'D', [ 500, 100, 100, 80 ]),
        task('Task_E', 'E', [ 700, 100, 100, 80 ]),
        task('Task_F', 'F', [ 798, 100, 100, 80 ]),

        // on its host's border by definition
        { type: 'boundaryEvent', id: 'Boundary_1', bounds: [ 432, 162, 36, 36 ], attachedTo: 'Task_C' },

        // T belongs to S; G is drawn inside S without belonging to it
        { type: 'subProcess', id: 'Sub_1', name: 'S', bounds: [ 100, 300, 400, 200 ], expanded: true },
        task('Task_T', 'T', [ 150, 350, 100, 80 ], { parent: 'Sub_1' }),
        task('Task_G', 'G', [ 350, 350, 100, 80 ])
      ],
      flows: []
    });

    expect(messages).to.eql([
      'Shape "A" (Task_A) overlaps shape "B" (Task_B) at x 180..200, y 120..180',
      'Shape "S" (Sub_1) overlaps shape "G" (Task_G) at x 350..450, y 350..430'
    ]);
  });


  it('should report a label over a shape, over a label, and across a lane border', async function() {

    const messages = await lint({
      pool: {
        id: 'Pool_1', name: 'Pool', bounds: [ 0, 0, 800, 400 ],
        lanes: [
          { id: 'Lane_1', name: 'L1', bounds: [ 30, 0, 770, 200 ], nodes: [ 'Gateway_1', 'Event_1', 'Event_2', 'Event_3' ] },
          { id: 'Lane_2', name: 'L2', bounds: [ 30, 200, 770, 200 ], nodes: [ 'Task_K' ] }
        ]
      },
      shapes: [
        { type: 'exclusiveGateway', id: 'Gateway_1', name: 'if x', bounds: [ 100, 100, 50, 50 ], label: [ 100, 155, 50, 14 ] },
        task('Task_K', 'K', [ 130, 160, 100, 80 ]),
        { type: 'startEvent', id: 'Event_1', name: 'one', bounds: [ 300, 100, 36, 36 ], label: [ 290, 140, 60, 14 ] },
        { type: 'endEvent', id: 'Event_2', name: 'two', bounds: [ 360, 100, 36, 36 ], label: [ 330, 145, 60, 14 ] },
        { type: 'intermediateThrowEvent', id: 'Event_3', name: 'three', bounds: [ 500, 150, 36, 36 ], label: [ 490, 190, 60, 14 ] }
      ],
      flows: []
    });

    expect(messages).to.eql([
      'Label of "if x" (Gateway_1) overlaps shape "K" (Task_K) at x 130..150, y 160..169',
      'Label of "three" (Event_3) at x 490..550, y 190..204 crosses the border of "L1" (Lane_1)',
      'Label of "three" (Event_3) at x 490..550, y 190..204 crosses the border of "L2" (Lane_2)',
      'Label of "one" (Event_1) overlaps the label of "two" (Event_2) at x 330..350, y 145..154'
    ]);
  });


  it('should report an edge through a shape it does not connect', async function() {

    const messages = await lint({
      shapes: [
        task('Task_A', 'A', [ 100, 100, 100, 80 ]),
        task('Task_B', 'B', [ 300, 100, 100, 80 ]),
        task('Task_C', 'C', [ 500, 100, 100, 80 ]),
        task('Task_D', 'D', [ 100, 250, 100, 80 ]),
        task('Task_E', 'E', [ 500, 250, 100, 80 ]),
        task('Task_W', 'W', [ 800, 160, 100, 80 ]),
        { type: 'subProcess', id: 'Sub_1', name: 'S', bounds: [ 1000, 100, 300, 200 ], expanded: true },
        task('Task_T', 'T', [ 1050, 150, 100, 80 ], { parent: 'Sub_1' }),
        task('Task_T2', 'T2', [ 1180, 150, 100, 80 ], { parent: 'Sub_1' }),
        task('Task_U', 'U', [ 1400, 160, 100, 80 ])
      ],
      flows: [

        // straight through B
        { id: 'Flow_AC', source: 'Task_A', target: 'Task_C', waypoints: [ [ 200, 140 ], [ 500, 140 ] ] },

        // along the bottom of A, B and C, one pixel inside them
        {
          id: 'Flow_DE', source: 'Task_D', target: 'Task_E',
          waypoints: [ [ 150, 250 ], [ 150, 179 ], [ 550, 179 ], [ 550, 250 ] ]
        },

        // through a subprocess it neither starts nor ends in, and its children
        { id: 'Flow_WU', source: 'Task_W', target: 'Task_U', waypoints: [ [ 900, 200 ], [ 1400, 200 ] ] },

        // inside the subprocess it belongs to
        { id: 'Flow_TT2', source: 'Task_T', target: 'Task_T2', waypoints: [ [ 1150, 190 ], [ 1180, 190 ] ] }
      ]
    });

    expect(messages).to.eql([
      'Edge Flow_AC passes through shape "B" (Task_B) from (300, 140) to (400, 140)',
      'Edge Flow_WU passes through shape "S" (Sub_1) from (1000, 200) to (1300, 200)',
      'Edge Flow_WU passes through shape "T" (Task_T) from (1050, 200) to (1150, 200)',
      'Edge Flow_WU passes through shape "T2" (Task_T2) from (1180, 200) to (1280, 200)'
    ]);
  });


  it('should report an edge over a gateway label, not over its own label', async function() {

    const messages = await lint({
      shapes: [
        task('Task_Y', 'Y', [ 100, 85, 100, 80 ]),
        { type: 'exclusiveGateway', id: 'Gateway_M', name: 'merge', bounds: [ 300, 100, 50, 50 ], label: [ 310, 155, 40, 14 ] },
        task('Task_Z', 'Z', [ 450, 210, 100, 80 ])
      ],
      flows: [
        {
          id: 'Flow_YM', name: 'in', source: 'Task_Y', target: 'Gateway_M',
          waypoints: [ [ 200, 125 ], [ 300, 125 ] ], label: [ 235, 118, 30, 14 ]
        },
        {
          id: 'Flow_MZ', source: 'Gateway_M', target: 'Task_Z',
          waypoints: [ [ 325, 150 ], [ 325, 250 ], [ 450, 250 ] ]
        }
      ]
    });

    expect(messages).to.eql([
      'Edge Flow_MZ runs over the label of "merge" (Gateway_M) from (325, 155) to (325, 169)'
    ]);
  });


  it('should report two edges along the same line, not edges that only meet', async function() {

    const messages = await lint({
      shapes: [
        task('Task_L1', 'L1', [ 100, 100, 100, 80 ]),
        task('Task_L2', 'L2', [ 300, 100, 100, 80 ]),
        task('Task_L3', 'L3', [ 500, 100, 100, 80 ]),
        { type: 'exclusiveGateway', id: 'Gateway_S', bounds: [ 300, 400, 50, 50 ] },
        task('Task_T3', 'T3', [ 450, 385, 100, 80 ]),
        task('Task_T4', 'T4', [ 300, 550, 100, 80 ]),
        task('Task_P1', 'P1', [ 0, 700, 100, 80 ]),
        task('Task_P2', 'P2', [ 400, 700, 100, 80 ]),
        task('Task_R1', 'R1', [ 0, 900, 100, 80 ]),
        task('Task_R2', 'R2', [ 300, 900, 100, 80 ]),
        task('Task_R3', 'R3', [ 300, 1020, 100, 80 ])
      ],
      flows: [
        { id: 'Flow_12', source: 'Task_L1', target: 'Task_L2', waypoints: [ [ 200, 140 ], [ 300, 140 ] ] },
        { id: 'Flow_23', source: 'Task_L2', target: 'Task_L3', waypoints: [ [ 400, 140 ], [ 500, 140 ] ] },

        // two loop-backs along y 230, the first with a waypoint mid-run
        {
          id: 'Flow_21', source: 'Task_L2', target: 'Task_L1',
          waypoints: [ [ 350, 180 ], [ 350, 230 ], [ 250, 230 ], [ 150, 230 ], [ 150, 180 ] ]
        },
        {
          id: 'Flow_31', source: 'Task_L3', target: 'Task_L1',
          waypoints: [ [ 550, 180 ], [ 550, 230 ], [ 150, 230 ], [ 150, 180 ] ]
        },

        // out of one docking point in two directions
        { id: 'Flow_S3', source: 'Gateway_S', target: 'Task_T3', waypoints: [ [ 350, 425 ], [ 450, 425 ] ] },
        { id: 'Flow_S4', source: 'Gateway_S', target: 'Task_T4', waypoints: [ [ 350, 425 ], [ 350, 550 ] ] },

        // parallel, 10px apart
        { id: 'Flow_P5', source: 'Task_P1', target: 'Task_P2', waypoints: [ [ 100, 740 ], [ 400, 740 ] ] },
        { id: 'Flow_P6', source: 'Task_P1', target: 'Task_P2', waypoints: [ [ 100, 750 ], [ 400, 750 ] ] },

        // together for exactly MIN_SHARED_LENGTH_PX
        { id: 'Flow_R2', source: 'Task_R1', target: 'Task_R2', waypoints: [ [ 100, 940 ], [ 300, 940 ] ] },
        {
          id: 'Flow_R3', source: 'Task_R1', target: 'Task_R3',
          waypoints: [ [ 100, 940 ], [ 105, 940 ], [ 105, 1060 ], [ 300, 1060 ] ]
        }
      ]
    });

    expect(messages).to.eql([
      'Edge Flow_21 and edge Flow_31 run along the same line for 250px ' +
      'from (350, 230) to (150, 230); from (150, 230) to (150, 180)'
    ]);
  });


  describe('a shape is judged by being drawn, not by its type', function() {

    it('should report a text annotation over a task', async function() {

      const messages = await lint({
        shapes: [
          task('Task_A', 'A', [ 100, 100, 100, 80 ]),
          { type: 'textAnnotation', id: 'Note_1', bounds: [ 150, 60, 100, 60 ] }
        ],
        flows: []
      });

      expect(messages).to.eql([
        'Shape "A" (Task_A) overlaps shape Note_1 at x 150..200, y 100..120'
      ]);
    });


    it('should report an extension box over a task, its schema loaded', async function() {

      const { messages, warnings } = await lintWith(ASSET_BOX_OVER_A_TASK, { sese: ASSET_SCHEMA });

      // assume -- the box is a model element: nothing failed to resolve
      expect(warnings).to.be.empty;

      // then -- the box over A, and the association's crossing of C as the
      // control that the rule ran; not the association leaving its own box
      expect(messages).to.eql([
        'Shape "A" (Task_A) overlaps shape Asset_1 at x 150..200, y 150..180',
        'Edge Allocation_1 passes through shape "C" (Task_C) from (340, 182) to (400, 182)'
      ]);
    });


    it('should report an extension box over a task, its schema missing', async function() {

      const { messages, warnings } = await lintWith(ASSET_BOX_OVER_A_TASK, {});

      // assume -- the box is not in the model, and its DI points at nothing
      expect(warnings.some(warning => warning.startsWith('unparsable content <sese:assetShape>'))).to.be.true;
      expect(warnings).to.include('unresolved reference <Asset_1>');

      // then -- the same two findings, the box named by its DI id; the
      // association, whose source did not resolve, ends at the box under its
      // first waypoint and does not pass through it
      expect(messages).to.eql([
        'Shape "A" (Task_A) overlaps shape Asset_1_di (drawn in the DI; its bpmnElement did not resolve) ' +
        'at x 150..200, y 150..180',
        'Edge Allocation_1 passes through shape "C" (Task_C) from (340, 182) to (400, 182)'
      ]);
    });

  });


  it('should judge a large diagram by what lies near each thing, not by every pair', async function() {

    // reading 10 001 shapes takes the browser seconds; the rule may not
    this.timeout(60000);

    // given -- 100 rows of 100 tasks, each joined to the next in its row,
    // and one task drawn over the last of them
    const shapes = [];
    const flows = [];

    for (let row = 0; row < 100; row++) {
      for (let column = 0; column < 100; column++) {

        shapes.push(task(`Task_${ row }_${ column }`, `T${ row }_${ column }`, [ column * 150, row * 120, 100, 80 ]));

        if (column > 0) {
          flows.push({
            id: `Flow_${ row }_${ column }`,
            source: `Task_${ row }_${ column - 1 }`,
            target: `Task_${ row }_${ column }`,
            waypoints: [ [ column * 150 - 50, row * 120 + 40 ], [ column * 150, row * 120 + 40 ] ]
          });
        }
      }
    }

    shapes.push(task('Task_X', 'X', [ 99 * 150 + 20, 99 * 120 + 10, 100, 80 ]));

    const { rootElement, warnings } = await new BpmnModdle().fromXML(definitions({ shapes, flows }));

    expect(warnings).to.be.empty;

    // when
    const started = Date.now();

    const messages = testRule({ moddleRoot: rootElement, rule: noDiagramOverlaps() }).map(report => report.message);

    const seconds = (Date.now() - started) / 1000;

    // then -- the one overlap, found among some 2 x 10^8 pairs of shapes and
    // as many of edges and shapes, in a time that compares only neighbours
    expect(messages).to.eql([
      'Shape "T99_99" (Task_99_99) overlaps shape "X" (Task_X) at x 14870..14950, y 11890..11960'
    ]);

    expect(seconds).to.be.below(5);
  });

});
