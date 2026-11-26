"""blender --background --python cad/build_blender.py"""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from geometry import assembly, COLORS

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
materials = {}
for name, rgb in COLORS.items():
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*rgb, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*[v**2.2 for v in rgb], 1)
    shader.inputs["Metallic"].default_value = 0.52 if name in ("steel", "anodized") else 0.05
    shader.inputs["Roughness"].default_value = 0.38
    materials[name] = mat

for part in assembly():
    center = [v/1000 for v in part.center]
    dims = [v/1000 for v in part.size]
    if part.shape == "box":
        bpy.ops.mesh.primitive_cube_add(size=1, location=center)
        bpy.context.object.dimensions = dims
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    else:
        roller = part.shape == "roller"
        bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=dims[0]/2,
            depth=dims[1] if roller else dims[2], location=center,
            rotation=(math.pi/2 if roller else 0, 0, 0))
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    obj = bpy.context.object
    obj.name = part.name
    obj.data.materials.append(materials[part.material])
    mod = obj.modifiers.new("Machined edges", "BEVEL")
    mod.width, mod.segments = min(.003,min(dims)/6), 2
    obj.modifiers.new("Face normals","WEIGHTED_NORMAL")

assets = HERE.parent / "web" / "public"
assets.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(assets / "cell.glb"), export_format="GLB", export_apply=True)
for obj in scene.objects:
    if obj.name.startswith("Cargo") and not obj.name.startswith("Cargo2"):
        obj.hide_render = True

def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
bpy.ops.object.camera_add(location=(2.15,-5.9,3.05))
camera = bpy.context.object
aim(camera,(0,0,.69))
camera.data.type, camera.data.ortho_scale = "ORTHO", 3.7
scene.camera = camera
for loc, power, size in [((1,-3,5),460,5),((-3,1,3),310,3),((2,3,4),370,4)]:
    bpy.ops.object.light_add(type="AREA",location=loc)
    bpy.context.object.data.energy, bpy.context.object.data.shape, bpy.context.object.data.size = power,"DISK",size
    aim(bpy.context.object,(0,0,.5))
scene.world = bpy.data.worlds.new("Studio")
scene.world.color = (.35,.35,.35)
scene.render.engine = "CYCLES"
scene.cycles.samples = 12
scene.render.film_transparent = True
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage = 1280,640,100
scene.render.filepath = str(assets / "cell.png")
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / "CartonCell.blend"), compress=True)
bpy.ops.render.render(write_still=True)
