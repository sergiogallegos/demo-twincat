import { useState } from 'react';
import './architecture.css';

const topics = [
  'Signal path',
  'PLC object model',
  'Hardware migration',
] as const;
const migration = [
  [
    'Unit control',
    'PackML states, command permissives, alarm occurrence IDs and carton accounting.',
    'Build in XAE, exercise transitions in an isolated XAR and measure PLC task timing.',
  ],
  [
    'XTS and XPlanar',
    'Ten cart identities, six planar mover identities and an occupied-to-empty handoff.',
    'Configure track geometry, tiles, movers and axes. Bind routed moves and wait for arrival, traffic clearance and fault feedback.',
  ],
  [
    'Paired servo axes',
    'Eight X/Z cam pairs share a virtual master. ST-06 follows the carton for leaflet insertion.',
    'Select drives and mechanics, set scaling and limits, configure NC coupling and cam tables. Measure following error and clearance under load.',
  ],
  [
    'Pneumatics and vision',
    'ST-03 demands extension and checks its virtual limit. The seal inspector reads five fixture intensities.',
    'Map valve and end sensors. Trigger a camera, set lighting and exposure, and validate pass/reject decisions on representative cartons.',
  ],
  [
    'HMI and commissioning',
    'React consumes one snapshot through C#. The ADS contract defines each command, result and feedback field.',
    'Keep the contract where its semantics hold. Commission physical I/O, communications loss, safe motion and guarding on the selected equipment.',
  ],
];

export function Architecture() {
  const [topic, setTopic] = useState<(typeof topics)[number]>('Signal path');
  const [source, setSource] = useState<'Portable' | 'ADS'>('Portable');
  const ads = source === 'ADS';
  return (
    <div className="engineering arch">
      <section className="panel arch-intro">
        <div>
          <h2>A virtual carton assembly line</h2>
          <p>
            Can a carton keep its identity, inspection results and route through
            a high-speed assembly and packing cycle? This proof of concept lets
            an engineer trace that question from an operator command to a
            finished or rejected carton on a PC.
          </p>
          <p className="arch-byline">
            Sergio Gallegos · Machine design, controls and software engineering
          </p>
        </div>
        <figure>
          <img
            src="/continuous-line.png"
            alt="Guarded XTS-style assembly loop and adjoining planar inspection table"
          />
        </figure>
      </section>
      <div role="group" aria-label="Architecture topics" className="arch-tabs">
        {topics.map((t) => (
          <button
            key={t}
            aria-pressed={topic === t}
            onClick={() => setTopic(t)}
          >
            {t}
          </button>
        ))}
      </div>
      {topic === 'Signal path' && (
        <section className="panel arch-content">
          <h2>Trace an operator command</h2>
          <p>
            Select a path to inspect its implementation. The live machine source
            appears in the status header.
          </p>
          <div
            className="arch-switch"
            role="group"
            aria-label="Inspect a machine source"
          >
            {(['Portable', 'ADS'] as const).map((s) => (
              <button
                key={s}
                aria-pressed={source === s}
                onClick={() => setSource(s)}
              >
                {s === 'Portable' ? 'Local simulation' : 'TwinCAT via ADS'}
              </button>
            ))}
          </div>
          <ol className="signal-flow">
            <li>
              <small>React / TypeScript</small>
              <h3>Operator console</h3>
              <p>
                Run line posts to <code>/api/commands</code>. The HMI polls{' '}
                <code>/api/machine</code> for the resulting state and positions.
              </p>
            </li>
            <li>
              <small>C# / ASP.NET Core</small>
              <h3>ConsoleService</h3>
              <p>
                The service checks and serializes requests, then polls the
                adapter selected at startup through <code>IMachine</code>.
              </p>
            </li>
            <li>
              <small>{ads ? 'TwinCAT ADS.NET' : 'C# plant'}</small>
              <h3>{ads ? 'AdsMachine' : 'SimulatedMachine'}</h3>
              <p>
                {ads
                  ? 'Writes one command word to GVL_HMI.Request and reads 106 DINTs from GVL_HMI.Status.'
                  : 'Advances virtual 10 ms scans in the host. Positions, clamp limits and carton counts come from this local simulation.'}
              </p>
            </li>
            <li>
              <small>
                {ads ? 'TwinCAT 3 / Structured Text' : 'Portable feedback'}
              </small>
              <h3>{ads ? 'FB_CartonCell' : 'Machine snapshot'}</h3>
              <p>
                {ads
                  ? 'The PLC checks the request and lets SPT dispatch the PackML state. During Execute the unit advances the line model.'
                  : 'The browser displays the carton ID, cam phase, inspection bits and output counts. This path runs without TwinCAT.'}
              </p>
            </li>
          </ol>
          <h3>Read the result</h3>
          <p>
            On either path, watch one carton reach final packing. Its inspection
            bits travel with its ID through the handoff. Packing consumes that
            ID once and increments the good or reject count. A command
            acknowledgment confirms how the controller handled the request.
            Completion comes from subsequent feedback.
          </p>
        </section>
      )}
      {topic === 'PLC object model' && (
        <section className="panel arch-content">
          <h2>Who owns a scan?</h2>
          <p>
            One <code>FB_CartonCell</code> instance in <code>MAIN</code> owns
            the unit. The TwinCAT PLC task calls its cyclic method every 10 ms
            in the project configuration.
          </p>
          <dl className="object-map">
            <div>
              <dt>Inheritance</dt>
              <dd>
                <code>FB_CartonCell</code> extends{' '}
                <code>SPT_BaseTypes.FB_PackML_BaseModule</code>. The unit
                samples the request once, checks permissives and calls its base
                implementation. SPT dispatches the active PackML state method.
              </dd>
            </div>
            <div>
              <dt>Composition</dt>
              <dd>
                During automatic <code>Execute()</code> the unit calls{' '}
                <code>Line.Step()</code> on its <code>FB_ContinuousLine</code>.
                The line owns the master pitch, eight cam pairs, carton IDs,
                inspection masks and discharge counts.
              </dd>
            </div>
            <div>
              <dt>Device interface</dt>
              <dd>
                The line calls <code>Follow()</code> and <code>Home()</code>{' '}
                through <code>I_LineClamp</code>. Its <code>FB_LineClamp</code>{' '}
                supplies simulated position feedback. ST-03 checks for 16 mm of
                travel before it credits the insert.
              </dd>
            </div>
            <div>
              <dt>Inspection and events</dt>
              <dd>
                The line asks <code>FB_SealInspection</code> for a verdict and
                records it on the carton. A missing clamp limit has a different
                consequence. After 15 executing scans it triggers F02, the unit
                requests Abort and <code>FB_LineEvents</code> reports the
                occurrence to TwinCAT EventLogger in the PLC design.
              </dd>
            </div>
          </dl>
          <h3>Try the interaction</h3>
          <p>
            With the line running, choose <strong>Jam insert clamp</strong> in
            Diagnostics. Follow the missing end limit, the PackML abort and the
            occurrence acknowledgment. The same objects explain the recovery
            path from obstruction removal through Clear and Reset.
          </p>
        </section>
      )}
      {topic === 'Hardware migration' && (
        <section className="panel arch-content">
          <h2>From software model to a commissioned machine</h2>
          <p>
            The main TwinCAT project contains a PLC task and a virtual plant.
            XTS, XPlanar, servo and camera labels describe modeled equipment.
            Even on a test PLC, the supplied application calculates feedback in
            software. Direct field control requires a separately engineered
            configuration.
          </p>
          <div className="migration-list">
            {migration.map(([area, model, field]) => (
              <article key={area}>
                <h3>{area}</h3>
                <div>
                  <small>Reusable concept</small>
                  <p>{model}</p>
                </div>
                <div>
                  <small>Field engineering</small>
                  <p>{field}</p>
                </div>
              </article>
            ))}
          </div>
          <p>
            <strong>Tested runtimes.</strong> The HMI exchanged commands and
            feedback over ADS with CartonPLC on a local TwinCAT Usermode Runtime
            and on a physical Beckhoff CX50x0. After the virtual line filled,
            the CX counted 30 good cartons in 59.953 seconds with zero rejects.
            The movers, servo axes and seal inspection ran as software models on
            both targets.
          </p>
        </section>
      )}
      <section className="panel arch-content">
        <h2>Engineering workflow</h2>
        <p>
          The machine layout defines where a carton can transfer. The controls
          define when it may transfer. The software makes that decision
          observable through inspection masks, alarms and test traces. FreeCAD
          holds the solid assembly and Blender supplies the browser model.
        </p>
        <p>
          Codex assisted with implementation, debugging, test automation and
          documentation. The engineer owns design choices, reviews the evidence
          and determines what needs physical validation.
        </p>
      </section>
    </div>
  );
}
