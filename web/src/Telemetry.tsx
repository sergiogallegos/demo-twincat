import { Icon } from './Icon';
import { phaseLabel, stations } from './model';
import type { ConsoleEvent, Frame } from './model';

export function Lamp({ good = false, text }: { good?: boolean; text: string }) {
  return (
    <span className={'lamp ' + (good ? 'good' : '')}>
      <i />
      {text}
    </span>
  );
}

export function EventLog({
  events,
  limit = 8,
}: {
  events: ConsoleEvent[];
  limit?: number;
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Event log</h2>
        <Icon name="log" />
      </div>
      <div className="event-list">
        {events.slice(0, limit).map((event) => (
          <div className="event" key={event.id}>
            <time>
              {new Date(event.at).toLocaleTimeString('en-GB', {
                hour12: false,
              })}
            </time>
            <b className={'event-kind ' + event.kind.toLowerCase()}>
              {event.kind}
            </b>
            <span>{event.text}</span>
          </div>
        ))}
        {!events.length && <p className="muted">Waiting for machine events.</p>}
      </div>
    </section>
  );
}

export function StationSequence({ frame }: { frame: Frame | null }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Station sequence</h2>
        <span className="subtle">One carton per automatic cycle</span>
      </div>
      <div className="stations">
        {stations.map((station, i) => {
          const active = i + 1 === frame?.station;
          const done = frame && !frame.manual && frame.station > i + 1;
          return (
            <article key={station.name} className={active ? 'selected' : ''}>
              <small>ST-{String(i + 1).padStart(2, '0')}</small>
              <h3>{station.name}</h3>
              <div className="station-track">
                <i
                  style={{
                    width: active
                      ? Math.max(3, frame.phase / 2) + '%'
                      : done
                        ? '100%'
                        : '0',
                  }}
                />
              </div>
              <span>
                {active
                  ? frame.state === 'Execute'
                    ? phaseLabel(frame)
                    : frame.state
                  : done
                    ? 'Complete'
                    : 'Standby'}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
