"""Run with FreeCAD's bundled Python interpreter (see README)."""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import FreeCAD as App
import Part
from geometry import assembly, COLORS

doc = App.newDocument("CartonCell")
for item in assembly():
    x, y, z = item.center
    w, d, h = item.size
    if item.shape == "box":
        part = doc.addObject("Part::Box", "Part")
        part.Length, part.Width, part.Height = w, d, h
        base = App.Vector(x - w/2, y - d/2, z - h/2)
    else:
        part = doc.addObject("Part::Cylinder", "Part")
        part.Radius, part.Height = w/2, h
        base = App.Vector(x, y, z-h/2)
    part.Label = item.name
    part.Placement = App.Placement(base, App.Rotation())
    part.addProperty("App::PropertyString", "Finish", "Fabrication")
    part.Finish = item.material
    if part.ViewObject:
        part.ViewObject.ShapeColor = COLORS[item.material]
doc.recompute()
doc.saveAs(str(HERE / "CartonCell.FCStd"))
print(f"Saved {len(doc.Objects)} editable solids")
