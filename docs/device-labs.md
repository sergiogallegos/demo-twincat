# Motion and vision labs

The **Device labs** tab in the Carton Cell HMI displays simulated feedback. In the continuous profile it shows eight virtual axis pairs and six planar movers. The main cell calculates positions in C# or in the supplied PLC model and has no native TwinCAT motion configuration. The **native labs** below are separate engineering exercises using Beckhoff libraries and TwinCAT simulation on a compatible test runtime or trial.

## Single-carton bench devices

| Device | Machine action | Watch during Execute | Release condition |
| --- | --- | --- | --- |
| Servo blank feed | Meter 180 mm at ST-01 | Feed position advances up to 2 mm per scan. | Feed at 180 mm and pick head home. |
| XTS transfer | Index one carrier through five nests | Track position advances up to 8 mm per scan across each 560 mm pitch. The station number remains fixed during the transfer. | Carrier at 560, 1120, 1680 or 2240 mm. |
| Seal inspection | Inspect ST-04 at the forward limit | Five sample values from the seal centreline. Four or more values ≥200 produce Pass. | One latched verdict for this carton. |
| XPlanar discharge | Select a lane and route one carton | X reaches 240 mm. Y reaches +120 mm for accept or −120 mm for reject. | Shuttle at target and discharge cylinder home. |

Manual strokes isolate one cylinder. An interrupted automatic cycle retains its pose in Held or Suspended. Reset homes the virtual mechanisms and clears the verdict. Accepted and rejected totals survive Reset.

## Demonstration sequence

1. Start the HMI in Local simulation. While Stopped, select **Single-carton bench**, then Reset and Start. Open **Device labs** and select each device to inspect its simulated position or classification.
2. At Complete, **Seal vision** should report Pass and five bright samples. **XPlanar sorter** should show X 240 and Y +120 mm.
3. In Diagnostics select **Remove seal**. Reset and start a new carton. At ST-04 the verdict becomes Reject. At Complete check Y −120 mm, a new reject and an unchanged accepted-carton count.
4. Restore the seal input. The prior verdict remains latched until Reset. Change the input after an inspection to demonstrate why product decisions belong to a specific cycle.

## Native servo axis

Run `python scripts/prepare_labs.py servo`. The script verifies the download digest and prints a TwinCAT solution archive. Open it with **File → Open → Solution from Archive** in XAE. Use an isolated NC PTP test runtime with the relevant Motion license or trial. Confirm its axis uses the simulation encoder/drive and has no hardware link. Build the project, activate the test configuration and run its PLC program.

Watch the buffered absolute moves, command execution flags and actual position in the NC axis Online tab. Compare those feedback signals with the feed meter's target and actual position. A production feed adapter would use a rising-edge motion request, retain the active command until Done or Error, and forward drive faults to the unit. [Beckhoff NC PTP sample](https://infosys.beckhoff.com/content/1033/tcplclib_tc2_mc2/70177163.html) · [Create a simulation axis](https://infosys.beckhoff.com/content/1033/tf50x0_tc3_nc_ptp/10541544203.html)

## Native XTS track

Run `python scripts/prepare_labs.py xts` and open the displayed system project. Register the SPT v3 library repository as described in the commissioning guide. Install the compatible XTS engineering/runtime and motion functions required by the sample. Examine its Library Manager and the XTS processing unit before building. Select **Simulation** in its operation mode and disable any virtual fieldbus devices the sample does not require in simulation.

Run the separate XTS sample on the isolated target. Follow the SPT XTS quick start through initialization and the PackML commands, and inspect movement in XTS Viewer. The main Carton Cell models ten carts in its continuous profile and one carrier in its single-carton bench. Integrating native movers into the main cell would require track ownership, station reservations and collision handling. [SPT XTS sample and quick start](https://github.com/Beckhoff-USA-Community/SPT_XTS_Sample) · [Beckhoff simulation settings](https://infosys.beckhoff.com/content/1033/xts_software/10484022667.html)

## Native XPlanar sorter

Run `python scripts/prepare_labs.py xplanar` for the path to the original sorter program. Use a separate TwinCAT project with the TF5430 planar motion functions and their PLC motion library installed. Create an MC project with one Planar mover. Set its **Simulation** initialization parameter to TRUE. See the linked Beckhoff procedure for the runtime and mover settings of your installed version.

Add [PRG_SortShuttle](../labs/xplanar/PRG_SortShuttle.TcPOU) as an existing PLC object. Call it once per PLC task from MAIN. Build it, link the MC mover to the PLC program's Mover instance under **Link To PLC**, then activate and run on the test runtime. Set SealPassed to TRUE, then Run to TRUE. Wait for Completed and observe (240, 120). Set Run to FALSE, change SealPassed to FALSE, then raise Run again. Expect (240, −120). The program calls both Update methods every scan. An error or aborted command latches Faulted and ErrorId. Inspect the mover state, release Run, correct the cause and pulse ResetFault before the next request. [Beckhoff planar mover simulation and feedback](https://infosys.beckhoff.com/content/1033/tf5430_tc3_xplanar/9292855179.html)

## Native Vision File Source

Run `python scripts/prepare_labs.py vision` and open the printed First Steps solution. Install TwinCAT Vision Base and the compatible engineering/runtime components. In the File Source Control tab add the supplied [sealed](../web/public/vision/sealed.bmp) and [missing seal](../web/public/vision/missing.bmp) fixtures. Select the appropriate file source module version for your local target. Start acquisition and use ADS Image Watch to inspect the live image.

Add [F_SealPass](../labs/vision/F_SealPass.TcPOU) to the PLC project. Declare `bSealPassed : BOOL;`, `hrInspect : HRESULT;` and `nBright : UINT;` in MAIN. Insert the following inside the successful acquisition branch **before** the existing call that transforms the input into a displayable image.

```iecst
bSealPassed := F_SealPass(
    Image := ipImageIn,
    ResultCode => hrInspect,
    BrightSamples => nBright);
```

Watch hrInspect for success. The sealed fixture should yield five bright samples and TRUE. The missing fixture should yield zero and FALSE. The core machine stores those same five samples in its virtual inspector. The native function reads actual image pixels from the file source. [Beckhoff Vision File Source](https://infosys.beckhoff.com/content/1033/tf7xxx_tc3_vision/5498153099.html) · [Pixel access](https://infosys.beckhoff.com/content/1033/tf7xxx_tc3_vision/16930435211.html)

## Manufacturer STEP geometry

Five engineering drawings are available on demand from Beckhoff. The feed motor is an AM8021, the XTS carrier an AT9011, the planar tile an APS4322, the shuttle an APM4220 and the camera a VCS20xx. The standard scene uses original editable proxy geometry so a fresh clone has a complete model. The detailed view attaches each manufacturer mesh at its component's mounting origin and uses the same telemetry. This is a visual arrangement for a packaging demonstrator.

1. From the repo root run `python scripts/fetch_step.py`. The script reads official ZIPs, validates STEP headers and records source URLs and SHA-256 hashes in `cad/vendor/sources.json`. Open the resulting STEP files directly in FreeCAD to inspect the solids.
2. With the FreeCAD Python environment set up as in CONTRIBUTING, run `& "$cadBin\python.exe" cad/mesh_vendor.py`. This centres each mesh and retains its millimetre dimensions.
3. Run Blender in background mode with `--python-exit-code 1 --python cad/build_vendor.py`. The exporter converts units to metres, limits web mesh complexity and writes `web/public/vendor/components.glb`.
4. Rebuild the frontend and open the Overview. The HMI loads the converted parts automatically when the host has them. Select **Feed servo**, **XTS mover** or **XPlanar shuttle** below the 3D view to follow that device. To inspect the original FreeCAD/Blender assembly on the same host, open the [original geometry view](http://127.0.0.1:5080/?cad=proxy). Both views use the same machine feedback. Acquired drawings and converted vendor meshes are local build assets and stay outside the MIT source distribution.

[Beckhoff drive drawings](https://download.beckhoff.com/download/technical_drawings/Drive_Technology/step/) · [Beckhoff camera drawings](https://download.beckhoff.com/download/technical_drawings/vision/vcs2000/)
