# Local setup and commissioning

## Hardware-free simulation

Follow the four commands after cloning in the [README](../README.md). Check `dotnet --list-sdks` for a 10.x SDK and `node --version` for Node 22.x. npm installs the pinned frontend dependencies from `web/package-lock.json`. Building the frontend writes its production files to `server/wwwroot`. Run the host from the repository with `dotnet run --project server`.

For frontend development, keep the C# host running on port 5080. In a second terminal run `npm --prefix web run dev` and open the Vite URL printed in the terminal. Vite proxies `/api` to the local host. Restarting the simulator resets its carton count and session history.

## Beckhoff PLC with virtual mechanisms

1. On a Windows engineering station install TwinCAT 3 XAE with PLC engineering, TwinCAT XAR on the designated test target, and a **TC1200** PLC runtime license or trial. Beckhoff supplies **Tc3_PackML_V2** with TC1200. [PLC library catalog](https://infosys.beckhoff.com/content/1033/tcinfosys3/4340797963.html) The solution file uses build 3.1.4024.53 project format. Newer XAE installations must resolve the v2 PackML library and the pinned SPT v3 family. Install the TwinCAT ADS router on the computer running the C# host.
2. Clone the SPT library repository in a sibling directory and select the exact revision used by this demo. SSH requires a configured Git SSH key. HTTPS cloning also works.

   ```sh
   git clone git@github.com:Beckhoff-USA-Community/SPT-Libraries.git ../SPT-Libraries
   git -C ../SPT-Libraries checkout f598024bfe1cbbbca808f36958914b8497119191
   ```

3. Open [CartonCell.sln](../plc/CartonCell.sln) in TwinCAT XAE. Open **PLC → Library Repository → Edit Locations → Add** and select the cloned **Library Repository** directory. Resolve **SPT Base Types 3.9.0**, **SPT Event Logger 3.9.0** and **Tc3_PackML_V2** in the PLC Reference Manager. TwinCAT must also resolve their standard system dependencies. [SPT library installation](https://github.com/Beckhoff-USA-Community/SPT-Libraries)
4. Choose the local engineering runtime or an isolated Beckhoff test PLC. Build the solution and inspect the Errors window. The system task is 10 ms, PLC port 851, with no mapped field outputs. Activate the configuration **only on the intended test target**, log in, download and run the PLC. Activation can interrupt the selected runtime.
5. For a remote target, establish the trusted ADS route between HMI host and PLC in TwinCAT. Record the target’s six-field AMS Net ID and runtime port. For a local TwinCAT router, the configured local alias is `127.0.0.1.1.1`. In an online watch check `GVL_HMI.Status[0] = 51002` and confirm that index 9 advances.
6. Stop any C# simulator occupying port 5080. From the repo root, launch the same application in ADS mode using PowerShell. Substitute your test target's Net ID as appropriate.

   ```powershell
   $env:Machine__Source = 'Ads'
   $env:Machine__AmsNetId = '127.0.0.1.1.1'
   $env:Machine__Port = '851'
   dotnet run --project server
   ```

7. Open the console and verify **Connected · ADS · PLC**. SPT normally powers up in Aborted. With the virtual pressure fault clear, select **Clear abort**, wait for Stopped, then **Reset cell → Start cycle**. Observe the same state and phase in the PLC watch and HMI. To return to the portable simulator, stop the host, set `$env:Machine__Source = 'Simulation'` and restart it.

## Acceptance sequence

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
