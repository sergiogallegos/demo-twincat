"""Run with FreeCAD's bundled Python interpreter (see README)."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import FreeCAD as App
import Part
from geometry import assembly, COLORS

loop = "--loop" in sys.argv
if loop:
    from line_freecad import build
    build(HERE)
    sys.exit(0)

name = "CartonCell"
doc = App.newDocument(name)
for item in assembly():
    x, y, z = item.center
    w, d, h = item.size
    if item.shape == "box":
        part = doc.addObject("Part::Box", "Part")
        part.Length, part.Width, part.Height = w, d, h
        base = App.Vector(x - w/2, y - d/2, z - h/2)
    else:
        part = doc.addObject("Part::Cylinder", "Part")
        part.Radius = w/2
        part.Height = d if item.shape == "roller" else h
        base = App.Vector(x, y-d/2, z) if item.shape == "roller" else App.Vector(x, y, z-h/2)
    part.Label = item.name
    rotation = App.Rotation(App.Vector(1,0,0), -90) if item.shape == "roller" else App.Rotation()
    yaw = App.Rotation(App.Vector(0,0,1), item.yaw)
    centre = App.Vector(x,y,z)
    part.Placement = App.Placement(centre + yaw.multVec(base-centre), yaw.multiply(rotation))
    part.addProperty("App::PropertyString", "Finish", "Fabrication")
    part.Finish = item.material
    if part.ViewObject:
        part.ViewObject.ShapeColor = COLORS[item.material]
doc.recompute()
doc.saveAs(str(HERE / (name + ".FCStd")))
print(f"Saved {len(doc.Objects)} editable solids")
