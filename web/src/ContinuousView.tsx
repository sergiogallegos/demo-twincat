import { useEffect, useState } from 'react';
import type { LineFrame } from './model';
import { operations, planarOps, pose } from './lineLayout';
import { LineScene } from './LineScene';
import './line.css';

type Action = (
  command: string,
  label?: string,
  primary?: boolean,
) => React.ReactNode;
const sx = (x: number) => 50 + (x + 2260) * 0.205;
const sy = (y: number) => 49 + (1050 - y) * 0.155;
const pct = (a: number, b: number) =>
  b ? ((100 * a) / b).toFixed(1) + '%' : '—';
const moverName = (i: number) =>
  (i < 10 ? 'X' : 'P') + String(i < 10 ? i + 1 : i - 9).padStart(2, '0');

function Plan({
  line,
  selected,
  pick,
}: {
  line: LineFrame;
  selected: number;
  pick: (i: number) => void;
}) {
  return (
    <svg
      className="line-plan"
      viewBox="0 0 790 385"
      role="group"
      aria-label="Live transport map"
    >
      <defs>
        <pattern id="grid" width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r=".8" fill="#a7b9be" />
        </pattern>
      </defs>
      <rect width="790" height="385" fill="url(#grid)" />
      <text x="33" y="23" className="zone-label">
        02 / PLANAR FINISHING
      </text>
      <text x="414" y="23" className="zone-label">
        01 / XTS ASSEMBLY
      </text>
      <rect
        x="31"
        y="45"
        width="231"
        height="128"
        rx="8"
        fill="#d8e9e6"
        stroke="#819f9b"
      />
      {[0, 1, 2, 3, 4].map((i) => (
        <path key={i} d={`M${44 + i * 48} 45v128`} stroke="#b3cdca" />
      ))}
      <path d="M31 88h231m-231 42h231" stroke="#b3cdca" />
      <path
        d={`M${sx(-1320)} ${sy(480)}H${sx(-2200)}V${sy(960)}H${sx(-1320)}Z`}
        fill="none"
        stroke="#7fa49d"
        strokeDasharray="4 4"
      />
      <rect
        x={sx(-1070)}
        y={sy(320)}
        width={2140 * 0.205}
        height={640 * 0.155}
        rx={320 * 0.205}
        ry={320 * 0.155}
        fill="none"
        stroke="#425665"
        strokeWidth="19"
      />
      <rect
        x={sx(-1070)}
        y={sy(320)}
        width={2140 * 0.205}
        height={640 * 0.155}
        rx={320 * 0.205}
        ry={320 * 0.155}
        fill="none"
        stroke="#abc0c9"
        strokeWidth="2"
        strokeDasharray="4 4"
      />
      <text x={sx(0)} y={sy(0) + 5} textAnchor="middle" className="zone-label">
        XTS · 10 CARTS
      </text>
      <path
        d={`M${sx(-750)} ${sy(320)}L${sx(-1320)} ${sy(480)}`}
        stroke="#997446"
        strokeWidth="3"
        strokeDasharray="5 4"
      />
      {operations.map((name, i) => {
        const side = i < 4 ? -1 : 1,
          x = sx(-750 + 500 * (i < 4 ? i : 7 - i)),
          y = sy(side * 320),
          dy = side > 0 ? -1 : 1;
        return (
          <g key={name}>
            <rect
              x={x - 44}
              y={y + dy * 65 - 14}
              width="88"
              height="29"
              rx="4"
              fill="#fff"
              stroke="#b1c2c9"
            />
            <text x={x} y={y + dy * 65 + 4} textAnchor="middle">
              {i + 1} · {name}
            </text>
            <path
              d={`M${x} ${y + dy * 49}v${-dy * (14 + line.camX[i] * 0.16)}`}
              stroke="#28708b"
              strokeWidth="5"
            />
          </g>
        );
      })}
      {line.products.map((id, i) => {
        const [x, y] = pose(i, line);
        return (
          <g
            key={i}
            role="button"
            tabIndex={0}
            aria-label={moverName(i) + ' carton ' + (id || 'empty')}
            onClick={() => pick(i)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                pick(i);
              }
            }}
            className="mover"
          >
            <rect
              x={sx(x) - 14}
              y={sy(y) - 9}
              width="28"
              height="18"
              rx="4"
              fill={
                id
                  ? line.failed[i]
                    ? '#b23b37'
                    : '#ac671f'
                  : i < 10
                    ? '#205268'
                    : '#286e64'
              }
              stroke={selected === i ? '#141d24' : 'white'}
              strokeWidth={selected === i ? 3 : 1}
            />
            <text x={sx(x)} y={sy(y) + 3.5} textAnchor="middle" fill="white">
              {moverName(i)}
            </text>
          </g>
        );
      })}
      <text x="32" y="204">
        P1 · Verify assembly
      </text>
      <text x="32" y="222">
        P2 · Seal vision
      </text>
      <text x="32" y="240">
        P3 · Final pack / reject
      </text>
      <text x="32" y="363" className="zone-label">
        TEAL / EMPTY　 OCHRE / LOADED　 RED / REJECT
      </text>
    </svg>
  );
}

export function ContinuousView({
  line,
  action,
  online,
}: {
  line: LineFrame;
  action: Action;
  online: boolean;
}) {
  const [view, setView] = useState('Plan');
  const [selected, setSelected] = useState(0);
  const [station, setStation] = useState(2);
  const [samples, setSamples] = useState<number[][]>([]);
  useEffect(() => {
    if (online)
      setSamples((s) => [
        ...s.slice(-79),
        [line.camX[station], line.camZ[station]],
      ]);
  }, [line, station, online]);
  const wip = line.products.filter(Boolean).length;
  const total = line.good + line.rejected;
  const slot =
    (selected + (selected < 10 ? 0 : -10) + line.index) %
    (selected < 10 ? 10 : 6);
  const stage =
    selected >= 10
      ? planarOps[slot]
      : slot === 4 || slot === 9
        ? 'End turn'
        : operations[slot < 4 ? slot : slot - 1];
  return (
    <div className="line-work">
      <div className="line-kpis">
        {[
          ['Packed', line.good],
          ['Rejected', line.rejected],
          ['In process', wip],
          ['Recipe target', '30 / min'],
        ].map(([k, v]) => (
          <div key={k}>
            <small>{k}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <section className="panel">
        <div className="panel-head">
          <h2>Assembly &amp; finishing line</h2>
          <div className="line-tabs">
            {['Plan', '3D'].map((v) => (
              <button
                key={v}
                aria-pressed={view === v}
                onClick={() => setView(v)}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        {view === 'Plan' ? (
          <Plan line={line} selected={selected} pick={setSelected} />
        ) : (
          <LineScene line={line} />
        )}
        <div className="line-inspector">
          <label>
            Mover{' '}
            <select
              value={selected}
              onChange={(e) => setSelected(+e.target.value)}
            >
              {line.products.map((_, i) => (
                <option key={i} value={i}>
                  {moverName(i)}
                </option>
              ))}
            </select>
          </label>
          <span>{stage}</span>
          <b>
            {line.products[selected]
              ? 'Carton #' + line.products[selected]
              : 'Empty'}
          </b>
          <span>
            Checks 0x{line.checked[selected].toString(16).padStart(3, '0')} ·
            fails 0x{line.failed[selected].toString(16)}
          </span>
        </div>
      </section>
      <div className="two-col">
        <section className="panel prose">
          <h2>Servo scope</h2>
          <label>
            Axis pair{' '}
            <select
              value={station}
              onChange={(e) => {
                setSamples([]);
                setStation(+e.target.value);
              }}
            >
              {operations.map((s, i) => (
                <option key={s} value={i}>
                  {i + 1} · {s}
                </option>
              ))}
            </select>
          </label>
          <svg
            viewBox="0 0 320 60"
            role="img"
            aria-label="Recent sampled X and Z positions"
            className="scope"
          >
            {[0, 1].map((j) => (
              <polyline
                key={j}
                fill="none"
                stroke={j ? '#d68b37' : '#42a8af'}
                strokeWidth="2"
                points={samples
                  .map(
                    (s, i) =>
                      i * 4 + ',' + (57 - s[j] * (station === 5 ? 0.21 : 0.4)),
                  )
                  .join(' ')}
              />
            ))}
          </svg>
          <p>
            X {line.camX[station]} mm · Z {line.camZ[station]} mm · sampled at
            HMI refresh
          </p>
        </section>
        <section className="panel prose">
          <h2>Production performance</h2>
          <p>
            Availability <b>{pct(line.runTicks, line.plannedTicks)}</b> ·
            Performance <b>{pct(line.idealTicks, line.runTicks)}</b> · Quality{' '}
            <b>{pct(line.good, total)}</b>
          </p>
          <p>
            OEE{' '}
            <b>{pct(line.idealTicks * line.good, line.plannedTicks * total)}</b>{' '}
            · Reset discards {line.discarded}
          </p>
          <p>
            Last discharge{' '}
            {line.lastId
              ? '#' +
                line.lastId +
                ' · ' +
                (line.lastFailed || line.lastChecked !== 1023
                  ? 'Reject'
                  : 'Packed')
              : '—'}
          </p>
          <div className="commands">
            {action('Standard', 'Standard · 40 mm')}
            {action('Precision', 'Precision · 48 mm')}
          </div>
        </section>
      </div>
    </div>
  );
}
