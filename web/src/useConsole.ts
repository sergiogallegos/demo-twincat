import { useCallback, useEffect, useState } from 'react';
import type { Snapshot } from './model';

export function useConsole() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Chain requests so a slow response cannot overwrite newer PLC telemetry.
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch('/api/machine', {
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(2500),
          ]),
          cache: 'no-store',
        });
        if (!response.ok) throw new Error();
        const next: Snapshot = await response.json();
        if (!controller.signal.aborted) setData(next);
      } catch {
        if (!controller.signal.aborted)
          setData((previous) => ({
            source: previous?.source ?? 'Unknown',
            frame: previous?.frame ?? null,
            alarms: previous?.alarms ?? [],
            events: previous?.events ?? [],
            online: false,
            pending: null,
            allowed: [],
            issue: 'The HMI service is unreachable.',
          }));
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 140);
      }
    }
    void poll();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, []);

  const send = useCallback(async (command: string, occurrence?: number) => {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/commands', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, occurrence }),
        signal: AbortSignal.timeout(3500),
      });
      if (!response.ok)
        throw new Error(
          response.status === 409
            ? 'The machine state changed. Check the available controls.'
            : 'Command delivery could not be confirmed. Check the event log.',
        );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Command failed.');
    } finally {
      setBusy(false);
    }
  }, []);

  return { data, send, busy, error };
}
