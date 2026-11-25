# ADS interface · protocol 51002

The HMI service is the single command writer for a PLC instance. Configure the AMS Net ID and runtime port in the host environment. The web browser talks HTTP to the local service.

## Published symbols

| Symbol | PLC type | Direction |
| --- | --- | --- |
| `GVL_HMI.Request` | DINT | Service writes one request word. |
| `GVL_HMI.Status` | ARRAY[0..19] OF DINT | PLC publishes one 80-byte block each scan. |

| Status index | Meaning |
| --- | --- |
| 0 | Protocol signature 51002 |
| 1 | PackML state, numeric values below |
| 2 | Operating profile, 0 automatic or 1 manual stroke |
| 3 | Selected station 1–5, or 0 after Reset |
| 4 | Stroke phase 0–100 extends, 101–200 retracts. Cylinder position equals min(phase, 200 − phase) percent. |
| 5 | Finished automatic cartons since PLC initialization |
| 6 | F01 air-pressure fault input, 1 active |
| 7 | W01 low-stock input, 1 active |
| 8 | Last consumed request word, including rejected requests |
| 9 | Scan heartbeat |
| 10 | Last request passed machine permissives, 1 accepted or 0 rejected |

State codes follow **Tc3_PackML_V2.E_PMLState**. 0 Undefined, 1 Clearing, 2 Stopped, 3 Starting, 4 Idle, 5 Suspended, 6 Execute, 7 Stopping, 8 Aborting, 9 Aborted, 10 Holding, 11 Held, 12 Unholding, 13 Suspending, 14 Unsuspending, 15 Resetting, 16 Completing, 17 Complete. [Beckhoff state enumeration](https://infosys.beckhoff.com/content/1033/tcplclib_tc3_packml_v2/1335936523.html)

| Additional device words | Meaning |
| --- | --- |
| 11, 12 | Feed and track position in millimetres |
| 13, 14 | Sorter X and signed Y in millimetres |
| 15 | Inspection latch, 0 pending, 1 pass, 2 reject |
| 16 | Rejected carton count |
| 17 | Missing seal fixture enabled |
| 18 | Track indexing to the next nest |
| 19 | Bright samples from the latched inspection, 0–5 |

## Command handshake

The low eight bits encode the command. The remaining positive bits encode a sequence. The host selects the next sequence from the last acknowledged word, writes once and waits for the PLC to echo the full word. The PLC samples one DINT, applies each changed word once and rechecks mode and state locally. Acceptance records request consumption. Observe the resulting PackML state to confirm a transition.

| IDs | Commands in increasing ID order |
| --- | --- |
| 1–5 | Reset, Start, Hold, Unhold, Suspend |
| 6–10 | Unsuspend, Stop, Abort, Clear, Automatic |
| 11–16 | Manual, Stroke1, Stroke2, Stroke3, Stroke4, Stroke5 |
| 17–20 | DropAir, RestoreAir, LowBlanks, Refill |
| 21–22 | MissingSeal, RestoreSeal |

For example, sequence 1 plus command 1 is decimal 257. Reset is sent as `257`. After the PLC publishes status word 8 equal to 257, word 10 reports acceptance. The HTTP controls follow the observed state and the host serializes simultaneous requests from multiple browser tabs.

## Verify the transport locally

With a running TwinCAT ADS router, execute `dotnet run --project tests/AdsLoopback`. The test registers its own local server at port 58051 and connects through the real ADS client. It exercises symbolic handle acquisition, an 80-byte status read, signed positions, an atomic command write, acknowledgment and reconnect. The test target owns two synthetic symbols for the duration of the test. PLC port 851 remains a separate commissioning target.

## HTTP interface

* `GET /api/machine` returns the source, connection status, frame, available commands, pending request and newest-first event history.
* `POST /api/commands` accepts JSON such as `{"command":"Reset"}`. A 202 means submitted. A 409 means the request conflicts with the sampled state or another pending command. A 503 means the selected source is unavailable.
* `POST /api/messages` accepts `{"text":"Magazine refilled"}`. Messages contain 1–200 characters after trimming and remain in the host session.

The host polls at approximately 80 ms while connected. The browser schedules the next request 140 ms after a response. A stalled scan heartbeat or failed ADS read makes controls unavailable. Reconnection opens fresh symbol handles. A lost acknowledgment produces an operator-log entry. Confirm machine state before issuing another request. Telemetry and history are sampled, so this interface is unsuitable as a scan-level trace recorder.
