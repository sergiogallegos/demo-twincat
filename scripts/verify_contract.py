"""Check PLC project wiring, the machine wire format and the bundled teaching fixtures."""
import json
from pathlib import Path
import re
import struct
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
PLC = ROOT / "plc/CartonPLC"


def main():
    project = ET.parse(PLC / "CartonPLC.plcproj")
    includes = {item.attrib["Include"] for item in project.findall(".//{*}Compile")}
    objects = {p.name for p in PLC.glob("*.Tc*")}
    assert includes == objects, (includes ^ objects)
    for name in includes:
        ET.parse(PLC / name)
    task = ET.parse(PLC / "PlcTask.TcTTO")
    assert task.findtext(".//PouCall/Name") == "MAIN"
    assert task.findtext(".//CycleTime") == "10000"

    def source(name):
        return (PLC / name).read_text(encoding="utf-8")

    plc_commands = re.findall(r"^\s*(\w+) := (\d+),?$", source("E_ConsoleCommand.TcDUT"), re.M)
    host = (ROOT / "server/Machine.cs").read_text(encoding="utf-8")
    enum_body = re.search(r"enum OperatorCommand\s*\{([^}]+)\}", host).group(1)
    host_commands = [field.strip().split()[0] for field in enum_body.split(",")]
    assert [(name, str(i)) for i, name in enumerate(host_commands, 1)] == plc_commands

    machine = source("FB_CartonCell.TcPOU")
    devices = source("FB_CellDevices.TcPOU")
    assert "Signature = 51002" in host and "StatusBuffer[0] := 51002" in machine
    assert "Status : ARRAY[0..19] OF DINT" in source("GVL_HMI.TcGVL")
    words = re.findall(r"(?:StatusBuffer|Words)\[(\d+)\] :=", machine + devices)
    assert {int(word) for word in words} == set(range(20))

    # BMP scan lines are bottom-up. Channel 0 is sufficient for the grayscale samples.
    inspector = source("FB_SealInspection.TcPOU")
    for file, name in [("sealed", "GoodPixels"), ("missing", "MissingPixels")]:
        image = (ROOT / f"web/public/vision/{file}.bmp").read_bytes()
        start = struct.unpack_from("<I", image, 10)[0]
        width, height = struct.unpack_from("<ii", image, 18)
        assert (width, height) == (160, 100)
        stride = ((width * 3 + 3) // 4) * 4
        pixels = [image[start + (height - 1 - (26 + 12*i)) * stride + 80*3] for i in range(5)]
        definition = re.search(name + r"[^;]+:= \[([^\]]+)\]", inspector)
        assert pixels == [int(n) for n in definition.group(1).split(",")]

    scene = (ROOT / "web/public/cell.glb").read_bytes()
    length = struct.unpack_from("<I", scene, 12)[0]
    nodes = {n["name"] for n in json.loads(scene[20:20+length])["nodes"]}
    assert {"FeedServo", "TrackCarrier", "SealCamera", "PlanarTile", "PlanarShuttle"} <= nodes
    assert all(f"Moving{i}_Rod" in nodes for i in range(5))
    print("PASS  task, project references, command IDs, status layout, pixel fixtures and CAD anchors")


if __name__ == "__main__":
    main()
