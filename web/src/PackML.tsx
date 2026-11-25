import type { Frame } from './model';

// Coordinates keep every command label clear of the unit-state nodes at kiosk size.
const nodes: [string, number, number][] = [
  ['Stopped', 75, 200],
  ['Resetting', 215, 200],
  ['Idle', 355, 200],
  ['Starting', 495, 200],
  ['Execute', 635, 200],
  ['Completing', 775, 200],
  ['Complete', 915, 200],
  ['Holding', 485, 78],
  ['Held', 635, 78],
  ['Unholding', 785, 78],
  ['Suspending', 485, 315],
  ['Suspended', 635, 315],
  ['Unsuspending', 785, 315],
  ['Stopping', 180, 430],
  ['Aborting', 486, 430],
  ['Aborted', 635, 430],
  ['Clearing', 785, 430],
];
const edges: [string, string, number, number][] = [
  ['M132 200H157', 'Reset', 145, 177],
  ['M272 200H297', '', 0, 0],
  ['M412 200H437', 'Start', 425, 177],
  ['M552 200H577', '', 0, 0],
  ['M692 200H717', '', 0, 0],
  ['M832 200H857', '', 0, 0],
  ['M915 222V255H215V223', 'Reset', 350, 251],
  ['M615 177V135H485V102', 'Hold', 540, 130],
  ['M542 78H577', '', 0, 0],
  ['M692 78H727', 'Unhold', 710, 57],
  ['M785 101V135H655V176', '', 0, 0],
  ['M624 223V277H485V292', 'Suspend', 545, 274],
  ['M542 315H577', '', 0, 0],
  ['M692 315H727', 'Unsuspend', 711, 291],
  ['M785 292V274H650V223', '', 0, 0],
  ['M122 430H75V224', '', 0, 0],
  ['M543 430H577', '', 0, 0],
  ['M692 430H727', 'Clear', 710, 408],
  ['M785 453V479H40V224', '', 0, 0],
];

export function PackML({ frame }: { frame: Frame | null }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Unit state model</h2>
        <span className="chip blue">{frame?.state ?? 'Waiting'}</span>
      </div>
      <div className="graph-scroll">
        <svg
          className="graph"
          viewBox="0 0 990 504"
          role="img"
          aria-label={
            'PackML transitions. Current state ' + (frame?.state ?? 'unknown')
          }
        >
          <defs>
            <marker
              id="arrowhead"
              viewBox="0 0 9 9"
              refX="8"
              refY="4.5"
              markerWidth="5"
              markerHeight="5"
              orient="auto"
            >
              <path d="M0 0L9 4.5L0 9" fill="#738496" />
            </marker>
          </defs>
          {edges.map(([path, label, x, y]) => (
            <g key={path}>
              <path d={path} className="link" markerEnd="url(#arrowhead)" />
              {label && (
                <text x={x} y={y} className="edge-label">
                  {label}
                </text>
              )}
            </g>
          ))}
          <text x="484" y="29" className="lane">
            Operator hold
          </text>
          <text x="474" y="365" className="lane">
            Downstream suspension
          </text>
          <text x="179" y="399" className="lane">
            Stop request ↓
          </text>
          <text x="486" y="399" className="lane">
            Abort / air fault ↓
          </text>
          {nodes.map(([name, x, y]) => (
            <g
              key={name}
              className={frame?.state === name ? 'node active' : 'node'}
            >
              <rect x={x - 55} y={y - 21} width="110" height="42" rx="5" />
              <text x={x} y={y + 5}>
                {name}
              </text>
            </g>
          ))}
        </svg>
      </div>
      <p className="footnote">
        Unlabeled arrows advance on state completion. Stop and Abort enter their
        recovery paths from eligible states. A manual stroke uses the same
        completion path.
      </p>
    </section>
  );
}
