"""Check interference with the guard in the saved continuous-line FreeCAD model."""
from math import cos, pi, sin
from pathlib import Path

import FreeCAD as App
import Part


def main():
    doc = App.openDocument(str(Path(__file__).resolve().with_name("ContinuousLine.FCStd")))
    groups = {obj.Name: obj.Group for obj in doc.Objects if obj.TypeId == "App::DocumentObjectGroup"}
    guard = [(name, part.Label, part.Shape, part.Shape.BoundBox)
             for name, parts in groups.items() if name.startswith(("Guard", "LocalControls", "Operator")) for part in parts]
    assert {"GuardPlanarEnd", "GuardRoof", "OperatorArm", "OperatorTerminal", "LocalControlsLoad", "PackDischarge", "Handoff", "XtsStator", "PlanarTiles"} <= groups.keys()
    clashes = set()

    def check(label, solid):
        bounds = solid.BoundBox
        for name, part, shape, box in guard:
            if bounds.intersect(box) and solid.common(shape).Volume > 0.01:
                clashes.add((label, name, part))

    fixed = ("Station", "ServoX", "Handoff", "VisionArch", "PackArch", "VerificationArch",
             "XtsStator", "PlanarTiles", "PackDischarge", "PackOutTote", "BlankMagazine", "LeafletCassette", "InsertFeeder", "InsertClamp")
    for group, parts in groups.items():
        if group.startswith(fixed):
            for part in parts:
                check(group + "/" + part.Label, part.Shape)

    # Swing the moving portions of each glazed leaf about the pin from the
    # saved model and test them against the new operator-side equipment.
    controls = [(group, part.Shape, part.Shape.BoundBox)
                for group, parts in groups.items()
                if group.startswith(("Operator", "LocalControls")) for part in parts]
    leaf_items = ("Leaf stile", "Glazing rail", "Polycarbonate vision panel", "Handle standoff",
                  "Return handle", "Switch actuator")
    for group in ("GuardFeedDoor", "GuardInsertDoor", "GuardLoadDoor", "GuardVisionDoor"):
        parts = groups[group]
        pivot = next(part.Shape.BoundBox.Center for part in parts if part.Label.startswith("Hinge pin"))
        for part in parts:
            if not part.Label.startswith(leaf_items):
                continue
            for angle in range(0, 91, 5):
                shape = part.Shape.copy()
                shape.rotate(pivot, App.Vector(0, 0, 1), -angle)
                bounds = shape.BoundBox
                for name, equipment, box in controls:
                    if bounds.intersect(box) and shape.common(equipment).Volume > 0.01:
                        clashes.add((group + "/" + part.Label, name, f"{angle} degrees"))

    # Each sample bounds both the nest and its carton at that pose.
    def carrier(x, y, angle=0):
        shape = Part.makeBox(146, 117, 134, App.Vector(-73, -58.5, 752))
        shape.rotate(App.Vector(), App.Vector(0, 0, 1), angle)
        shape.translate(App.Vector(x, y, 0))
        check("Carton and carrier envelope", shape)

    for side in (-1, 1):
        for i in range(51):
            carrier(-750 + 30*i, side*320)
        for i in range(91):
            angle = 2*i + (90 if side == -1 else -90)
            carrier(side*750 + 320*cos(angle*pi/180), 320*sin(angle*pi/180), angle+90)
    for y in (480, 960):
        for i in range(45):
            carrier(-2200 + i*20, y)
    for x in (-2200, -1320):
        for i in range(25):
            carrier(x, 480 + i*20)

    # Conservative swept boxes cover the entire cam stroke, including Precision.
    for station in range(1, 9):
        for stem in ("Tool", "ServoZ"):
            bounds = App.BoundBox()
            for part in groups[stem + str(station)]:
                bounds.add(part.Shape.BoundBox)
            dx = -250 if station == 6 else 0
            reach = 100 + (station - 1)*4
            dy = 0 if station == 6 else (reach if station <= 4 else -reach)
            dz = -48 if stem == "Tool" else 0
            start = App.Vector(bounds.XMin + min(0,dx), bounds.YMin + min(0,dy), bounds.ZMin + dz)
            check(stem + str(station), Part.makeBox(bounds.XLength+abs(dx), bounds.YLength+abs(dy),
                                                   bounds.ZLength+abs(dz), start))
    if clashes:
        raise AssertionError(sorted(clashes))
    print("PASS: perimeter against fixed process equipment, sampled carrier routes and swept cam boxes; sampled access leaves against controls.")


if __name__ == "__main__":
    main()
