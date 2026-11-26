import type { LineFrame } from './model';

export const operations = [
  'Feed blank',
  'Form tray',
  'Seat insert',
  'Load base',
  'Fit module',
  'Add leaflet',
  'Close lid',
  'Transfer',
];
export const planarOps = [
  'Receive',
  'Verify assembly',
  'Seal vision',
  'Final pack',
  'Return',
  'Return',
];
const table = [
  [-1320, 480],
  [-1760, 480],
  [-2200, 480],
  [-2200, 960],
  [-1760, 960],
  [-1320, 960],
];

export function pose(i: number, line: LineFrame): [number, number] {
  const n = i < 10 ? 10 : 6;
  const slot = ((i < 10 ? i : i - 10) + line.index) % n;
  const f = line.travel / 1000;
  const t = slot + f;
  if (i >= 10) {
    const [x, y] = table[slot],
      [tx, ty] = table[(slot + 1) % 6];
    return [x + (tx - x) * f, y + (ty - y) * f];
  }
  if (t < 3) return [-750 + t * 500, -320];
  if (t < 5) {
    const a = ((t - 3) * Math.PI) / 2 - Math.PI / 2;
    return [750 + Math.cos(a) * 320, Math.sin(a) * 320];
  }
  if (t < 8) return [750 - (t - 5) * 500, 320];
  const a = ((t - 8) * Math.PI) / 2 + Math.PI / 2;
  return [-750 + Math.cos(a) * 320, Math.sin(a) * 320];
}
