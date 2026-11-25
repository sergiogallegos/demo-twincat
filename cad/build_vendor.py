"""Optional local detail meshes. Run after fetch_step.py and mesh_vendor.py."""
from pathlib import Path

import bpy

here = Path(__file__).resolve().parent
bpy.ops.wm.read_factory_settings(use_empty=True)
names = ["feed-motor", "track-mover", "sort-tile", "sort-mover", "camera"]
for name in names:
    path = here / "vendor" / (name + ".stl")
    bpy.ops.wm.stl_import(filepath=str(path), global_scale=0.001)
    obj = bpy.context.object
    obj.name = name
    # The engineering STEP remains full resolution. Bound the web detail per component.
    if len(obj.data.polygons) > 16000:
        simplify = obj.modifiers.new("Web detail", "DECIMATE")
        simplify.ratio = 16000 / len(obj.data.polygons)
        bpy.ops.object.modifier_apply(modifier=simplify.name)
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (0.28, 0.34, 0.37, 1) if name != "sort-tile" else (0.13, 0.17, 0.19, 1)
    obj.data.materials.append(mat)

target = here.parent / "web" / "public" / "vendor"
target.mkdir(exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(target / "components.glb"), export_format="GLB")
