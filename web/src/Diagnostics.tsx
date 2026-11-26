import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Frame, ConsoleEvent } from './model';
import { EventLog, Lamp } from './Telemetry';

interface DiagnosticProps {
  frame: Frame | null;
  online: boolean;
  guide: string;
  alarms: ConsoleEvent[];
  events: ConsoleEvent[];
  action: (command: string, label?: string, primary?: boolean) => ReactNode;
}

export function Diagnostics({
  frame,
  online,
  guide,
  alarms,
  events,
  action,
}: DiagnosticProps) {
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const alerts = frame?.airFault || frame?.lowStock || frame?.line.alarm;
  const state = frame?.state;

  async function postNote(event: React.FormEvent) {
    event.preventDefault();
    if (!note.trim()) return;
    try {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: note.trim() }),
      });
      if (!response.ok) throw new Error();
      setNote('');
      setNoteError('');
    } catch {
      setNoteError('Message could not be saved.');
    }
  }

  return (
    <>
      <div className="two-col">
        <section className="panel prose">
          <h2>Active conditions</h2>
          {Boolean(frame?.line.alarm) && (
            <div className="condition fault">
              <b>
                F02 #{frame!.line.occurrence} · Insert clamp extension timed out
              </b>
              <p>
                {frame!.line.jammed
                  ? 'Obstruction present'
                  : 'Obstruction removed'}{' '}
                ·{' '}
                {frame!.line.alarm === 2
                  ? 'Acknowledged'
                  : 'Acknowledgment required'}
              </p>
              {action('AckClamp', 'Acknowledge occurrence')}
              {action('ReleaseClamp', 'Remove obstruction')}
            </div>
          )}
          {frame?.airFault && (
            <div className="condition fault">
              <b>F01 · Supply pressure lost</b>
              <p>
                Cylinder motion is interrupted. Restore air, clear the abort,
                then reset.
              </p>
            </div>
          )}
          {frame?.lowStock && (
            <div className="condition warning">
              <b>W01 · Blank magazine low</b>
              <p>Refill the blank stack. The current cycle may finish.</p>
            </div>
          )}
          {!alerts && (
            <Lamp
              good={online}
              text={
                online
                  ? 'No active faults or warnings'
                  : 'Waiting for telemetry'
              }
            />
          )}
          {frame?.line.enabled && !frame.manual && (
            <p>
              ST-03 clamp ·{' '}
              {frame.line.clampRequest
                ? 'Extend requested'
                : 'Retract requested'}{' '}
              · {frame.line.clampMm} mm ·{' '}
              {frame.line.clampMm === 16
                ? 'Forward limit'
                : frame.line.clampMm === 0
                  ? 'Home limit'
                  : 'Travelling'}
            </p>
          )}
          <h3>Operator guidance</h3>
          <p>{online ? guide : 'Check the machine connection.'}</p>
          {state === 'Aborted' && action('Clear')}
        </section>
        <section className="panel prose">
          <h2>Simulated inputs</h2>
          <p>
            Exercise recovery using the virtual air supply and magazine sensor.
          </p>
          <div className="commands">
            {frame?.line.enabled && !frame.manual && (
              <>
                {action('JamClamp', 'Jam insert clamp')}
                {action('ReleaseClamp', 'Free insert clamp')}
              </>
            )}
            {action('DropAir')}
            {action('RestoreAir')}
            {action('LowBlanks')}
            {action('Refill')}
            {action('MissingSeal', 'Remove seal')}
            {action('RestoreSeal', 'Restore seal')}
          </div>
        </section>
      </div>
      <section className="panel prose">
        <h2>Operator messages</h2>
        <form onSubmit={postNote}>
          <label htmlFor="note">Shift note</label>
          <div className="note-field">
            <input
              id="note"
              value={note}
              maxLength={200}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Record an observation for this session"
            />
            <button className="primary" disabled={!note.trim()}>
              Add message
            </button>
          </div>
          {noteError && <p role="alert">{noteError}</p>}
        </form>
      </section>
      {alarms.length > 0 && (
        <section className="panel prose">
          <h2>Clamp alarm history</h2>
          {Array.from(new Set(alarms.map((e) => e.text.split(' · ')[0]))).map(
            (id) => (
              <details key={id} open={id === alarms[0].text.split(' · ')[0]}>
                <summary>{id}</summary>
                <ol>
                  {alarms
                    .filter((e) => e.text.startsWith(id + ' · '))
                    .slice()
                    .reverse()
                    .map((e) => (
                      <li key={e.id}>
                        <time>{new Date(e.at).toLocaleTimeString()}</time> ·{' '}
                        {e.text.split(' · ')[1]}
                      </li>
                    ))}
                </ol>
              </details>
            ),
          )}
        </section>
      )}
      <EventLog events={events} limit={60} />
    </>
  );
}
