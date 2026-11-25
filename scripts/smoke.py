"""Exercise a freshly started simulator through the same HTTP API as the HMI."""
import argparse
import json
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:5080")
    url = parser.parse_args().url.rstrip("/")

    def request(path, payload=None):
        data = None if payload is None else json.dumps(payload).encode()
        req = Request(url + path, data=data, headers={"Content-Type": "application/json"})
        with urlopen(req, timeout=4) as response:
            return json.loads(body) if (body := response.read()) else None

    def wait(predicate, timeout=5):
        end = time.monotonic() + timeout
        while time.monotonic() < end:
            snapshot = request("/api/machine")
            if predicate(snapshot):
                return snapshot["frame"]
            time.sleep(0.05)
        raise AssertionError("Machine did not reach expected condition: " + str(snapshot))

    def state(name):
        return wait(lambda s: s["frame"]["state"] == name)

    def command(name):
        wait(lambda s: name in s["allowed"])
        request("/api/commands", {"command": name})
        wait(lambda s: s["pending"] is None)

    def rejected(name):
        try:
            request("/api/commands", {"command": name})
        except HTTPError as error:
            assert error.code == 409, error
            return
        raise AssertionError("Unexpectedly accepted " + name)

    initial = request("/api/machine")
    if initial["source"] != "Simulation" or initial["frame"]["state"] != "Stopped" or initial["frame"]["manual"]:
        raise SystemExit("Start a fresh local Simulation host in Automatic / Stopped before this test.")
    count = initial["frame"]["cartons"]
    rejected("Start")
    command("Reset")
    state("Idle")
    command("Start")
    state("Execute")
    command("Hold")
    held = state("Held")
    time.sleep(0.3)
    assert state("Held")["phase"] == held["phase"]
    command("Unhold")
    state("Execute")
    command("Suspend")
    state("Suspended")
    command("Unsuspend")
    seen = set()

    def cycle_complete(snapshot):
        frame = snapshot["frame"]
        if frame["state"] == "Execute":
            seen.add(frame["station"])
        return frame["state"] == "Complete"

    completed = wait(cycle_complete, 19)
    assert seen == {1, 2, 3, 4, 5} and completed["cartons"] == count + 1
    devices = completed["devices"]
    assert (devices["feedMm"], devices["trackMm"]) == (180, 2240)
    assert (devices["planarXmm"], devices["planarYmm"]) == (240, 120)
    assert (devices["inspection"], devices["brightSamples"]) == ("Pass", 5)
    print("PASS  five stations, hold, suspend, feed, track and accept lane")

    command("MissingSeal")
    command("Reset")
    state("Idle")
    command("Start")
    failed = wait(lambda s: s["frame"]["state"] == "Complete", 19)
    assert failed["cartons"] == count + 1
    assert failed["devices"]["rejected"] == devices["rejected"] + 1
    assert failed["devices"]["inspection"] == "Reject"
    assert failed["devices"]["planarYmm"] == -120
    assert failed["devices"]["brightSamples"] == 0
    command("RestoreSeal")
    print("PASS  missing seal, reject lane and independent counters")

    command("Stop")
    state("Stopped")
    command("Manual")
    for station in (1, 3, 5):
        command("Reset")
        state("Idle")
        rejected("Start")
        command("Stroke" + str(station))
        assert state("Execute")["station"] == station
        assert state("Complete")["cartons"] == count + 1
    print("PASS  isolated manual strokes and finished-carton counter")

    command("LowBlanks")
    assert request("/api/machine")["frame"]["lowStock"]
    command("DropAir")
    state("Aborted")
    rejected("Clear")
    command("RestoreAir")
    command("Clear")
    state("Stopped")
    command("Refill")
    command("Automatic")
    request("/api/messages", {"text": "Commissioning sequence verified"})
    end = request("/api/machine")
    kinds = {entry["kind"] for entry in end["events"]}
    assert {"Fault", "Warning", "Recovery", "Operator"} <= kinds
    assert not end["frame"]["airFault"] and not end["frame"]["lowStock"]
    print("PASS  fault recovery, warning, interlock and operator messages")


if __name__ == "__main__":
    main()
