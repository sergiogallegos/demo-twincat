import { useState } from 'react';
import type { ReactNode } from 'react';
import { stations, type Frame } from './model';

interface ControlProps {
  frame: Frame | null;
  online: boolean;
  feedback?: string;
  action: (command: string, label?: string, primary?: boolean) => ReactNode;
}

export function MachineControls({
  frame,
  online,
  action,
  feedback,
}: ControlProps) {
  const [selected, setSelected] = useState(1);
  const state = frame?.state;
  const continuous = frame?.line.enabled && !frame.manual;
  return (
    <footer className="command-dock" aria-label="Machine controls">
      <div className="dock-heading">
        <h2>Machine controls</h2>
        {online && feedback && (
          <small className="dock-feedback" role="status">
            {feedback}
          </small>
        )}
        <span>
          {!online
            ? 'Controls offline'
            : frame?.manual
              ? 'Manual bench'
              : continuous
                ? 'Continuous line'
                : 'Single-carton bench'}
        </span>
      </div>
      {state === 'Stopped' && (
        <div className="profile-actions">
          {!frame?.manual &&
            action(
              continuous ? 'Bench' : 'LoopLine',
              continuous ? 'Single-carton bench' : 'Continuous line',
            )}
          {action(
            frame?.manual ? 'Automatic' : 'Manual',
            frame?.manual ? 'Automatic mode' : 'Manual bench',
          )}
        </div>
      )}
      {frame?.manual && (
        <label className="dock-station">
          Station{' '}
          <select
            value={selected}
            onChange={(e) => setSelected(+e.target.value)}
          >
            {stations.map((s, i) => (
              <option key={s.name} value={i + 1}>
                {i + 1} · {s.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="dock-commands">
        {action('Reset')}
        {frame?.manual
          ? action('Stroke' + selected, 'Single stroke', true)
          : action('Start', continuous ? 'Run line' : 'Start cycle', true)}
        {action(state === 'Held' ? 'Unhold' : 'Hold')}
        {action(state === 'Suspended' ? 'Unsuspend' : 'Suspend')}
        {action('Stop')}
        {action(state === 'Aborted' ? 'Clear' : 'Abort')}
      </div>
    </footer>
  );
}
