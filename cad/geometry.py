"""Carton Cell assembly in millimetres. Box coordinates are centres."""
from dataclasses import dataclass

PITCH = 560
CENTRES = [(i - 2) * PITCH for i in range(5)]
STATIONS = ["Blank feeder", "Carton former", "Product loader", "Flap closer", "Discharge"]
COLORS = {
    "steel": (0.58, 0.65, 0.68), "anodized": (0.78, 0.81, 0.82),
    "graphite": (0.14, 0.18, 0.20), "belt": (0.21, 0.26, 0.28),
    "blue": (0.12, 0.33, 0.46), "safety": (0.96, 0.56, 0.08),
    "kraft": (0.71, 0.49, 0.28), "product": (0.82, 0.87, 0.84),
    "rubber": (0.08, 0.10, 0.11), "red": (0.78, 0.05, 0.08),
}

@dataclass(frozen=True)
class PartSpec:
    name: str
    material: str
    shape: str
    center: tuple
    size: tuple

def assembly():
    parts = []
    def box(name, material, center, size):
        parts.append(PartSpec(name, material, "box", center, size))
    def round_z(name, material, center, diameter, height):
        parts.append(PartSpec(name, material, "cylinder", center, (diameter, diameter, height)))

    def round_y(name, material, center, diameter, length):
        parts.append(PartSpec(name, material, "roller", center, (diameter, length, diameter)))

    for side in (-1, 1):
        y = side * 240
        for level in (220, 680):
            box(f"Rail_{side}_{level}", "anodized", (0, y, level), (2910, 48, 72))
            box(f"Slot_{side}_{level}", "graphite", (0, y+side*25, level), (2890, 3, 7))
        box(f"Guide_{side}", "steel", (-210, side*165, 755), (2410, 12, 18))
        for i,x in enumerate((-1330, 0, 1330)):
            box(f"Leg_{side}_{i}", "anodized", (x,y,373), (55,55,619))
            box(f"LegSlot_{side}_{i}", "graphite", (x,y+side*28,373), (7,2,600))
            round_z(f"Foot_{side}_{i}", "rubber", (x,y,36), 90, 32)
    box("TransferBed","belt",(-215,0,699),(2430,451,26))
    for i,x in enumerate(CENTRES):
        tag=f"S{i+1}"
        box(tag+"_CrossTie","steel",(x,0,223),(42,451,56))
        for side in (-1,1):
            y=side*(282 if i == 4 else 215)
            box(f"{tag}_Upright_{side}","anodized",(x,y,950),(40,40,468))
            box(f"{tag}_Slot_{side}","graphite",(x,y+side*21,950),(6,2,443))
            box(f"{tag}_Mount_{side}","graphite",(x,y,731),(74,74,18))
        box(tag+"_Gantry","steel",(x,0,1180),(76,604 if i == 4 else 471,38))
        box(tag+"_Cylinder","blue",(x,0,1225),(72,72,128))
        for top in (1167,1290):
            box(f"{tag}_Cap_{top}","graphite",(x,0,top),(85,85,16))
            for dx in (-28,28):
                for dy in (-28,28):
                    round_z(f"{tag}_Tie_{top}_{dx}_{dy}","steel",(x+dx,dy,top+8),8,9)
        # All MovingN parts share one vertical stroke in the live scene.
        round_z(f"Moving{i}_Rod","anodized",(x,0,1095),26,145)
        tools=[(200,115,16),(170,122,55),(104,92,38),(205,169,20),(160,60,34)]
        box(f"Moving{i}_Tool","safety",(x,0,1020),tools[i])
        box(tag+"_Valve","blue",(x-75,-245,655),(65,32,42))
        for n in range(3):
            round_z(f"{tag}_Port_{n}","steel",(x-95+n*18,-245,680),10,13)
        box(tag+"_Sensor","graphite",(x+95,-168,775),(26,28,38))
        # Different visible carton stages; browser shows the one at the active station.
        floor=732
        h=[9,106,106,106,106][i]
        box(f"Cargo{i}_Base","kraft",(x,0,floor),(210,155,8))
        for side in (-1,1):
            box(f"Cargo{i}_Side_{side}","kraft",(x,side*75,floor+h/2),(210,5,h))
            box(f"Cargo{i}_End_{side}","kraft",(x+side*103,0,floor+h/2),(5,150,h))
        if i in (2,3):
            box(f"Cargo{i}_Product","product",(x,0,780),(142,94,74))
        if i>=3:
            box(f"Cargo{i}_Lid","kraft",(x,0,841),(211,156,8))
            box(f"Cargo{i}_Tape","product",(x,0,846),(211,20,2))
    # Passive tooling distinguishes the five processes along the indexed bed.
    for side in (-1, 1):
        box(f"MagazineGuide_{side}", "steel", (-1356, side*112, 817), (165, 12, 170))
        box(f"FormDieSide_{side}", "blue", (-560, side*102, 759), (254, 28, 75))
        box(f"FormDieEnd_{side}", "graphite", (-560+side*131, 0, 759), (26, 177, 75))
        box(f"LoaderGuide_{side}", "anodized", (side*87, 96, 972), (14, 184, 240))
        box(f"FlapShoe_{side}", "blue", (560, side*99, 839), (232, 26, 17))
    box("LoaderShelf", "graphite", (0, 142, 864), (190, 148, 18))
    for level in range(3):
        box(f"LoaderStock_{level}", "product", (0, 144, 897+level*58), (143, 92, 50))
    # Mounting-point origins are also used for the optional vendor STEP detail layer.
    # Feed motor, mounting flange and transverse roller share a shaft centreline.
    box("FeedServo", "graphite", (-1250, -345, 750), (74, 140, 74))
    box("MotorFlange", "anodized", (-1250, -269, 750), (96, 12, 96))
    box("MotorConnector", "graphite", (-1250, -382, 795), (34, 42, 19))
    for i in range(5):
        box(f"MotorFin_{i}", "steel", (-1288, -390+i*20, 750), (6, 6, 61))
    round_y("FeedRoll", "anodized", (-1250, -135, 750), 50, 249)
    box("FeedRollKey", "blue", (-1250, -135, 774), (9, 237, 4))

    # The linear motor modules are visible on the operator side of the frame.
    box("TrackStator", "graphite", (0, -274, 645), (2480, 50, 105))
    for i in range(10):
        box(f"TrackModule_{i}", "anodized", (-1116+248*i, -302, 645), (240, 16, 72))
    for height in (608, 680):
        box(f"TrackGuide_{height}", "steel", (0, -314, height), (2480, 15, 12))
    box("TrackCarrier", "blue", (-1120, -330, 657), (134, 48, 91))
    box("CarrierArm", "steel", (-1120, -168, 714), (76, 328, 13))
    box("CarrierPallet", "blue", (-1120, 0, 725), (210, 158, 10))
    box("SealCamera", "graphite", (560, 129, 1065), (55, 59, 72))
    round_z("CameraLens", "rubber", (560, 129, 1010), 44, 44)
    box("CameraBracket", "anodized", (560, 170, 1109), (46, 116, 16))
    # Four independently visible tile faces span the XY travel envelope.
    for column, x in enumerate((1120, 1360)):
        for row, y in enumerate((-120, 120)):
            name = "PlanarTile" if column == row == 0 else f"PlanarTile_{column}_{row}"
            box(name, "graphite", (x, y, 680), (236, 236, 65))
            for corner in (-1, 1):
                round_z(f"TileFastener_{column}_{row}_{corner}", "steel",
                        (x+corner*102, y+corner*102, 713), 9, 3)
    box("PlanarShuttle", "blue", (1120, 0, 724), (140, 140, 14))
    for layer in range(7):
        box(f"Stock_{layer}","kraft",(-1356,0,735+layer*8),(145,200,6))
    return parts
