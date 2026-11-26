import { createRoot } from 'react-dom/client';
import { useState } from 'react';
import { Devices } from './Devices';
import { Diagnostics } from './Diagnostics';
import { Architecture } from './Architecture';
import { Icon } from './Icon';
import { MachineView } from './MachineView';
import { PackML } from './PackML';
import { displayCommand, instruction } from './model';
import { Lamp, StationSequence, EventLog } from './Telemetry';
import { MachineControls } from './MachineControls';
import { useConsole } from './useConsole';
import './style.css';

const pages = [
  ['overview', 'Overview'],
  ['states', 'PackML states'],
  ['alarms', 'Diagnostics'],
  ['devices', 'Device labs'],
  ['design', 'Architecture'],
] as const;
type Page = (typeof pages)[number][0];
const titles: Record<Page, string> = {
  overview: 'Machine overview',
  states: 'PackML state monitor',
  alarms: 'Diagnostics',
  devices: 'Device labs',
  design: 'Architecture & design',
};
const descriptions: Record<Page, string> = {
  overview: 'Five-station pneumatic carton packer',
  states: 'Live unit state and transition history',
  alarms: 'Active conditions, recovery actions and operator messages',
  devices: 'Servo feed, XTS transfer, seal inspection and XPlanar discharge',
  design: 'An engineering guide to the carton cell',
};

function App() {
  const [page, setPage] = useState<Page>('overview');
  const [reset, setReset] = useState(0);
  const { data, send, busy, error } = useConsole();
  const frame = data?.frame ?? null;
  const online = Boolean(data?.online);
  const events = data?.events ?? [];
  const allowed = data?.allowed ?? [];
  const state = frame?.state ?? 'Waiting';
  const alerts =
    Number(frame?.airFault ?? false) + Number(frame?.lowStock ?? false);
  const mode = frame ? (frame.manual ? 'Manual' : 'Automatic') : '—';
  const guide = instruction(frame);
  const badge =
    state === 'Execute'
      ? 'green'
      : ['Aborted', 'Aborting'].includes(state)
        ? 'red'
        : 'neutral';

  function action(command: string, label?: string, primary = false) {
    return (
      <button
        key={command}
        className={primary ? 'primary' : ''}
        disabled={!online || busy || !allowed.includes(command)}
        onClick={() => void send(command)}
      >
        {label ?? displayCommand[command] ?? command}
      </button>
    );
  }

  return (
    <div className="shell">
      <aside className="rail">
        <div className="brand">
          <img src="/beckhoff-logo.svg" alt="Beckhoff" />
        </div>
        <div className="rail-title">
          <Icon name="cube" size={22} />
          <strong>Carton Cell</strong>
        </div>
        <nav aria-label="Main navigation">
          {pages.map(([id, label]) => (
            <button
              key={id}
              className={page === id ? 'active' : ''}
              aria-current={page === id ? 'page' : undefined}
              onClick={() => setPage(id)}
            >
              <Icon name={id} />
              <span>{label}</span>
              {id === 'alarms' && alerts > 0 && (
                <b className="count">{alerts}</b>
              )}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <small>CONTROL PLATFORM</small>
          <b>TwinCAT 3</b>
          <span>SPT Framework · PackML</span>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <span>
            Carton Cell <em>/</em> Operator console
          </span>
          <div>
            <Lamp good={online} text={online ? 'Connected' : 'Offline'} />
            <span className="source">
              {data?.source === 'Ads'
                ? 'ADS · PLC'
                : data?.source === 'Simulation'
                  ? 'Local simulation'
                  : (data?.source ?? 'Connecting')}
            </span>
          </div>
        </header>
        <div className="workspace">
          <header className="page-head">
            <div>
              <h1>{titles[page]}</h1>
              <p>{descriptions[page]}</p>
            </div>
            <span className={'chip ' + badge}>
              <i />
              {state}
            </span>
          </header>
          {(!online || error) && (
            <div role="status" className="notice">
              {error || data?.issue || 'Connecting to the machine service…'}
            </div>
          )}
          {alerts > 0 && page !== 'alarms' && (
            <button
              className={frame?.airFault ? 'banner fault' : 'banner warning'}
              onClick={() => setPage('alarms')}
            >
              <Icon name="alarms" />
              {frame?.airFault
                ? 'F01 · Supply pressure lost'
                : 'W01 · Blank magazine low'}
              <span>View diagnostics →</span>
            </button>
          )}
          {page === 'overview' && (
            <>
              <div className="metrics">
                {[
                  ['pulse', 'PackML state', state],
                  ['mode', 'Operating mode', mode],
                  ['carton', 'Cartons packed', String(frame?.cartons ?? '—')],
                  [
                    'station',
                    'Active station',
                    frame?.station
                      ? String(frame.station).padStart(2, '0') + ' / 05'
                      : '— / 05',
                  ],
                ].map(([icon, label, value]) => (
                  <div className="metric" key={label}>
                    <div>
                      <Icon name={icon} />
                      <span>{label}</span>
                    </div>
                    <strong>{value}</strong>
                  </div>
                ))}
              </div>
              <div className="overview-grid">
                <section className="panel machine-panel">
                  <div className="panel-head">
                    <h2>Machine simulation</h2>
                    <button
                      className="view-btn"
                      aria-label="Reset camera view"
                      onClick={() => setReset((i) => i + 1)}
                    >
                      <Icon name="reset" size={16} />
                      Reset view
                    </button>
                  </div>
                  <MachineView frame={frame} reset={reset} />
                </section>
                <MachineControls
                  {...{ frame, allowed, busy, online, guide, send, action }}
                />
              </div>
              <StationSequence frame={frame} />
              <EventLog events={events} limit={4} />
            </>
          )}
          {page === 'states' && (
            <>
              <PackML frame={frame} />
              <StationSequence frame={frame} />
              <EventLog
                events={events.filter((e) => e.kind === 'Transition')}
              />
            </>
          )}
          {page === 'alarms' && (
            <Diagnostics {...{ frame, online, guide, events, action }} />
          )}
          {page === 'devices' && <Devices frame={frame} online={online} />}
          {page === 'design' && <Architecture />}
        </div>
      </main>
    </div>
  );
}
createRoot(document.getElementById('root')!).render(<App />);
