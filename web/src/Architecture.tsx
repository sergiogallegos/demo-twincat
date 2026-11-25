import { Icon } from './Icon';

const layers = [
  [
    '01',
    'Operator console',
    'React · TypeScript',
    'Renders the latest snapshot, enables permitted commands and moves the 3D rods from position feedback.',
  ],
  [
    '02',
    'Application service',
    'C# · ASP.NET Core',
    'Serializes command requests, polls a typed machine adapter and timestamps changes for the operator log.',
  ],
  [
    '03',
    'Machine unit',
    'TwinCAT · SPT / PackML',
    'Owns unit mode, transition authority, station order and the finished-carton counter.',
  ],
  [
    '04',
    'Mechanism',
    'Station · Cylinder',
    'Turns one step request into an outstroke and return. The virtual forward and home limits end each movement.',
  ],
];

export function Architecture() {
  return (
    <div className="engineering">
      <section className="panel">
        <div className="panel-head">
          <h2>Control architecture</h2>
          <Icon name="design" />
        </div>
        <div className="layers">
          {layers.map(([id, title, tech, description]) => (
            <article key={id}>
              <small>{id}</small>
              <h3>{title}</h3>
              <b>{tech}</b>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="two-col">
        <section className="panel prose">
          <h2>Inside one 10 ms scan</h2>
          <ol>
            <li>
              <code>MAIN</code> calls <code>FB_CartonCell.CyclicLogic()</code>.
              The unit samples the ADS request word once and checks its sequence
              and permissives.
            </li>
            <li>
              The SPT base dispatches the active PackML state method. In{' '}
              <code>Execute()</code>, the unit calls one station’s{' '}
              <code>Step()</code>.
            </li>
            <li>
              The station asks its cylinder to extend until the forward limit,
              then retract until home. The fifth home confirmation completes an
              automatic carton.
            </li>
            <li>
              The unit publishes one status array. The service decodes it into a
              frame, and the HMI updates the diagram, model and controls.
            </li>
          </ol>
        </section>
        <section className="panel prose">
          <h2>Design patterns in the source</h2>
          <h3>Template Method</h3>
          <p>
            <code>FB_CartonCell</code> extends <code>FB_PackML_BaseModule</code>
            . The library dispatches state callbacks. The machine supplies its
            sequence in <code>Execute</code> and signals{' '}
            <code>StateComplete()</code>.
          </p>
          <h3>Composition</h3>
          <p>
            Five <code>FB_StrokeStation</code> instances each own a{' '}
            <code>FB_VirtualCylinder</code>. Position and limit feedback stay
            with the actuator. Station completion stays with the station.
          </p>
          <h3>Adapter and dependency injection</h3>
          <p>
            The C# host chooses <code>AdsMachine</code> or{' '}
            <code>SimulatedMachine</code> behind <code>IMachine</code>. Both
            present the same frame and accept the same command word.
          </p>
        </section>
      </div>
      <section className="panel prose">
        <h2>From device feedback to a routing decision</h2>
        <p>
          <code>FB_CellDevices</code> composes a feed axis, carrier, two shuttle
          coordinates and a seal inspector. A station remains selected while its
          carrier indexes. The inspection samples the closure once at the
          forward limit. The discharge logic counts a carton only after reading
          that latched verdict.
        </p>
        <p>
          The portable plant advances positions on simulated 10 ms ticks. The
          native labs show where to substitute NC axis references, a simulated
          XTS processing unit, planar mover command feedback and a Vision File
          Source. The Device labs page displays the same status block as the
          operator screen.
        </p>
        <h2>Reuse this cell</h2>
        <p>
          Start with one carton in automatic mode. Switch to manual while
          Stopped to isolate one station. Trace the request in{' '}
          <code>server/Machine.cs</code>, <code>E_ConsoleCommand.TcDUT</code>{' '}
          and <code>FB_CartonCell.ApplyCommand</code>. Extend the station
          sequence and shared geometry together when adding a mechanism.
        </p>
        <p>
          See <code>docs/architecture.md</code> for extension points,{' '}
          <code>docs/ads.md</code> for the wire layout and{' '}
          <code>docs/commissioning.md</code> for the validation sequence.
        </p>
      </section>
    </div>
  );
}
