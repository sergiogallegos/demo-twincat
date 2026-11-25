const paths: Record<string, string> = {
  devices: 'M2 16h20 M4 8h6v5H4z M15 8h5v5h-5z M6 19h12',
  overview: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  states: 'M3 4h6v6H3z M15 14h6v6h-6z M6 10v7h9 M9 7h9v7',
  alarms: 'M12 3 22 20H2z M12 9v5 M12 17v.1',
  design: 'M3 4c4-1 7 0 9 2 2-2 5-3 9-2v15c-4-1-7 0-9 2-2-2-5-3-9-2z M12 6v15',
  cube: 'm12 2 9 5v10l-9 5-9-5V7z M3 7l9 5 9-5 M12 12v10',
  reset: 'M4 10a8 8 0 1 1 1 7 M4 4v6h6',
  pulse: 'M2 12h5l3-7 4 14 3-7h5',
  mode: 'M3 6h18 M3 18h18 M8 3v6 M16 15v6',
  carton: 'm3 8 9-5 9 5v10l-9 4-9-4z M3 8l9 5 9-5 M12 13v9 M8 5l9 5',
  station: 'M3 20h18 M5 20V5h14v15 M12 5v8 M9 14h6',
  play: 'm7 4 12 8-12 8z',
  arrow: 'M4 12h16 M14 6l6 6-6 6',
  msg: 'M3 4h18v13H9l-5 4v-4H3z',
  log: 'M4 5h16 M4 12h16 M4 19h11',
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}
