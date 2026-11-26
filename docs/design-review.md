# Engineering walkthrough

For the continuous line, trace one carton in the [architecture guide](architecture.md), then follow the [continuous commissioning exercise](commissioning.md#continuous-line-acceptance). The questions below cover the selectable five-station teaching bench.

**Who can advance a station?** In ADS mode only the PLC task calls `FB_CartonCell.Execute`. It observes a returned cylinder, the process-device completion condition and the next carrier position. Browser refresh rate has no effect on the sequence. Hold stops progression but retains the active station and stroke. Reset deliberately discards an interrupted virtual carton.

**Why separate state, phase and feedback?** Execute describes the unit. A station number identifies the process. Phase identifies a cylinder's position in its out-and-back cycle. During indexing, the cylinder can already be home while the unit is still executing the same station. A single “running” Boolean cannot distinguish these cases. Inspect words 1, 3, 4, 12 and 18 together.

**Why does the HMI send a command word?** A browser click and a PLC scan run on different clocks. A short Boolean pulse could be missed, and separate writes for a command and its trigger could be observed in different scans. One DINT carries both operation and sequence. The service serializes writers and waits for an echoed token. A transport acknowledgment and observed completion are separate events.

**What does the digital model establish?** A deterministic software plant makes a lost seal and both sorting routes reproducible without physical hardware. The included native labs exercise the public NC, XTS, planar and Vision interfaces separately. Real motor tuning, mechanical tolerances, pressure loss under load, collision avoidance and safety performance require their own commissioning evidence.

**How would you add real devices?** Keep the cell's process contract. Replace a bounded axis increment with a cyclic device adapter that issues a motion command once, samples Busy/Done/Error and exposes actual position. Replace the stored scan line with a triggered acquisition and associate its result with the carton before transfer. Add deadlines and explicit fault identities for a missing sensor or failed move. Test stop and recovery behavior at every handoff.

**How do you find an integration error?** Trace one request from `useConsole.ts` to `ConsoleService.Command`, `AdsMachine.Write`, `GVL_HMI.Request` and `FB_CartonCell.ApplyCommand`. Then trace the return path through `PublishStatus`, `AdsMachine.Read` and the typed React frame. Compare the PLC heartbeat, acknowledged token and status signature before investigating animation.

**What should reviewers verify?** Use the simulator smoke test for mode guards, interruptions, manual isolation, inspection routing and counters. In XAE, also confirm library resolution, the task binding, user-mode transitions and status watch values. Inspect native device feedback online before claiming parity with a physical device.

## Verification boundary

The portable C# plant and HTTP interface have repeatable functional checks, including both sorter lanes. The engineering objects, ADS word layout and native model assets have structural checks. The native servo and XTS projects and Vision File Source setup require their matching installed functions. XAE compilation, PLC runtime commissioning and native motion/vision feedback must also be verified on the chosen TwinCAT installation.
