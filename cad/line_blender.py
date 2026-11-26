"""Assemble the FreeCAD tessellations in metres, grouped by mechanism for the HMI."""
import gzip
import hashlib
import json
from math import radians

import bpy
from mathutils import Euler, Vector
from line_components import FINISH


def build(here):
    cache = here / "__pycache__" / "continuous-mesh.json.gz"
    if not cache.exists():
        raise RuntimeError("Run cad/build_freecad.py --loop first.")
    with gzip.open(cache, "rt", encoding="utf-8") as stream:
        stock = json.load(stream)
    digest = hashlib.sha256(b"".join((here / p).read_bytes() for p in ("geometry.py", "line_components.py", "enclosure.py"))).hexdigest()
    if digest != stock["digest"]:
        raise RuntimeError("Geometry changed. Run cad/build_freecad.py --loop first.")
    materials = {}
    for name, rgb in FINISH.items():
        mat = bpy.data.materials.new(name)
        alpha = 0.068 if name == "glass" else 1
        color = (*[v ** 2.2 for v in rgb], alpha)
        mat.diffuse_color = color
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get("Principled BSDF")
        shader.inputs["Base Color"].default_value = color
        shader.inputs["Alpha"].default_value = alpha
        shader.inputs["Metallic"].default_value = 0.63 if name in ("machined","aluminium","stainless","brass") else 0.10
        shader.inputs["Roughness"].default_value = 0.30 if name in ("machined","glass","brass") else 0.45
        if alpha < 1:
            mat.blend_method = "BLEND"
        materials[name] = mat
    for group, origin in stock["origins"].items():
        vertices, faces, slots, material_ids = [], [], [], []
        for name, finish, mesh_id, center, rotation in stock["instances"]:
            if name != group:
                continue
            points, triangles = stock["meshes"][mesh_id]
            transform = Euler(tuple(map(radians, rotation))).to_matrix()
            offset = Vector(center) - Vector(origin)
            start = len(vertices)
            vertices.extend((transform @ Vector(p) + offset) / 1000 for p in points)
            faces.extend(tuple(start + idx for idx in tri) for tri in triangles)
            if finish not in slots:
                slots.append(finish)
            material_ids.extend([slots.index(finish)] * len(triangles))
        if not vertices:
            continue
        mesh = bpy.data.meshes.new(group)
        mesh.from_pydata(vertices, [], faces)
        for finish in slots:
            mesh.materials.append(materials[finish])
        mesh.polygons.foreach_set("material_index", material_ids)
        mesh.polygons.foreach_set("use_smooth", [True] * len(faces))
        mesh.update()
        mesh.set_sharp_from_angle(angle=radians(32))
        obj = bpy.data.objects.new(group, mesh)
        bpy.context.collection.objects.link(obj)
        obj.location = Vector(origin) / 1000

    # Screen printing sits on the fabricated surfaces. Parent each legend to
    # its assembly so presentation cutaways also remove the matching graphics.
    def legend(group, words, x, y, z, height, finish, centered=False):
        letters = bpy.data.curves.new(words, "FONT")
        letters.body = words
        letters.size = height / 1000
        letters.align_x = "CENTER" if centered else "LEFT"
        obj = bpy.data.objects.new(words, letters)
        bpy.context.collection.objects.link(obj)
        obj.parent = bpy.data.objects[group]
        obj.location = Vector((x,y,z)) / 1000
        obj.rotation_euler.x = radians(90)
        letters.materials.append(materials[finish])
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        obj.select_set(False)

    legend("GuardFeedDoor", "CARTON CELL", -1100,-767,1575,56,"gunmetal")
    legend("GuardLoadDoor", "01   /   ASSEMBLY", 619,-767,1577,36,"teal")
    legend("GuardVisionDoor", "02   /   INSPECTION", -2360,199,1577,34,"teal")
    legend("OperatorTerminal","CARTON CELL",1269,-1007,1434,32,"paint")
    legend("OperatorTerminal","ASSEMBLY   /   INSPECTION",1270,-1007,1388,15,"machined")
    legend("OperatorTerminal","OPERATOR STATION   01",1270,-1007,1314,13,"linen")
    legend("PanelDisconnect","MAIN ISOLATOR",526,-654,444,13,"motor")
