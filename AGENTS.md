# Project guide

Start with README.md, docs/architecture.md and docs/ads.md. Open the owning subsystem before editing it.

- plc/ owns state transitions, permissives and production counts in ADS mode. Preserve one-scan command sampling and the finished latch.
- server/ selects the machine source and serializes requests. Maintain simulator parity when changing the PLC behavior.
- web/ renders snapshots and sends explicit commands. Derive position from machine feedback and apply Prettier to TypeScript and CSS.
- cad/geometry.py defines the mechanical assembly. Regenerate both native files and web assets when geometry changes.
- Keep public material original. Credit Sergio Gallegos, Beckhoff, the SPT Framework and PackML as appropriate.

Use the quick start and run scripts/smoke.py with a clean simulator. For PLC changes, verify in XAE and on an isolated test runtime when available. Report precisely which verification ran. Update the wire contract and commissioning examples when changing operator behavior.

Track implementation and acceptance in [the shared board](docs/board.md). The default continuous profile has ten XTS carts and six planar movers. Preserve per-carton ownership and inspection masks during handoff. Keep the single-carton bench selectable while Stopped. For changes to continuous behavior run the deterministic LineBench and scripts/smoke_line.py in addition to the bench smoke test. Keep the global machine state header and bottom control dock accessible on every page.
