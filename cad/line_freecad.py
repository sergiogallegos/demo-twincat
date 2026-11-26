"""Build the editable solid assembly and tessellate each distinct stock shape once."""
import gzip
import hashlib
import json
import os

import FreeCAD as App
import Part
import MeshPart

from geometry import loop_assembly
from line_components import FINISH


def make_solid(shape):
    kind, outline, amount = shape
    if kind == "prism":
        points = [App.Vector(x, y, -amount / 2) for x, y in outline]
    else:
        points = [App.Vector(r, 0, z) for r, z in outline]
    face = Part.Face(Part.makePolygon(points + points[:1]))
    solid = (face.extrude(App.Vector(0, 0, amount)) if kind == "prism"
             else face.revolve(App.Vector(), App.Vector(0, 0, 1), amount))
    if solid.Volume < 0:
        solid.reverse()
    if not solid.isValid() or solid.Volume <= 0:
        raise ValueError(f"Invalid solid: {shape}")
    return solid


def build(here):
    # FreeCAD serializes material colours and panel transparency through its
    # view providers. Use an offscreen Qt session for unattended exports.
    import FreeCADGui
    if not App.GuiUp:
        os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")
        FreeCADGui.showMainWindow()
    line = loop_assembly()
    doc = App.newDocument("ContinuousLine")
    shapes, meshes, instances, groups = {}, [], [], {}
    for item in line.parts:
        if item.group not in groups:
            groups[item.group] = doc.addObject("App::DocumentObjectGroup", item.group)
        if item.shape not in shapes:
            solid = make_solid(item.shape)
            shapes[item.shape] = (len(meshes), solid)
            mesh = MeshPart.meshFromShape(Shape=solid, LinearDeflection=0.65, AngularDeflection=0.38, Relative=False)
            vertices, faces = mesh.Topology
            meshes.append(([(v.x, v.y, v.z) for v in vertices], faces))
        index, solid = shapes[item.shape]
        obj = doc.addObject("Part::Feature", "Solid")
        obj.Label = item.label
        obj.Shape = solid
        obj.Placement = App.Placement(App.Vector(*item.point), App.Rotation(*reversed(item.rotation)))
        obj.addProperty("App::PropertyString", "Finish", "Fabrication")
        obj.Finish = item.material
        obj.ViewObject.ShapeColor = FINISH[item.material]
        obj.ViewObject.Transparency = 91 if item.material == "glass" else 0
        obj.ViewObject.DisplayMode = "Flat Lines" if item.material == "glass" else "Shaded"
        groups[item.group].addObject(obj)
        instances.append((item.group, item.material, index, item.point, item.rotation))
    doc.recompute()
    view = FreeCADGui.activeDocument().activeView()
    view.viewAxonometric()
    view.fitAll()
    doc.saveAs(str(here / "ContinuousLine.FCStd"))
    cache = here / "__pycache__" / "continuous-mesh.json.gz"
    cache.parent.mkdir(exist_ok=True)
    digest = hashlib.sha256(b"".join((here / p).read_bytes() for p in ("geometry.py", "line_components.py", "enclosure.py"))).hexdigest()
    with gzip.open(cache, "wt", encoding="utf-8") as stream:
        json.dump(dict(digest=digest, meshes=meshes, instances=instances, origins=line.origins), stream, separators=(",", ":"))
    print(f"Saved {len(instances)} solids in {len(groups)} mechanical assemblies, {len(meshes)} distinct stock shapes.")
