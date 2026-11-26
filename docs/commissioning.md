# Local setup and commissioning

## Hardware-free simulation

Follow the quick start in the [README](../README.md). Check `dotnet --list-sdks` for a 10.x SDK and `node --version` for Node 22.x. npm installs the pinned frontend dependencies from `web/package-lock.json`. Building the frontend writes its production files to `server/wwwroot`. Run the host from the repository with `dotnet run --project server`.

For frontend development, keep the C# host running on port 5080. In a second terminal run `npm --prefix web run dev` and open the Vite URL printed in the terminal. Vite proxies `/api` to the local host. Restarting the simulator resets its carton count and session history.

## Choose the machine source

The [three launch commands](../README.md#start-the-hmi-in-one-of-three-modes) select the source explicitly for that process. All modes serve the browser at `http://127.0.0.1:5080`. With the simulator the C# host owns the machine state. With ADS the selected TwinCAT runtime owns the machine state. The browser always connects to ASP.NET Core over HTTP.

## Beckhoff PLC with virtual mechanisms

This optional procedure is for testing the PLC application and its ADS interface. A download to an isolated physical PLC changes where the software model executes. The supplied project has no mapped field outputs, and commands such as **Run line** and **Single stroke** affect only the simulated mechanisms. The [task board](board.md) records the local x64 Usermode Runtime and physical x86 CX tests.

1. On a Windows engineering station install TwinCAT 3 XAE with PLC engineering, TwinCAT XAR on the designated test target, and a **TC1200** PLC runtime license or trial. Beckhoff supplies **Tc3_PackML_V2** with TC1200. [PLC library catalog](https://infosys.beckhoff.com/content/1033/tcinfosys3/4340797963.html) The system project was saved with XAE 3.1.4026.28. The physical CX test used a 3.1.4024.44 runtime. For the License editor on that target, install the matching 4024 Remote Manager from the Beckhoff Outdated Feed and load it in the 32-bit XAE Shell. Confirm the toolbar shows the intended engineering build and target. Resolve the v2 PackML library and the pinned SPT v3 family. Install the TwinCAT ADS router on the computer running the C# host.
2. Clone the SPT library repository in a sibling directory and select the exact revision used by this demo. SSH requires a configured Git SSH key. HTTPS cloning also works.

   ```sh
   git clone git@github.com:Beckhoff-USA-Community/SPT-Libraries.git ../SPT-Libraries
   git -C ../SPT-Libraries checkout f598024bfe1cbbbca808f36958914b8497119191
   ```

3. Open [CartonCell.sln](../plc/CartonCell.sln) in TwinCAT XAE. Open **PLC → Library Repository → Edit Locations → Add** and select the cloned **Library Repository** directory. Resolve **SPT Base Types 3.9.0**, **SPT Event Logger 3.9.0**, **Tc3_EventLogger** and **Tc3_PackML_V2** in the PLC Reference Manager. TwinCAT must also resolve their standard system dependencies. [SPT library installation](https://github.com/Beckhoff-USA-Community/SPT-Libraries)
4. Choose the local engineering runtime or an isolated Beckhoff test PLC. Build the solution and inspect the Errors window. The system task is 10 ms, PLC port 851, with no mapped field outputs. Activate the configuration **only on the intended test target**, log in, download and run the PLC. Activation can interrupt the selected runtime.
5. For a remote target, establish the trusted ADS route between HMI host and PLC in TwinCAT. Record the target’s six-field AMS Net ID and runtime port. For a runtime on this PC, read the local target’s AMS Net ID in XAE. A separate Usermode Runtime can have its own Net ID. In an online watch check `GVL_HMI.Status[0] = 51003` and confirm that index 9 advances.
6. Stop any C# simulator occupying port 5080. From the repo root, launch the same application in ADS mode using PowerShell. Substitute your test target's Net ID as appropriate.

   ```powershell
   $env:Machine__Source = 'Ads'
   $env:Machine__AmsNetId = Read-Host 'AMS Net ID of the selected local runtime or test PLC'
   $env:Machine__Port = '851'
   dotnet run --project server
   ```

7. Open the console and verify **Connected · ADS · PLC**. SPT normally powers up in Aborted. With the virtual pressure fault clear, select **Clear abort**, wait for Stopped, then **Reset cell → Start cycle**. Observe the same state and phase in the PLC watch and HMI. To return to the portable simulator, stop the host, set `$env:Machine__Source = 'Simulation'` and restart it.

## Continuous-line acceptance

The top header follows the selected machine on every HMI page. It shows the PackML state, operating mode, connection source, alert status, and packed/rejected counts. Use the bottom command dock to operate the unit. Only the center page scrolls. The ADS and portable sources use the same controls.

1. Begin in Automatic / Stopped with **Continuous line** selected. Select Standard, Reset and Run. Wait until the pipeline fills. Observe ten XTS and six planar mover IDs, several simultaneous cartons and one new discharge every two seconds during uninterrupted Execute (30/min).
2. Select a mover on the plan. Compare its carton ID and inspection mask before and after handoff. At final discharge a good carton has check mask 0x3FF and failure mask 0. At all times, issued = packed + rejected + reset discards + occupied movers.
3. Hold during transport. Compare master tick, index, carton IDs and axis feedback across successive reads. Resume. Repeat with Suspend / Unsuspend. Observe ST-06 X tracking at 1:1 gearing during the insertion window in the servo scope.
4. Remove the seal. A carton arriving at planar vision takes bit 9 in its fail mask. Restore the seal. Previously inspected work retains its verdict.
5. Arm **Jam insert clamp**. After 15 demanded scans without the forward limit, F02 aborts. Check demand and measured position. Send an acknowledgment for a different occurrence and expect HTTP 409. Acknowledge the displayed occurrence, verify Clear is still unavailable, remove the obstruction, then Clear and Reset. Check the occurrence history and verify that cleared work does not count as output. In XAE use **TwinCAT Logged Events** to inspect the native alarm and recovery message on a commissioned target.
6. Stop and select Precision. Reset and Run. Confirm a 48 mm Z stroke and 30/min steady-state target. Switch tabs and operate Hold/Resume from the bottom dock. The top header should update on every page.
7. For regression evidence run `dotnet run --project tests/LineBench` and `python scripts/verify_contract.py`. Against a fresh portable host run `python scripts/smoke_line.py`, then `python scripts/smoke.py`. The HTTP smoke tests exercise fault injection and require the Simulation source. To time throughput on either source, run `python scripts/measure_rate.py` while the line is in Execute with a good seal. It reads the discharge counter over 30 output intervals using the PC monotonic clock. The first observed discharge starts the measurement so pipeline fill is excluded.

### Observed two-second cycle

The deterministic test counts exactly 200 executing scans between steady-state discharges. On clean portable hosts the HMI observed 30 additional good cartons in 59.94 s and 60.03 s. The local x64 CartonPLC on a Windows Usermode Runtime took 60.95 s for 30 good cartons with zero rejects in one run (29.53/min). Two more runs measured 29.32/min and 29.25/min and missed the rate check’s ±0.5 carton/min tolerance. Runtime scheduling and HTTP sampling affect the wall-clock measurement. A physical output rate requires measurement on commissioned equipment. [Beckhoff Usermode Runtime timing](https://infosys.beckhoff.com/content/1033/tc170x_tc3_usermode_runtime/11319890955.html)

On a physical CX50x0 running the x86 CartonPLC application under TwinCAT 3.1.4024.44, the PC HMI sent Clear, Reset and Start over ADS. After pipeline fill, the PLC packed counter advanced from 1 to 31 in 59.953 wall-clock seconds with zero rejects (30.02 simulated cartons/min). Independent reads of the target's heartbeat and packed counter agreed with the HMI within one refresh. The CX executed the control logic with virtual movers, axes and inspections.

## Single-carton bench acceptance

Select **Single-carton bench** while Stopped before performing the following automatic commissioning exercises.

| Test | Expected observation |
| --- | --- |
| Automatic cycle | All five station numbers appear in order. ST-05 returns home, Complete appears and one carton is counted. |
| Hold / Resume | Position freezes in Held. Resume finishes the interrupted stroke. |
| Suspend / Unsuspend | The diagram follows the suspension branch and rejoins Execute. |
| Stop in mid-stroke | No subsequent station advances. Reset homes the virtual mechanism and discards the partial carton. |
| Manual mode | Change modes while Stopped. A single stroke operates the selected station and leaves the production count unchanged. |
| Seal inspection and sorting | With a good seal, verify 5/5 bright samples, Y +120 mm and one accepted carton. Remove the seal before running another carton. Expect 0/5, Y −120 mm, one reject and an unchanged accept counter. |
| Simulated air loss | F01 appears, motion freezes and the unit aborts. Clear is unavailable until air is restored. |
| Low magazine | W01 is visible during production. Refill clears it and records recovery. |
| Communication loss | Stop the test runtime or disconnect the test route. The HMI shows Offline and disables machine commands. Restore the connection and confirm the source before resuming. |
| Operator message | A submitted shift note is visible under Diagnostics with a timestamp. |

With a freshly started **C# simulator**, run `python scripts/smoke.py` from another terminal. Python 3.10+ is sufficient. The test drives the HTTP interface and checks carton count, manual strokes, permissives, warnings, faults and notes. Use the table for real PLC acceptance.

## Troubleshooting

### XAE reports “The application which this project type is based on was not found”

The GUID `B1E792BE-AA5F-4E3C-8C82-674BF9C0715B` identifies the Beckhoff TwinCAT system project loader for `.tsproj` files. The IDE needs that loader before it can read the PLC or resolve SPT references.

1. Start the **TwinCAT XAE Shell** that has TwinCAT PLC engineering integrated. Select **File → Open → Project/Solution** and open `plc\CartonCell.sln`. On a machine with the integration in the 32-bit shell, run the following from the repository root.

   ```powershell
   & "${env:ProgramFiles(x86)}\Beckhoff\TcXaeShell\Common7\IDE\TcXaeShell.exe" (Resolve-Path .\plc\CartonCell.sln).Path
   ```

2. If the same error persists, open **File → New → Project** in that shell and search for **TwinCAT XAE Project**. If the template is missing, check the TwinCAT XAE engineering installation. On build 4026, open **TwinCAT Package Manager → Settings → Integration**, select the shell you intend to use, save and reopen the IDE. [Beckhoff integration instructions](https://infosys.beckhoff.com/content/1033/tc3_installation/20646416267.html)
3. Confirm that the Solution Explorer expands to **CartonCell → PLC → CartonPLC**. Then resolve any library references using the commissioning steps above.

### Simulation and commissioning symptoms

| Symptom | Check |
| --- | --- |
| Root URL is blank or returns 404 | Build the frontend and check that `server/wwwroot/index.html` exists. Open the HTTP URL, not the HTML file on disk. |
| Model shows “Assembly render” | Check WebGL 2 availability and browser hardware acceleration. The static render is the fallback. The station sequence still shows current telemetry. |
| ADS source stays offline | Confirm XAR is running, the Net ID and port match the target, both ends have the ADS route and port 851 has the downloaded application. Read the service log for the ADS error. |
| Protocol mismatch or missing symbol | Rebuild and download this PLC project, verify symbol access, and watch both variables in GVL_HMI. |
| Start or mode selection is disabled | Read the operator message. Start requires Automatic and Idle. Mode changes require Stopped. Clear a pressure fault before recovery. |
| Missing library | Register the checkout's Library Repository directory. Resolve the pinned SPT versions and PackML v2 dependencies in the XAE Reference Manager. |
| Port already in use | Stop the existing host or set the host URL explicitly. Adjust the Vite proxy if changing port 5080. |

The local service binds to loopback and provides demo controls and fault injection. Physical machine deployment needs site-specific access control, safety and commissioning.
