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

loop = "--loop" in sys.argv
stem = "continuous-line" if loop else "cell"
if loop:
    from line_blender import build
    build(HERE)

for part in ([] if loop else assembly()):
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
    obj.rotation_euler.z += math.radians(part.yaw)
    obj.name = part.name
    obj.data.materials.append(materials[part.material])
    mod = obj.modifiers.new("Machined edges", "BEVEL")
    mod.width, mod.segments = min(.003,min(dims)/6), 2
    obj.modifiers.new("Face normals","WEIGHTED_NORMAL")

assets = HERE.parent / "web" / "public"
assets.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(assets / (stem + ".glb")), export_format="GLB", export_apply=True)
for obj in scene.objects:
    if (obj.name.startswith("Cargo") and not obj.name.startswith("Cargo2")) or (loop and obj.name.startswith("Box") and obj.name not in {"Box02", "Box05", "Box07", "Box12", "Box14"}):
        obj.hide_render = True

def aim(obj, target):
    obj.rotation_euler = (Vector(target)-obj.location).to_track_quat("-Z","Y").to_euler()
bpy.ops.object.camera_add(location=((-3.1,-7.2,3.9) if loop else (2.15,-5.9,3.05)))
camera = bpy.context.object
aim(camera,(-.53,.02,.88) if loop else (0,0,.69))
camera.data.type, camera.data.ortho_scale = "ORTHO", 5.38 if loop else 3.7
scene.camera = camera
for loc, power, size in [((1,-3,5),460,5),((-3,1,3),310,3),((2,3,4),370,4)]:
    bpy.ops.object.light_add(type="AREA",location=loc)
    bpy.context.object.data.energy, bpy.context.object.data.shape, bpy.context.object.data.size = power,"DISK",size
    aim(bpy.context.object,(0,0,.5))
scene.world = bpy.data.worlds.new("Studio")
scene.world.color = (.35,.35,.35)
scene.render.engine = "CYCLES"
scene.cycles.samples = 12
scene.render.film_transparent = not loop
if loop:
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,.006))
    bpy.context.object.name = "Studio floor"
    scene.cycles.use_denoising = True
    scene.cycles.samples = 32
    floor = bpy.data.materials.new("Studio concrete")
    floor.diffuse_color = (.26,.30,.32,1)
    bpy.context.object.data.materials.append(floor)
    for area in bpy.context.screen.areas:
        if area.type == "VIEW_3D":
            area.spaces.active.region_3d.view_perspective = "CAMERA"
            area.spaces.active.shading.color_type = "MATERIAL"
            area.spaces.active.overlay.show_overlays = False
scene.render.resolution_x,scene.render.resolution_y,scene.render.resolution_percentage = (1440 if loop else 1280),(824 if loop else 640),100
scene.render.filepath = str(assets / (stem + ".png"))
bpy.ops.wm.save_as_mainfile(filepath=str(HERE / ("ContinuousLine.blend" if loop else "CartonCell.blend")), compress=True)
bpy.ops.render.render(write_still=True)
