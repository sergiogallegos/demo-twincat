"""Prepare pinned native Beckhoff samples alongside the original lab POUs."""
import argparse
import hashlib
import io
from pathlib import Path
import subprocess
import urllib.request
import zipfile

PROJECT = Path(__file__).resolve().parents[1]
SAMPLES = {
    "xts": ("Beckhoff-USA-Community/SPT_XTS_Sample", "709425147f3fbd6f5206413210ca1d73f0080d59",
            "SPT XTS Sample Project/SPT XTS Sample Project.tsproj"),
    "vision": ("Beckhoff/TF7xxx_Samples", "be2d0432858658de0b1ca4ebe5d27e0559e9c525",
               "PLC/FirstSteps/TF7xxx_FirstSteps/TF7xxx_FirstSteps.sln"),
}
SERVO = "https://infosys.beckhoff.com/content/1033/tcplclib_tc2_mc2/Resources/2386997515.zip"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("lab", choices=["servo", "xts", "vision", "xplanar"])
    parser.add_argument("--output", type=Path, default=PROJECT / "labs" / "downloads")
    args = parser.parse_args()
    if args.lab == "xplanar":
        print(PROJECT / "labs/xplanar/PRG_SortShuttle.TcPOU")
        print("Follow docs/device-labs.md to link the mover in a simulation MC project.")
        return

    dest = args.output.resolve() / args.lab
    if args.lab == "servo":
        dest.mkdir(parents=True, exist_ok=True)
        with urllib.request.urlopen(SERVO, timeout=60) as response:
            payload = response.read()
        if hashlib.sha256(payload).hexdigest() != "4cda25c0216daddc8a4246ac3b0a7de1831430a118be4fea789198d017ea5a84":
            raise ValueError("The published archive changed. Review its contents before updating the pin.")
        with zipfile.ZipFile(io.BytesIO(payload)) as archive:
            target = dest / "Sample_PTP_Move.tnzip"
            target.write_bytes(archive.read(target.name))
    else:
        repo, revision, entry = SAMPLES[args.lab]
        if not dest.exists():
            dest.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["git", "clone", "https://github.com/" + repo + ".git", str(dest)], check=True)
            subprocess.run(["git", "-C", str(dest), "checkout", "--detach", revision], check=True)
        head = subprocess.check_output(["git", "-C", str(dest), "rev-parse", "HEAD"], text=True).strip()
        if head != revision:
            raise ValueError("Existing checkout has a different revision. Use another --output directory.")
        target = dest / entry

    if not target.is_file():
        raise FileNotFoundError(target)
    print(target)


if __name__ == "__main__":
    main()
