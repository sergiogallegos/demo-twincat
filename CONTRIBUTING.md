# Working on Carton Cell

Read the [architecture guide](docs/architecture.md) and [ADS contract](docs/ads.md) before changing the machine. Each subsystem can be developed independently.

## Build and test

```sh
npm --prefix web ci
npm --prefix web run check
npm --prefix web run build
dotnet build server
dotnet run --project server
```

Run `python scripts/verify_contract.py` to check task wiring, protocol fields, actual image fixtures and animated CAD anchors. In another terminal run `python scripts/smoke.py` against the fresh simulator. Use a second test configuration for ADS and follow the [commissioning sequence](docs/commissioning.md). Run `npm --prefix web run format` for frontend changes. C# follows the repository EditorConfig, four-space indentation and standard .NET naming. Keep TypeScript strict, name props and domain values clearly, and use blank lines between functions. Comments should explain scan ownership, unit conversions or protocol decisions.

## Mechanical assets

The checked-in [FreeCAD assembly](cad/CartonCell.FCStd) and [Blender scene](cad/CartonCell.blend) open directly. The frontend ships with the exported model and poster. Editing the parametric [geometry definition](cad/geometry.py) and running both exporters keeps the deliverables consistent. All dimensions are millimetres in CAD and metres in glTF.

From the repo root, use FreeCAD's Python interpreter with its modules and DLLs on the search path. For the portable Windows FreeCAD 1.1 distribution, substitute its actual bin directory below. Blender 5 includes its own Python interpreter.

```powershell
$cadBin = 'C:\Tools\FreeCAD\bin'
$env:Path = "$cadBin;$env:Path"
& "$cadBin\python.exe" cad/build_freecad.py
& 'C:\Program Files\Blender Foundation\Blender 5.0\blender.exe' --background --python-exit-code 1 --python cad/build_blender.py
npm --prefix web run build
```

Object names `Moving0_` through `Moving4_` identify rods/tools. `Cargo0_` through `Cargo4_` identify the carton stages. Keep the mesh origins at the primitive centers. Verify the exported model with a full automatic cycle after a geometry change.

Use the [continuous CAD rebuild instructions](docs/mechanical.md#regenerate-the-assets) for the loop profile. Record the exact verification and task ID on the [shared board](docs/board.md).

## Publishing media

The [README gallery](README.md#watch-the-physical-plc-run-the-virtual-cell) contains the current CX recordings and screenshots. When refreshing them, capture the live HMI with the connection source, PackML state and carton counts visible. Keep local computer names and target addresses out of public captures.
