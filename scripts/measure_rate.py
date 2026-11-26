"""Measure 30 good-carton discharge intervals on a running HMI using read-only HTTP requests."""
import argparse
import json
import time
from urllib.request import urlopen


def measure_rate(snapshot):
    baseline = snapshot()
    session = baseline["session"]
    source = baseline["source"]

    def sample():
        state = snapshot()
        frame = state["frame"]
        if (not state["online"] or state["source"] != source or state["session"] != session
                or frame["state"] != "Execute" or not frame["line"]["enabled"]):
            raise RuntimeError("Measurement requires uninterrupted Execute on the same continuous line.")
        return frame["line"]

    def next_output(previous, quantity, timeout):
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            line = sample()
            if line["good"] >= previous + quantity:
                return line, time.monotonic()
            time.sleep(.05)
        raise RuntimeError(f"Timed out waiting for {quantity} good discharges.")

    first, started = next_output(sample()["good"], 1, 35)
    last, ended = next_output(first["good"], 30, 70)
    quantity = last["good"] - first["good"]
    seconds = ended - started
    rate = quantity * 60 / seconds
    if last["rejected"] != first["rejected"] or abs(rate - 30) >= .5:
        raise AssertionError(f"Expected 30 good cartons/min without rejects, observed {rate:.2f}/min, "
                             f"{last['rejected'] - first['rejected']} rejects.")
    print(f"PASS  {source}: {quantity} good cartons in {seconds:.2f} s "
          f"({rate:.2f}/min, {seconds / quantity:.3f} s/carton)")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--url", default="http://127.0.0.1:5080")
    base = parser.parse_args().url.rstrip("/")

    def read_machine():
        with urlopen(base + "/api/machine", timeout=4) as response:
            return json.load(response)

    measure_rate(read_machine)
