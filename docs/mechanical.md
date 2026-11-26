# Mechanical layout and reference drawings

The editable [FreeCAD assembly](../cad/ContinuousLine.FCStd) and [Blender scene](../cad/ContinuousLine.blend) share a model of 1,423 solids in 104 mechanical assemblies. FreeCAD stores individual solids, while Blender groups geometry by mechanism so the HMI can move each carton, mover, crosshead and tool independently. The original concept design by Sergio Gallegos uses perimeter tooling around an oval transport and a second table at the last assembly station. The HMI opens the exported [glTF model](../web/public/continuous-line.glb). The mechanical layout is a concept assembly for the virtual plant.

| Assembly | Geometry in the model |
| --- | --- |
| Main table | 2,390 × 1,390 mm deck. Tooling on four 500 mm station centers per side. |
| XTS path | Two 1,500 mm straight centerlines joined by 320 mm radius turns. Ten numbered carriers. |
| Station tooling | Eight paired drive assemblies with finned motor bodies, connectors, precision rails, crossheads and tool rods. Heads carry suction cups, forming dies or gripper fingers. ST-03 has a separate pneumatic jaw animated from measured model travel. ST-06 has an additional longitudinal guide. |
| Planar table | 1,200 × 800 mm base with a notched 1,450 × 1,032 mm tooling plate. Five-by-three tile grid at 240 mm pitch, two traffic lanes and six mover nests. |
| Handoff | ST-08 transfers a single payload to the receiving planar mover. Three downstream stations verify assembly, inspect the seal and finish the carton. |

The HMI plan and 3D view use the same controller slot index and travel fraction. The free-moving axes of physical planar equipment are represented by a deterministic two-lane route in this demo. Frame extrusion, drives, cabling, tool clearances, guarding and load calculations require detailed design before fabrication.

## Enclosure and access

The glazing follows the L-shaped perimeter of both decks. This keeps the ST-08 transfer rail inside one enclosure. Three front leaves provide access to the loop and a fourth faces the inspection bay. Each leaf has hinge pins, a return handle, a glazing channel and a modeled door switch. Clear roof cassettes, work-light channels and separate supported power and signal routes complete the upper frame.

The touchscreen hangs from a swivel arm on the fixed front-right corner post. The shoulder bracket, radiused tube bends and top-entry wrist support the screen in its parked position. A mushroom stop sits on the bezel. Three narrow button strips on the fixed posts give the operator a local control point at the feed, load and finishing bays.

The rotary disconnect is on the lower service panel, and the beacon is on the rear header. The air preparation unit is accessible below the tooling deck. At the final pack nest, a split end window leaves space for a covered gravity roller discharge and removable tote. Product tracking ends at the pack nest. Travel down the discharge and the panel legends are illustrative.

In **Overview → 3D**, **Whole cell** shows the exterior and **Operator panel** frames the corner arm and console. **Insert tooling** and **Vision table** start with the guarding hidden. **Cutaway** changes the drawing visibility in any view. It sends no machine command. The CAD door switches and stop button are visual components. Arm loading, electrical design, safeguarding and discharge performance require engineering verification before physical use.

### Mechanical checks

The FreeCAD check below compares the saved perimeter with the fixed process equipment, including the outlet rollers. It tests carton and carrier envelopes at sampled positions on both routes, and conservative swept boxes for the eight cam heads through the Precision stroke. It also rotates the four glazed leaves from closed to 90° in 5° increments and checks the panes, stiles, glazing rails, pulls and switch actuators against the parked arm, console and button strips at each pose. These intersection checks cover the sampled poses. Minimum access clearances, the service-panel access and the full range of arm adjustment remain to be validated.

## Official STEP references

Run `python scripts/fetch_step.py` from the root. The downloader extracts the original vendor STEP files into `cad/vendor`, verifies their STEP headers and records source URLs, archive member names and SHA-256 checksums in `sources.json`. The downloadable parts provide references for rebuilding detailed tooling. Quantities below describe the virtual layout.

| Role | Model quantity | Official drawing |
| --- | ---: | --- |
| Servo envelope | 16 | [AM8021 family motor](https://download.beckhoff.com/download/technical_drawings/Drive_Technology/step/AM80xx/am8021-xx00_stp.zip) |
| XTS mover | 10 | [AT9011-0070-0550 six-roller mover](https://download.beckhoff.com/download/technical_drawings/Drive_Technology/step/xts/at9011-0070-0550_mover_6_rollers-142044.zip) |
| XPlanar tile | 15 | [APS4322-0000-0000](https://download.beckhoff.com/download/technical_drawings/Drive_Technology/step/xplanar/aps4322-0000-0000.stp.zip) |
| XPlanar mover | 6 | [APM4220-0000-0000](https://download.beckhoff.com/download/technical_drawings/Drive_Technology/step/xplanar/apm4220-0000-0000.stp.zip) |
| Seal camera | 1 | [VCS20xx camera family](https://download.beckhoff.com/download/technical_drawings/vision/vcs2000/vcs20xx.stp.zip) |

AM8021 and VCS20xx describe family drawings. Final order suffixes depend on the chosen drive, feedback, lens and installation. Beckhoff describes the supported XTS gearing/cam functions and physical tile/mover combinations. [Beckhoff XTS](https://www.beckhoff.com/en-en/products/motion/xts-linear-product-transport/) · [XPlanar operating instructions](https://download.beckhoff.com/download/document/motion/xplanar_ba_en.pdf)

## Regenerate the assets

With FreeCAD's bundled Python and Blender installed, run the commands below with the local executable paths for your installation. The loop flag selects the continuous assembly in `cad/geometry.py`. Its tooling profiles live in `cad/line_components.py`. The perimeter bays, access hardware, discharge and console are defined in `cad/enclosure.py`. Run the FreeCAD step first. It checks each distinct solid and writes a local tessellation cache. Blender reads that cache, groups meshes around their motion origins and produces the native scene, GLB and studio render. Omitting it regenerates the teaching bench.

```powershell
& 'C:/Program Files/FreeCAD 1.1/bin/python.exe' cad/build_freecad.py --loop
& 'C:/Program Files/FreeCAD 1.1/bin/python.exe' cad/check_enclosure.py
& 'C:/Program Files/Blender Foundation/Blender 4.2/blender.exe' --background --python-exit-code 1 --python cad/build_blender.py -- --loop
python scripts/verify_contract.py
```
