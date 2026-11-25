import { useState } from 'react';
import type { ReactNode } from 'react';
import type { Frame, ConsoleEvent } from './model';
import { EventLog, Lamp } from './Telemetry';

interface DiagnosticProps {
  frame: Frame | null;
  online: boolean;
  guide: string;
  events: ConsoleEvent[];
  action: (command: string, label?: string, primary?: boolean) => ReactNode;
}

export function Diagnostics({
  frame,
  online,
  guide,
  events,
  action,
}: DiagnosticProps) {
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState('');
  const alerts = frame?.airFault || frame?.lowStock;
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
      <EventLog events={events} limit={60} />
    </>
  );
}
