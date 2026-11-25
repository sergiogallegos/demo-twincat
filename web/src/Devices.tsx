import { useState } from 'react';
import type { Frame } from './model';

const modules = [
  {
    name: 'Feed servo',
    station: 'Blank feed',
    target: '180 mm',
    description:
      'The feed axis meters one blank during the first cylinder stroke.',
    native: 'NC PTP · Tc2_MC2',
  },
  {
    name: 'XTS carrier',
    station: 'Station transfer',
    target: '560 mm pitch',
    description:
      'The carrier indexes after the active cylinder returns home. The unit waits for the next nest position before selecting the next station.',
    native: 'XTS processing unit · Simulation mode',
  },
  {
    name: 'Seal vision',
    station: 'Flap close',
    target: '4 of 5 bright',
    description:
      'At the forward limit the inspection latches five grayscale samples. Four samples at or above 200 qualify the carton for the accept lane.',
    native: 'TwinCAT Vision · File Source',
  },
  {
    name: 'XPlanar sorter',
    station: 'Discharge',
    target: 'X 240 / Y ±120 mm',
    description:
      'The inspection result selects the discharge lane. A reject increments the reject counter when the fifth cylinder returns home.',
    native: 'MC_PlanarMover · simulated mover',
  },
];

export function Devices({
  frame,
  online,
}: {
  frame: Frame | null;
  online: boolean;
}) {
  const [selected, setSelected] = useState(0);
  const d = frame?.devices;
  const module = modules[selected];
  const values = d
    ? [
        d.feedMm + ' mm',
        d.trackMm + ' mm',
        d.inspection,
        d.planarXmm + ' / ' + d.planarYmm + ' mm',
      ]
    : ['—', '—', '—', '—'];
  const sealed =
    d?.inspection === 'Pending' || !d
      ? !d?.missingSeal
      : d.inspection === 'Pass';
  return (
    <div className="engineering">
      <section className="panel">
        <div className="panel-head">
          <h2>Device feedback</h2>
          <span className="subtle">
            {online
              ? 'Virtual mechanisms · machine telemetry'
              : 'Last observed values · offline'}
          </span>
        </div>
        <div className="devices">
          {modules.map((item, i) => (
            <button
              className={selected === i ? 'selected' : ''}
              key={item.name}
              onClick={() => setSelected(i)}
              aria-pressed={selected === i}
            >
              <span>{item.name}</span>
              <b>{values[i]}</b>
              <small>{item.station}</small>
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2>{module.name}</h2>
          <span className="chip blue">{module.target}</span>
        </div>
        <div className="device-detail">
          <div className="device-diagram">
            {selected === 2 ? (
              <div className="inspection-image">
                <img
                  src={'/vision/' + (sealed ? 'sealed' : 'missing') + '.bmp'}
                  alt={
                    sealed ? 'Sealed carton fixture' : 'Missing seal fixture'
                  }
                />
                <span>File fixture · 160 × 100 px</span>
              </div>
            ) : selected === 3 ? (
              <svg viewBox="0 0 400 220" aria-label="Shuttle coordinates">
                <path
                  d="M55 110L329 38 M55 110L329 182"
                  className="travel-line"
                />
                <text x="318" y="23">
                  Accept
                </text>
                <text x="318" y="209">
                  Reject
                </text>
                <rect
                  className="carrier"
                  x={38 + (d?.planarXmm ?? 0) * 1.14}
                  y={98 - (d?.planarYmm ?? 0) * 0.6}
                  width="32"
                  height="24"
                  rx="4"
                />
              </svg>
            ) : (
              <svg viewBox="0 0 400 190" aria-label="Axis feedback">
                <path d="M34 105H366" className="travel-line" />
                {(selected === 0
                  ? [0, 60, 120, 180]
                  : [0, 560, 1120, 1680, 2240]
                ).map((v) => {
                  const x = 34 + (332 * v) / (selected === 0 ? 180 : 2240);
                  return (
                    <g key={v}>
                      <path d={`M${x} 98v17`} className="tick" />
                      <text x={x} y="138" textAnchor="middle">
                        {v}
                      </text>
                    </g>
                  );
                })}
                <rect
                  className="carrier"
                  x={
                    21 +
                    332 *
                      (selected === 0
                        ? (d?.feedMm ?? 0) / 180
                        : (d?.trackMm ?? 0) / 2240)
                  }
                  y="76"
                  width="26"
                  height="26"
                  rx="4"
                />
              </svg>
            )}
          </div>
          <div className="prose">
            <h3>Sequence behavior</h3>
            <p>{module.description}</p>
            <h3>Observed feedback</h3>
            <p>
              {selected === 2
                ? d?.inspection === 'Pending'
                  ? 'Waiting for the closing stroke.'
                  : (d?.brightSamples ?? 0) + ' of 5 samples met the threshold.'
                : selected === 3
                  ? 'Accepted ' +
                    (frame?.cartons ?? 0) +
                    ' · Rejected ' +
                    (d?.rejected ?? 0)
                  : selected === 1 && d?.indexing
                    ? 'Indexing to the next nest.'
                    : values[selected]}
            </p>
            <h3>Native TwinCAT lab</h3>
            <p>
              {module.native}. Setup, code and commissioning checks are in{' '}
              <code>docs/device-labs.md</code>.
            </p>
          </div>
        </div>
      </section>
      <section className="panel prose">
        <h2>Trace a reject</h2>
        <p>
          In Diagnostics select <b>Remove seal</b> before the flap closer
          reaches its forward limit. Reset and start an automatic cycle. Watch
          the inspection latch Reject at ST-04 and the shuttle travel to Y −120
          mm at ST-05. Restore the seal input before running the next carton.
        </p>
      </section>
    </div>
  );
}
