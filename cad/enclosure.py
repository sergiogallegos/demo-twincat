"""Window bays, access hardware and services for the L-shaped teaching machine (mm)."""
from math import atan2, cos, degrees, hypot, pi, sin


def bay(line, name, start, end, door=False):
    """Build one perimeter bay. Its local X follows the wall, +Y faces inside."""
    dx, dy = end[0] - start[0], end[1] - start[1]
    span = hypot(dx, dy)
    ux, uy = dx / span, dy / span
    yaw = degrees(atan2(dy, dx))

    def point(u, v, z):
        return (start[0] + ux*u - uy*v, start[1] + uy*u + ux*v, z)

    def panel(label, finish, u, v, z, width, depth, height, corner=2):
        line.plate(label, finish, *point(u, v, z), width, depth, height, corner, (0, 0, yaw))

    line.group("Guard" + name)
    # Each bay owns its starting post. The welded shoe reaches in to the deck.
    panel("Deck mounting shoe", "machined", 0, 28, 680, 68, 130, 12, 5)
    line.fastener(*point(0, 51, 687), 6)
    panel("Powder coated upright", "paint", 0, 0, 1134, 39, 46, 896, 3)
    panel("Sill extrusion", "aluminium", span/2, 0, 711, span-38, 45, 48)
    panel("Upper fascia", "paint", span/2, 0, 1588, span, 55, 92)
    panel("Fascia shadow line", "teal", span/2, -28, 1553, span-3, 2, 8)
    # A dark glazing channel makes the edge of the clear panel readable.
    edge = 46 if door else 25
    for u in (edge, span-edge):
        panel("Leaf stile" if door else "Glazing channel", "gunmetal",
              u, -2, 1140, 22 if door else 11, 22, 804)
    for z in ((1534,) if name == "PlanarEnd" else (745,1534)):
        panel("Glazing rail", "gunmetal", span/2, -2, z, span-2*edge, 22, 16)
    if name == "PlanarEnd":
        # The pack nest faces this end bay. Split the pane around its tunnel.
        port = start[1] - 960
        left, right = port - 112, port + 112
        for a, b in ((edge+4, left-5), (right+5, span-edge-4)):
            panel("Window sill channel", "gunmetal", (a+b)/2, -2, 745, b-a, 22, 16)
            panel("End window", "glass", (a+b)/2, -1, 1140, b-a, 5, 782)
        panel("Transom above discharge", "glass", port, -1, 1238, 214, 5, 585)
        for u in (left, right):
            panel("Tunnel jamb", "gunmetal", u, -2, 1140, 10, 22, 798)
        panel("Tunnel lintel", "gunmetal", port, -2, 942, 222, 22, 12)
    else:
        panel("Polycarbonate vision panel", "glass", span/2, -1, 1140, span-2*edge-8, 5, 782)
    if not door:
        return
    for z in (812, 1438):
        for u in (23, 48):
            panel("Hinge leaf", "gunmetal", u, -20, z, 22, 10, 54)
        line.disk("Hinge pin", "machined", *point(36, -26, z), 6, 66)
    for z in (1007, 1137):
        panel("Handle standoff", "gunmetal", span-edge-22, -37, z, 29, 62, 20, 6)
    line.link("Return handle", "motor", point(span-edge-22,-65,1007),
              point(span-edge-22,-65,1137), 10)
    panel("Coded switch housing", "gunmetal", span-17, -27, 1310, 39, 31, 62, 6)
    panel("Switch actuator", "orange", span-48, -21, 1310, 19, 20, 38, 4)


def add_enclosure(line):
    # A single outside perimeter leaves the transfer rail between decks clear.
    corners = [(-1170,-738), (-390,-738), (390,-738), (1200,-738),
               (1200,0), (1200,738), (390,738), (-390,738), (-1068,738),
               (-1068,1194), (-1755,1194), (-2450,1194), (-2450,228),
               (-1755,228), (-1170,228)]
    names = ["FeedDoor","InsertDoor","LoadDoor","RightFront","RightRear",
             "RearLoad","RearInsert","RearFeed","Return","PackRear","VisionRear",
             "PlanarEnd","VisionDoor","TransferWindow","LoopEnd"]
    for i, name in enumerate(names):
        bay(line, name, corners[i], corners[(i+1) % len(corners)], name.endswith("Door"))

    line.group("GuardRoof")
    # Shallow clear roof cassettes follow the two deck outlines.
    for x in (-780, 0, 795):
        line.plate("Clear roof cassette", "glass", x, 0, 1622, 792 if x == 795 else 762, 1432, 4, 7)
    for x in (-390, 390):
        line.plate("Roof mullion", "paint", x, 0, 1617, 30, 1430, 28)
    line.plate("Clear finishing roof", "glass", -1810, 711, 1622, 1242, 928, 4, 7)
    line.plate("Transfer roof seam", "paint", -1170, 710, 1618, 27, 936, 26)
    line.plate("Return roof infill", "glass", -1119, 968, 1622, 78, 413, 4, 4)
    for y in (-701,701):
        line.plate("Work light channel", "gunmetal", 0, y, 1548, 2220, 24, 14)
        line.plate("Opal diffuser", "linen", 0, y, 1539, 2208, 18, 4)

    line.group("GuardUtilities")
    for z, finish in ((1440,"orange"), (1493,"blue")):
        line.plate("Service tray", "aluminium", 0, 682, z, 2200, 44, 6)
        line.plate("Tray return", "machined", 0, 701, z+10, 2200, 4, 20)
        line.link("Cable loom", finish, (-1090,677,z+9), (1090,677,z+9), 6)
        for x in (-780,-390,0,390,780):
            line.plate("Cantilever bracket", "gunmetal", x, 701, z-8, 22, 65, 12)
    line.plate("Equipment mounting rail", "aluminium", 0, 713, 1350, 2190, 24, 32)
    for x in (-750,250,750):
        line.plate("Junction box backplate", "machined", x, 725, 1350, 125, 16, 112, 5)
        line.plate("Station junction box", "gunmetal", x, 701, 1350, 106, 42, 97, 7)
        for dx in (-24,24):
            line.disk("Cord grip", "brass", x+dx, 701, 1406, 7, 15)
            line.link("Station drop", "rubber", (x+dx,701,1414), (x+dx,681,1439), 4)


def operator_station(line):
    """Corner-mounted pendent in its parked position, with cable-entry swivels."""
    x, y = 1446, -950
    line.group("OperatorArm")
    line.plate("Post mounting spacer","machined",1200,-760,1485,43,8,146,4)
    line.plate("Corner adapter plate","gunmetal",1200,-771,1485,68,18,146,7)
    for dx in (-20,20):
        for z in (1434,1536):
            line.disk("Adapter bolt","machined",1200+dx,-782,z,5,5,rot=(90,0,0))
    line.link("Shoulder standoff","stainless",(1200,-780,1480),(1200,y,1480),26)
    line.disk("Yaw bearing","gunmetal",1200,y,1506,38,58)
    line.disk("Shoulder collar","machined",1200,y,1543,31,16)
    line.disk("Riser tube","stainless",1200,y,1622,23,150)
    # Revolved circular sections give both tube bends a continuous outer radius.
    profile = [(40+23*cos(i*pi/16),23*sin(i*pi/16)) for i in range(32)]
    line.turn("Shoulder elbow","stainless",1240,y,1696,profile,(90,-90,0),90)
    line.link("Horizontal arm","stainless",(1240,y,1736),(1406,y,1736),23)
    line.turn("Wrist elbow","stainless",1406,y,1696,profile,(90,0,0),90)
    line.disk("Drop tube","stainless",x,y,1622,23,148)
    line.disk("Panel swivel","gunmetal",x,y,1548,34,34)
    line.disk("Cable entry flange","machined",x,y,1528,41,12)
    line.group("OperatorTerminal")
    line.plate("Pendent back shell","gunmetal",x,y,1372,456,78,300,16)
    line.plate("Machined front surround","machined",x,y-41,1372,454,12,298,14)
    line.plate("Touch bezel","motor",x,y-49,1386,420,7,234,9)
    line.plate("Display glass","screen",x,y-54,1386,392,4,211,5)
    line.disk("Stop collar","yellow",x+186,y-51,1246,17,9,rot=(90,0,0))
    line.disk("Panel stop button","red",x+186,y-62,1246,12,14,rot=(90,0,0))

    for name, px, py in (("Feed",-390,-738),("Load",390,-738),("Finish",-1755,228)):
        line.group("LocalControls" + name)
        line.plate("Post control strip","gunmetal",px,py-28,1118,43,12,194,5)
        for z, finish in ((1185,"green"),(1147,"red"),(1109,"blue"),(1053,"red")):
            stop = z == 1053
            line.disk("Button bezel","yellow" if stop else "machined",px,py-38,z,
                      20 if stop else 12,8,rot=(90,0,0))
            line.disk("Mushroom button" if stop else "Pushbutton",finish,px,py-48,z,
                      15 if stop else 9,16,rot=(90,0,0))


def pack_out(line):
    """Passive takeaway concept aligned to the final pack nest at (-2200,960)."""
    line.group("PackDischarge")
    for y in (880, 1040):
        line.link("Sloping conveyor rail", "aluminium", (-2285,y,791), (-2584,y,746), 32, True)
        line.plate("Tunnel cheek", "paint", -2429, y, 860, 186, 8, 134, 6)
    for i in range(12):
        x = -2294 - 25*i
        z = 796 - 3.75*i
        line.link("Free roller", "stainless", (x,887,z), (x,1033,z), 10)
    line.plate("Discharge tunnel cover", "paint", -2429, 960, 928, 186, 172, 10, 7)
    line.plate("Inspection stripe", "teal", -2523, 960, 927, 3, 155, 6)
    for y in (880,1040):
        line.plate("Under deck bracket", "machined", -2423,y,634,190,33,16,3)
        line.link("Takeaway cantilever", "gunmetal", (-2507,y,632),(-2550,y,748), 12)
    line.group("PackOutTote")
    x, y = -2660, 960
    for dx in (-96,96):
        for dy in (-94,94):
            line.link("Tote stand leg", "machined", (x+dx,y+dy,25),(x+dx,y+dy,572), 32, True)
            line.disk("Stand foot","rubber",x+dx,y+dy,16,24,20)
    line.plate("Tote shelf", "machined", x,y,574,257,250,16,9)
    line.plate("Bin bottom","teal", x,y,591,238,222,10,10)
    for side in (-1,1):
        line.plate("Bin side","teal",x,y+side*109,648,238,6,110,3)
        line.plate("Rolled lip","gunmetal",x,y+side*110,705,246,11,9,4)
        line.plate("Bin end","teal",x+side*116,y,648,6,217,110,3)
        line.plate("Hand grip","rubber",x+side*121,y,683,8,75,16,3)
