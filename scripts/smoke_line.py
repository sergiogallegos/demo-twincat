"""HTTP acceptance test for a clean continuous-line simulator. Ends in Automatic / Stopped."""
import argparse
import json
import time
from urllib.request import Request, urlopen
from urllib.error import HTTPError

from measure_rate import measure_rate


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:5080")
    parser.add_argument("--measure-rate", action="store_true", help="Measure 30 steady-state output intervals in wall-clock time")
    args = parser.parse_args()
    base = args.url.rstrip("/")

    def snapshot():
        with urlopen(base + "/api/machine", timeout=4) as response:
            return json.load(response)

    def wait(predicate, timeout=5):
        until = time.monotonic() + timeout
        while time.monotonic() < until:
            data = snapshot()
            if predicate(data):
                return data["frame"]
            time.sleep(.05)
        raise AssertionError(f"Timed out in {data['frame']['state']} with {data['issue']}")

    def send(command, ok=True, occurrence=None):
        if ok:
            wait(lambda s: command in s["allowed"])
        req = Request(base + "/api/commands", json.dumps(dict(command=command, occurrence=occurrence)).encode(),
                      headers={"Content-Type": "application/json"})
        try:
            with urlopen(req, timeout=4) as response:
                assert ok and response.status == 202
        except HTTPError as error:
            assert not ok and error.code == 409, error
        wait(lambda s: s["pending"] is None)

    initial = snapshot()
    assert initial["source"] == "Simulation" and initial["frame"]["state"] == "Stopped"
    assert initial["frame"]["line"]["enabled"] and initial["frame"]["line"]["issued"] == 0
    send("Reset")
    send("Start")
    active = wait(lambda s: s["frame"]["line"]["good"] >= 2, 32)["line"]
    assert active["lastChecked"] == 1023
    assert sum(bool(v) for v in active["products"]) > 5
    if args.measure_rate:
        measure_rate(snapshot)
    send("Hold")
    held = wait(lambda s: s["frame"]["state"] == "Held")["line"]
    time.sleep(.25)
    next_line = snapshot()["frame"]["line"]
    assert held["products"] == next_line["products"] and held["tick"] == next_line["tick"]
    send("Unhold")
    send("MissingSeal")
    wait(lambda s: s["frame"]["line"]["rejected"] >= 1)
    send("RestoreSeal")
    send("JamClamp")
    alarm = wait(lambda s: s["frame"]["state"] == "Aborted")["line"]
    assert alarm["alarm"] == 1 and alarm["clampRequest"] and alarm["clampMm"] < 16
    send("AckClamp", False, alarm["occurrence"]+1)
    send("ReleaseClamp")
    send("Clear", False)
    send("AckClamp", occurrence=alarm["occurrence"])
    send("Clear")
    send("Precision")
    send("Reset")
    reset = wait(lambda s: s["frame"]["state"] == "Idle")["line"]
    assert not any(reset["products"]) and reset["discarded"] > 0
    send("Stop")
    send("Standard")
    assert snapshot()["frame"]["state"] == "Stopped"
    print("PASS  continuous pipeline, ten checks, hold, reject, F02 identity, recovery and recipe interlocks")


if __name__ == "__main__":
    main()
