"""Fetch Beckhoff component drawings for the optional local CAD detail layer."""
import hashlib
import io
import json
import urllib.request
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "cad" / "vendor"
BASE = "https://download.beckhoff.com/download/technical_drawings/"
PARTS = {
    "feed-motor": "Drive_Technology/step/AM80xx/am8021-xx00_stp.zip",
    "track-mover": "Drive_Technology/step/xts/at9011-0070-0550_mover_6_rollers-142044.zip",
    "sort-tile": "Drive_Technology/step/xplanar/aps4322-0000-0000.stp.zip",
    "sort-mover": "Drive_Technology/step/xplanar/apm4220-0000-0000.stp.zip",
    "camera": "vision/vcs2000/vcs20xx.stp.zip",
}


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = {}
    for name, drawing in PARTS.items():
        url = BASE + drawing
        with urllib.request.urlopen(url, timeout=60) as response:
            archive = response.read()
        with zipfile.ZipFile(io.BytesIO(archive)) as package:
            entries = [f for f in package.namelist() if f.lower().endswith((".step", ".stp"))]
            if len(entries) != 1:
                raise ValueError(f"{name}: expected one drawing, received {entries}")
            step = package.read(entries[0])
        if b"ISO-10303-21" not in step[:200]:
            raise ValueError(f"Invalid STEP header for {name}")
        (OUTPUT / f"{name}.step").write_bytes(step)
        manifest[name] = {"source": url, "file": entries[0], "sha256": hashlib.sha256(step).hexdigest()}
        print(name, entries[0], len(step), "bytes")

    (OUTPUT / "sources.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
