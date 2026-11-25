import { useState } from 'react';
import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { stations } from './model';
import type { Frame } from './model';

interface ControlProps {
  frame: Frame | null;
  allowed: string[];
  busy: boolean;
  online: boolean;
  guide: string;
  send: (command: string) => Promise<void>;
  action: (command: string, label?: string, primary?: boolean) => ReactNode;
}

export function MachineControls({
  frame,
  allowed,
  busy,
  online,
  guide,
  send,
  action,
}: ControlProps) {
  const [selected, setSelected] = useState(1);
  const state = frame?.state;
  const mode = frame ? (frame.manual ? 'Manual' : 'Automatic') : '�';
  return (
    <section className="panel controls">
      <div className="panel-head">
        <h2>Machine controls</h2>
        <Icon name="mode" />
      </div>
      <div className="control-body">
        <label className="label">Operating mode</label>
        <div className="segmented">
          {['Automatic', 'Manual'].map((name) => (
            <button
              key={name}
              aria-pressed={mode === name}
              className={mode === name ? 'chosen' : ''}
              disabled={busy || !allowed.includes(name)}
              onClick={() => void send(name)}
            >
              {name}
            </button>
          ))}
        </div>
        <div className="rule" />
        <div className="label">Cycle commands</div>
        {frame?.manual && (
          <label className="station-select">
            Station
            <select
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
            >
              {stations.map((s, i) => (
                <option key={s.name} value={i + 1}>
                  {i + 1} · {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="commands">
          {action('Reset')}
          {frame?.manual
            ? action('Stroke' + selected, 'Single stroke', true)
            : action('Start', 'Start cycle', true)}
          {action(state === 'Held' ? 'Unhold' : 'Hold')}
          {action('Stop')}
          {action(state === 'Suspended' ? 'Unsuspend' : 'Suspend')}
          {action(state === 'Aborted' ? 'Clear' : 'Abort')}
        </div>
        <div className="operator">
          <Icon name="msg" />
          <div>
            <b>Operator message</b>
            <p>
              {online ? guide : 'Telemetry unavailable. Controls are offline.'}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
