import { useState } from 'react';
import { operations, planarOps, pose } from './lineLayout';
import type { LineFrame } from './model';

export function LineEquipment({
  line,
  online,
}: {
  line: LineFrame;
  online: boolean;
}) {
  const [fleet, setFleet] = useState<'Assembly' | 'Planar'>('Assembly');
  const assembly = fleet === 'Assembly';
  function at(slot: number) {
    const count = assembly ? 10 : 6;
    return (
      ((slot + count - (line.index % count)) % count) + (assembly ? 0 : 10)
    );
  }
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Equipment feedback</h2>
        <div className="line-tabs">
          {(['Assembly', 'Planar'] as const).map((v) => (
            <button
              key={v}
              aria-pressed={fleet === v}
              onClick={() => setFleet(v)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="prose">
        <p>
          {online
            ? 'Live machine feedback'
            : 'Last observed feedback · offline'}{' '}
          · {line.precision ? 'Precision' : 'Standard'} recipe · master index{' '}
          {line.index} · travel {(line.travel / 10).toFixed(1)}%
        </p>
      </div>
      <div className="table-scroll">
        <table className="equipment-table">
          <thead>
            <tr>
              {[
                'Station',
                'Mover',
                'Carton',
                assembly ? 'X servo' : 'Table X',
                assembly ? 'Z servo' : 'Table Y',
                'Feedback',
              ].map((v) => (
                <th key={v} scope="col">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(assembly ? operations : planarOps).map((name, i) => {
              const m = at(assembly && i >= 4 ? i + 1 : i);
              const [x, y] = pose(m, line);
              const present = Boolean(line.products[m]);
              const bit = assembly ? i : i === 1 ? 8 : i === 2 ? 9 : -1;
              const result =
                bit < 0
                  ? '—'
                  : (line.checked[m] & (1 << bit)) === 0
                    ? 'Pending'
                    : (line.failed[m] & (1 << bit)) !== 0
                      ? 'Failed'
                      : 'Passed';
              return (
                <tr key={i}>
                  <th scope="row">
                    {String(i + 1).padStart(2, '0')} · {name}
                  </th>
                  <td>
                    {assembly ? 'X' : 'P'}
                    {String(assembly ? m + 1 : m - 9).padStart(2, '0')}
                  </td>
                  <td>{present ? '#' + line.products[m] : 'Empty'}</td>
                  <td>{assembly ? line.camX[i] : Math.round(x)} mm</td>
                  <td>{assembly ? line.camZ[i] : Math.round(y)} mm</td>
                  <td>{present ? result : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="prose">
        <p>
          {assembly
            ? 'ST-03 clamp: ' +
              (line.clampRequest ? 'extend' : 'retract') +
              ' requested · ' +
              line.clampMm +
              ' mm measured. ST-06 follows the cart during leaflet insertion.'
            : 'Positions use the same virtual table coordinates as the CAD. Seal vision latches its result on each carton before final packing.'}
        </p>
      </div>
    </section>
  );
}
