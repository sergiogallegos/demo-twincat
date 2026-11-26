export const stations = [
  {
    name: 'Blank feed',
    tool: 'Pick head',
    action: 'Present a flat blank from the magazine.',
  },
  {
    name: 'Carton form',
    tool: 'Forming mandrel',
    action: 'Press the blank into a rectangular carton.',
  },
  {
    name: 'Product load',
    tool: 'Loading ram',
    action: 'Lower one product into the open carton.',
  },
  {
    name: 'Flap close',
    tool: 'Closing platen',
    action: 'Fold the top flaps over the product.',
  },
  {
    name: 'Discharge',
    tool: 'Release plunger',
    action: 'Release the finished carton to outfeed.',
  },
];

export interface LineFrame {
  enabled: boolean;
  precision: boolean;
  tick: number;
  index: number;
  issued: number;
  good: number;
  rejected: number;
  lastId: number;
  lastFailed: number;
  jammed: boolean;
  occurrence: number;
  alarm: number;
  clampRequest: boolean;
  clampMm: number;
  runTicks: number;
  plannedTicks: number;
  idealTicks: number;
  discarded: number;
  products: number[];
  checked: number[];
  failed: number[];
  camX: number[];
  camZ: number[];
  travel: number;
  lastChecked: number;
}
export interface Frame {
  line: LineFrame;
  state: string;
  manual: boolean;
  station: number;
  phase: number;
  cartons: number;
  devices: {
    feedMm: number;
    trackMm: number;
    planarXmm: number;
    planarYmm: number;
    inspection: 'Pending' | 'Pass' | 'Reject';
    rejected: number;
    missingSeal: boolean;
    indexing: boolean;
    brightSamples: number;
  };
  airFault: boolean;
  lowStock: boolean;
}

export interface ConsoleEvent {
  id: number;
  at: string;
  kind: string;
  text: string;
}

export interface Snapshot {
  alarms?: ConsoleEvent[];
  frame: Frame | null;
  source: string;
  online: boolean;
  issue: string | null;
  pending: number | null;
  allowed: string[];
  events: ConsoleEvent[];
}

export function instruction(frame: Frame | null): string {
  if (frame?.line?.alarm)
    return 'F02 · Remove the clamp obstruction and acknowledge this occurrence, then Clear and Reset.';
  if (frame?.line?.enabled && !frame.manual && frame.state === 'Execute')
    return 'Continuous production. Hold preserves all cartons. Stop ends this run.';
  if (!frame) return 'Waiting for the first machine snapshot.';
  if (
    frame.state === 'Complete' &&
    !frame.manual &&
    frame.devices.inspection === 'Reject'
  )
    return 'Carton diverted to reject. Inspect the seal input before the next cycle.';
  if (frame.airFault)
    return 'Restore the simulated air supply, then clear the fault.';
  switch (frame.state) {
    case 'Stopped':
      return 'Reset the cell to prepare a new cycle.';
    case 'Idle':
      return frame.manual
        ? 'Select a station and request one stroke.'
        : 'The cell is ready. Start a carton cycle.';
    case 'Held':
      return 'Unhold to resume at the same cylinder position.';
    case 'Suspended':
      return 'Unsuspend when the downstream station is ready.';
    case 'Aborted':
      return 'Clear the abort, then reset the cell.';
    case 'Complete':
      return frame.manual
        ? 'Stroke complete. Reset to select another station.'
        : 'Carton discharged. Reset for the next cycle.';
    case 'Execute':
      return stations[frame.station - 1]?.action ?? 'Cycle in progress.';
    default:
      return 'Waiting for the unit to finish the transition.';
  }
}

export const displayCommand: Record<string, string> = {
  Start: 'Start cycle',
  Reset: 'Reset cell',
  Unhold: 'Resume',
  Unsuspend: 'Unsuspend',
  Clear: 'Clear abort',
  DropAir: 'Drop air supply',
  RestoreAir: 'Restore air',
  LowBlanks: 'Lower blank stock',
  Refill: 'Refill magazine',
};

export function phaseLabel(frame: Frame): string {
  if (!frame.station) return 'Home';
  if (frame.devices.indexing) return 'Indexing';
  if (frame.phase === 200) return 'Home confirmed';
  if (frame.phase === 100) return 'Forward limit';
  return frame.phase < 100 ? 'Extending' : 'Retracting';
}
