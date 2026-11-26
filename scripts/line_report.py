"""Capture read-only machine samples in SQLite and export cumulative production metrics as CSV."""
import argparse
import csv
import datetime as dt
import json
import sqlite3
import time
from urllib.request import urlopen


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument("--url", default="http://127.0.0.1:5080")
    cli.add_argument("--db", default="carton-line.sqlite3")
    cli.add_argument("--csv", default="carton-line.csv")
    cli.add_argument("--seconds", type=int, default=10)
    args = cli.parse_args()
    if args.seconds < 1:
        cli.error("seconds must be positive")
    with sqlite3.connect(args.db) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS samples(
            session TEXT, utc TEXT, source TEXT, state TEXT, recipe TEXT, good INTEGER,
            rejected INTEGER, in_process INTEGER, reset_discards INTEGER, ideal_ticks INTEGER,
            run_ticks INTEGER, planned_ticks INTEGER, PRIMARY KEY(session,utc))""")
        db.execute("""CREATE TABLE IF NOT EXISTS events(session TEXT, id INTEGER, utc TEXT,
            kind TEXT, message TEXT, PRIMARY KEY(session,id))""")
        for i in range(args.seconds):
            with urlopen(args.url.rstrip("/")+"/api/machine", timeout=4) as response:
                s = json.load(response)
            if not s["online"] or not s["frame"]["line"]["enabled"] or s["frame"]["manual"]:
                raise SystemExit("An online continuous-line source is required.")
            l = s["frame"]["line"]
            with db:
                db.execute("INSERT INTO samples VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (
                    s["session"],dt.datetime.now(dt.timezone.utc).isoformat(),s["source"],s["frame"]["state"],
                    "precision" if l["precision"] else "standard",l["good"],l["rejected"],
                    sum(bool(v) for v in l["products"]),l["discarded"],l["idealTicks"],l["runTicks"],l["plannedTicks"]))
                db.executemany("INSERT OR IGNORE INTO events VALUES(?,?,?,?,?)",
                    [(s["session"],e["id"],e["at"],e["kind"],e["text"]) for e in s["events"]+s["alarms"]])
            if i+1 < args.seconds:
                time.sleep(1)
        rows = db.execute("""SELECT *, round(100.0*run_ticks/nullif(planned_ticks,0),2) AS availability_pct,
            round(100.0*ideal_ticks/nullif(run_ticks,0),2) AS performance_pct,
            round(100.0*good/nullif(good+rejected,0),2) AS quality_pct,
            round(100.0*ideal_ticks*good/nullif(planned_ticks*(good+rejected),0),2) AS oee_pct
            FROM samples ORDER BY utc""")
        with open(args.csv,"w",newline="",encoding="utf-8") as out:
            writer=csv.writer(out)
            writer.writerow([c[0] for c in rows.description])
            writer.writerows(rows)
    print(f"Captured {args.seconds} samples in {args.db}; exported {args.csv}")


if __name__ == "__main__":
    main()
