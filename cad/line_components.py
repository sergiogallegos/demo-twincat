"""Original mechanical shapes for the loop, in mm. Stock sections are extruded; turned parts revolve about Z."""
from dataclasses import dataclass
from math import atan2, acos, cos, degrees, pi, radians, sin, sqrt

FINISH = {
    "aluminium": (.73,.76,.77), "machined": (.84,.87,.87), "stainless": (.54,.59,.60),
    "gunmetal": (.23,.27,.29), "motor": (.13,.17,.19), "paint": (.84,.86,.84),
    "teal": (.09,.42,.44), "orange": (.95,.43,.09), "rubber": (.10,.12,.13),
    "brass": (.76,.56,.28), "blue": (.13,.46,.66), "kraft": (.71,.45,.23),
    "linen": (.89,.79,.58), "glass": (.56,.78,.81), "green": (.17,.72,.40),
    "yellow": (.96,.73,.07), "red": (.79,.16,.12), "screen": (.12,.24,.29),
}

@dataclass(frozen=True)
class Component:
    label: str
    group: str
    material: str
    shape: tuple
    point: tuple
    rotation: tuple

def rectangle(w,d,c=0):
    a,b=w/2,d/2
    c=min(c,a*.9,b*.9)
    if not c: return ((-a,-b),(a,-b),(a,b),(-a,b))
    return ((-a+c,-b),(a-c,-b),(a,-b+c),(a,b-c),(a-c,b),(-a+c,b),(-a,b-c),(-a,-b+c))

def slot_profile(size):
    # Four open T-slots with lips and a central web.
    a=size/2
    edge=[(-a+2,-a),(-6,-a),(-6,-a+3.2),(-10,-a+3.2),(-10,-a+6),
          (-5,-a+11),(5,-a+11),(10,-a+6),(10,-a+3.2),(6,-a+3.2),(6,-a),(a-2,-a)]
    points=[]
    for _ in range(4):
        points.extend(edge)
        edge=[(-y,x) for x,y in edge]
    return tuple(points)

class LineBuilder:
    def __init__(self):
        self.parts=[]
        self.origins={}
        self.group("Frame")

    def group(self,name,origin=(0,0,0)):
        self.active=name
        self.origins[name]=origin

    def add(self,label,material,shape,point,rotation=(0,0,0)):
        self.parts.append(Component(label,self.active,material,shape,point,rotation))

    def plate(self,label,mat,x,y,z,w,d,h,c=2,rotation=(0,0,0)):
        self.add(label,mat,("prism",rectangle(w,d,c),h),(x,y,z),rotation)

    def turn(self,label,mat,x,y,z,profile,rot=(0,0,0),angle=360):
        self.add(label,mat,("turn",tuple(profile),angle),(x,y,z),rot)

    def disk(self,label,mat,x,y,z,r,h,bore=0,rot=(0,0,0)):
        self.turn(label,mat,x,y,z,[(bore,-h/2),(r,-h/2),(r,h/2),(bore,h/2)],rot)

    def link(self,label,mat,start,end,r,section=False):
        dx,dy,dz=[b-a for a,b in zip(start,end)]
        length=sqrt(dx*dx+dy*dy+dz*dz)
        point=tuple((a+b)/2 for a,b in zip(start,end))
        rotation=(0,degrees(acos(dz/length)),degrees(atan2(dy,dx)))
        if section:
            self.add(label,mat,("prism",slot_profile(r),length),point,rotation)
        else:
            self.disk(label,mat,*point,r,length,rot=rotation)

    def fastener(self,x,y,z,r=5):
        self.disk("Washer","stainless",x,y,z,r+2,1.6)
        outline=tuple((r*cos(i*pi/3),r*sin(i*pi/3)) for i in range(6))
        self.add("Hex head","gunmetal",("prism",outline,r*.8),(x,y,z+2.5))

    def base(self,name,x,y,w,d,deck_outline=None):
        self.group(name)
        if deck_outline:
            self.add("Notched tooling plate","aluminium",("prism",deck_outline,32),(0,0,658))
        else:
            self.plate("Machined tooling plate","aluminium",x,y,658,w,d,32,26)
        for side in (-1,1):
            yy=y+side*(d/2-48)
            for z in (210,615):
                self.link("Slotted perimeter rail","aluminium",(x-w/2+55,yy,z),(x+w/2-55,yy,z),45,True)
            # Folded service panels are inset behind the structural members.
            count=3 if w>1500 else 2
            for j in range(count):
                xx=x+(j-(count-1)/2)*(w-105)/count
                span=(w-105)/count-12
                self.plate("Service panel","paint",xx,yy,410,span,10,356,4)
                self.plate("Quarter turn latch","gunmetal",xx+span*.37,yy+side*9,526,32,14,13,3)
                for k in range(4):
                    self.plate("Louver","gunmetal",xx-span*.28,yy+side*6,283+k*14,span*.22,3,5)
            for end in (-1,1):
                xx=x+end*(w/2-48)
                self.link("Upright extrusion","aluminium",(xx,yy,82),(xx,yy,637),45,True)
                self.turn("Adjustable foot","rubber",xx,yy,0,[(0,8),(38,8),(41,13),(38,23),(22,31),(0,31)])
                self.disk("Threaded stem","stainless",xx,yy,59,9,62)
                self.fastener(xx,yy,76,13)
        for end in (-1,1):
            xx=x+end*(w/2-48)
            for z in (210,615):
                self.link("End rail","aluminium",(xx,y-d/2+65,z),(xx,y+d/2-65,z),45,True)
            self.plate("End cover","paint",xx,y,409,10,d-145,352)

    def track(self):
        self.group("XtsStator")
        for side in (-1,1):
            for j in range(6):
                x=-625+250*j
                self.plate("Stator segment","gunmetal",x,side*320,724,247,94,73,10)
                self.plate("Service cover","teal",x,side*369,722,216,5,38)
                for dx in (-93,93):
                    self.fastener(x+dx,side*349,761)
            for offset in (-31,31):
                self.link("Ground guide rail","machined",(-750,side*320+offset,766),(750,side*320+offset,766),7)
            start=-90 if side==1 else 90
            for j in range(6):
                self.turn("Curved stator module","gunmetal",side*750,0,724,
                          ((273,-36),(367,-36),(367,29),(361,36),(279,36),(273,29)),
                          (0,0,start+j*30+.35),29.3)
            for r in (289,351):
                self.turn("Curved steel guide","machined",side*750,0,766,
                          ((r-6,-4),(r-4,-7),(r+4,-7),(r+7,-3),(r+7,3),(r+4,7),(r-4,7),(r-6,4)),
                          (0,0,start),180)

    def motor(self,name,x,y,z,horizontal):
        # Motor can, flange, encoder cover, cooling ribs and circular connector.
        rot=(90,0,0) if horizontal else (0,0,0)
        self.turn(name+" housing","motor",x,y,z,
                  ((0,-54),(24,-54),(28,-48),(30,-42),(30,36),(27,44),(23,48),(0,48)),rot)
        for pos in (-35,-23,-11,1,13,25):
            self.disk("Cooling rib","gunmetal",x,y-pos if horizontal else y,z if horizontal else z+pos,32,4,rot=rot)
        self.plate("Mounting flange","machined",x,y+53 if horizontal else y,z if horizontal else z-55,72,72,8,9,rot)
        self.disk("Encoder cover","teal",x,y-45 if horizontal else y,z if horizontal else z+45,24,9,rot=rot)
        self.disk("Cable gland","brass",x+33,y,z+16,9,16,rot=(0,90,0))
        self.plate("Encoder connector","rubber",x+42,y,z+23,16,15,23,4)

    def station(self,i):
        number=i+1
        side=-1 if i<4 else 1
        x=-750+500*(i if i<4 else 7-i)
        self.group(f"Station{number}")
        self.plate("Mounting shoe","gunmetal",x,side*589,689,167,155,26,16)
        for dx in (-62,62):
            for dy in (-53,53): self.fastener(x+dx,side*589+dy,704,6)
        for dx in (-46,46):
            self.link("Column extrusion","aluminium",(x+dx,side*597,701),(x+dx,side*597,1000),45,True)
        self.plate("Column cap","teal",x,side*597,994,148,87,20,6)
        self.plate("Cross slide bed","gunmetal",x,side*473,1006,114,333,28,8)
        for dx in (-38,38):
            self.link("Precision rail","machined",(x+dx,side*618,1025),(x+dx,side*315,1025),6)
        self.link("Feed screw","stainless",(x,side*619,1028),(x,side*312,1028),7)
        self.plate("End bearing","teal",x,side*315,1026,108,16,42,4)
        if i == 5:
            self.plate("Flying slide bed","gunmetal",x-115,y=320,z=1002,w=365,d=106,h=24,c=7)
            for dy in (-36,36):
                self.link("Longitudinal guide","machined",(x-278,320+dy,1022),(x+48,320+dy,1022),7)
        self.group(f"ServoX{number}",(x,side*650,1025))
        self.motor("Horizontal servo",x,side*653,1025,True)
        # ST-06 carries its insert carriage along the straight leg of the loop.
        y=side*(320 if i==5 else 435)
        self.group(f"ServoZ{number}",(x,y,1055))
        self.plate("Crosshead","teal",x,y,1045,106,76,24,9)
        self.plate("Z axis slide","machined",x,y,1112,73,57,125,6)
        self.motor("Vertical servo",x,y,1198,False)
        for dx in (-23,23): self.disk("Linear bushing","gunmetal",x+dx,y,1028,12,28)
        self.group(f"Tool{number}",(x,y,906))
        for dx in (-23,23): self.disk("Gib rod","machined",x+dx,y,991,7,105)
        self.plate("End effector wrist","gunmetal",x,y,935,82,57,19,6)
        if i in (0,3,5,7):
            self.plate("Vacuum manifold","teal",x,y,918,96,35,18,4)
            for dx in (-33,33):
                self.disk("Spring compensator","brass",x+dx,y,897,6,28)
                self.turn("Bellows suction cup","rubber",x+dx,y,880,[(0,11),(7,11),(10,7),(7,4),(13,0),(10,-2),(17,-7),(17,-10),(0,-10)])
        elif i in (2,4):
            self.plate("Parallel gripper body","teal",x,y,915,76,55,26,7)
            for dx in (-29,29):
                self.plate("Gripper finger","machined",x+dx,y,889,11,25,45)
                self.plate("Soft jaw","rubber",x+dx*.81,y,873,10,25,13)
        else:
            self.plate("Forming die","aluminium",x,y,908,94,70,36,11)
            self.plate("Tool face","linen",x,y,885,88,64,13,10)

    def insert_clamp(self):
        self.group("InsertClamp")
        self.plate("Clamp foot","gunmetal",250,-169,686,91,111,22,8)
        self.plate("Riser","machined",250,-164,754,51,53,120,6)
        self.plate("Cylinder body","teal",250,-183,829,58,92,49,7)
        for y in (-231,-135):
            self.plate("Cylinder end cap","machined",250,y,829,59,8,50,6)
            self.disk("Push fitting","brass",274,y,852,6,10)
        for dx in (-21,21):
            self.link("Tie rod","stainless",(250+dx,-234,811),(250+dx,-130,811),3)
        self.group("ClampJaw",(250,-258,829))
        self.link("Piston rod","machined",(250,-213,829),(250,-256,829),8)
        self.plate("Jaw carrier","gunmetal",250,-255,830,64,10,28,4)
        self.plate("Compliant jaw","rubber",250,-263,830,60,7,22,3)

    def supply(self):
        self.group("BlankMagazine")
        for j in range(13): self.plate("Die-cut blank","kraft" if j%2==0 else "linen",-966,-557,697+4*j,154,139,3.5,9)
        for dx in (-89,89):
            for dy in (-65,65): self.disk("Magazine finger","machined",-966+dx,-557+dy,762,5,155)
        self.group("InsertFeeder")
        self.disk("Vibratory base","teal",11,-558,710,113,67)
        self.turn("Spun feeder bowl","stainless",11,-558,741,[(0,0),(87,0),(99,18),(120,80),(120,91),(114,91),(110,78),(93,22),(75,9),(0,9)])
        for j in range(3):
            self.turn("Bowl feed shelf","machined",11,-558,772+j*14,[(95,0),(111,0),(111,4),(95,4)],(0,0,j*110),120)
        self.plate("Escapement chute","teal",143,-558,806,146,28,14)
        self.group("LeafletCassette")
        for j in range(9): self.plate("Leaflet","linen",483,560,700+j*5,127,94,4,2)
        for dx in (-72,72): self.plate("Cassette side","stainless",483+dx,560,738,8,109,95)

    def finishing_table(self):
        self.group("PlanarTiles")
        for col in range(5):
            for row in range(3):
                x,y=-1280-col*240,480+row*240
                self.plate("Tile electronics","gunmetal",x,y,708,237,237,59,12)
                self.plate("Planar working face","stainless",x,y,742,234,234,10,11)
                for dx in (-98,98):
                    for dy in (-98,98): self.fastener(x+dx,y+dy,748,3)
        for i,(x,y) in enumerate([(-1760,480),(-2200,480),(-2200,960)]):
            self.group(["VerificationArch","VisionArch","PackArch"][i])
            sign=-1 if i<2 else 1
            for dx in (-101,101):
                self.plate("Bridge foot","gunmetal",x+dx,y+sign*141,690,74,72,21,8)
                self.link("Bridge column","aluminium",(x+dx,y+sign*141,700),(x+dx,y+sign*141,1100),40,True)
            self.link("Bridge crossmember","aluminium",(x-121,y+sign*141,1098),(x+121,y+sign*141,1098),40,True)
            self.plate("Tool cantilever","machined",x,y+sign*66,1104,55,173,18)
            if i==1:
                self.plate("Vision camera","teal",x,y,1057,64,65,76,8)
                self.turn("Lens barrel","motor",x,y,997,[(0,-19),(22,-19),(24,-14),(21,-8),(23,-4),(23,13),(18,21),(0,21)])
                self.disk("Ring illuminator","linen",x,y,970,40,8,21)
                self.disk("Optical glass","blue",x,y,979,16,3)
            else:
                self.disk("Tool cylinder","machined",x,y,1061,23,75)
                self.disk("Cylinder rod","stainless",x,y,994,10,64)
                self.plate("Verification pad" if not i else "Pack platen","teal",x,y,956,97,83,15,12)
        self.group("Handoff")
        self.link("Transfer rail","aluminium",(-747,320,1120),(-1320,480,1120),45,True)
        self.link("Transfer guide","machined",(-747,320,1149),(-1320,480,1149),7)
        self.link("End upright","aluminium",(-1320,334,685),(-1320,334,1120),40,True)
        self.plate("Cantilever","teal",-1320,405,1120,67,185,17)

    def services(self):
        self.group("PanelDisconnect")
        self.plate("Disconnect surround","yellow",572,-658,494,64,12,65,6)
        self.disk("Disconnect spindle","red",572,-669,494,19,17,rot=(90,0,0))
        self.plate("Rotary disconnect lever","red",572,-683,502,13,14,48,4)
        self.group("SignalTower")
        self.plate("Beacon mount","paint",1139,709,1638,88,88,12,8)
        self.disk("Stack support","stainless",1139,709,1685,12,84)
        for level, finish in enumerate(("red","orange","green")):
            self.disk("Light separator","motor",1139,709,1730+33*level,23,6)
            self.disk("Signal lens",finish,1139,709,1748+33*level,22,30)
        self.disk("Stack cap","motor",1139,709,1834,23,7)
        self.group("AirPreparation")
        self.plate("Air unit bracket","gunmetal",-590,-719,472,230,47,90,8)
        for dx in (-78,0,78):
            x=-590+dx
            self.plate("Valve head","teal",x,-751,483,62,62,51,7)
            self.turn("Filter bowl","machined",x,-751,407,[(0,-46),(14,-46),(23,-31),(24,38),(20,51),(0,51)])
            self.disk("Drain","brass",x,-751,354,7,15)
        self.disk("Gauge bezel","motor",-590,-792,494,27,16,rot=(90,0,0))
        self.disk("Gauge face","linen",-590,-802,494,23,3,rot=(90,0,0))
        self.link("Needle","gunmetal",(-590,-805,494),(-577,-805,506),1.4)
        self.link("Air supply","blue",(-477,-748,482),(-368,-748,482),5)

    def carrier(self,i,x,y,yaw):
        tag=f"{i+1:02}"
        self.group("Mover"+tag,(x,y,790))
        # Rotate each cart's nest into the tangent at its home slot.
        def world(dx,dy):
            a=radians(yaw)
            return x+dx*cos(a)-dy*sin(a),y+dx*sin(a)+dy*cos(a)
        r=(0,0,yaw)
        self.plate("Mover chassis","gunmetal",x,y,780,145,116,30,16,r)
        self.plate("Nest pallet","teal" if i<10 else "machined",x,y,802,139,105,17,13,r)
        for dx in (-55,55):
            for dy in (-41,41):
                xx,yy=world(dx,dy)
                self.disk("Nest locator","brass",xx,yy,817,4,15)
                if i<10:
                    xx,yy=world(dx,dy*.83)
                    self.disk("Guide wheel","stainless",xx,yy,766,12,12,rot=(90,0,yaw))
        self.group("Box"+tag,(x,y,848))
        self.plate("Carton","kraft",x,y,847,92,75,71,3,r)
        self.plate("Folded top","linen",x,y,883,92,74,2,2,r)
        self.plate("Closure seam","kraft",x,y,885,92,3,1,.4,r)
