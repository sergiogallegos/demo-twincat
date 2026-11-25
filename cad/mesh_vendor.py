"""Tessellate the optional vendor STEP downloads with FreeCAD's bundled Python."""
from pathlib import Path

import FreeCAD as App
import Mesh
import Part

source = Path(__file__).resolve().parent / "vendor"
for path in sorted(source.glob("*.step")):
    shape = Part.read(str(path))
    if shape.isNull():
        raise ValueError(f"Empty shape: {path.name}")
    center = shape.BoundBox.Center
    shape.translate(App.Vector(-center.x, -center.y, -center.z))
    points, triangles = shape.tessellate(0.65)
    mesh = Mesh.Mesh([(points[a], points[b], points[c]) for a, b, c in triangles])
    mesh.write(str(path.with_suffix(".stl")))
    print(path.stem, mesh.CountFacets, "triangles")
