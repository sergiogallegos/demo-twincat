namespace CartonCell;

/// <summary>A portable, 10 ms teaching model of the PLC's virtual mechanism.</summary>
public sealed class SimulatedMachine : IMachine
{
    private readonly TimeProvider clock;
    private readonly long started;

    public SimulatedMachine(TimeProvider? time = null)
    {
        clock = time ?? TimeProvider.System;
        started = clock.GetTimestamp();
    }
    private long lastTick;
    private int actingTicks;
    private readonly CellDevices devices = new();
    private readonly ContinuousLine line = new();
    private Frame frame = Frame.Initial;

    public Frame Read()
    {
        long tick = clock.GetElapsedTime(started).Ticks / TimeSpan.TicksPerMillisecond / 10;
        while (lastTick < tick)
        {
            Step();
            lastTick++;
        }
        return frame with { Heartbeat = (int)(tick % int.MaxValue), Devices = devices.Feedback, Line = line.Snapshot() };
    }

    private void Enter(CellState target)
    {
        actingTicks = 0;
        frame = frame with { State = target };
    }

    private void Step()
    {
        line.Clock(frame.State == CellState.Execute && !frame.Manual && line.Enabled);
        if (frame.State == CellState.Execute && !frame.Manual && line.Enabled)
        {
            line.Step(devices.Feedback.MissingSeal);
            if (line.Alarm != 0) Enter(CellState.Aborting);
            return;
        }
        if (frame.State == CellState.Execute)
        {
            int phase = Math.Min(200, frame.Phase + 1);
            frame = frame with { Phase = phase };

            if (!frame.Manual)
            {
                devices.Process(frame.Station, phase);
            }

            if (phase < 200 || (!frame.Manual && !devices.ReadyToLeave(frame.Station)))
            {
                return;
            }

            if (frame.Manual || frame.Station == 5)
            {
                if (!frame.Manual && devices.FinishCarton())
                {
                    frame = frame with { Cartons = frame.Cartons + 1 };
                }

                Enter(CellState.Completing);
            }
            else if (devices.IndexToNextStation(frame.Station))
            {
                frame = frame with { Phase = 0, Station = frame.Station + 1 };
            }

            return;
        }

        if (actingTicks >= 45 || ++actingTicks != 45)
        {
            return;
        }
        CellState next = frame.State switch
        {
            CellState.Aborting => CellState.Aborted,
            CellState.Clearing or CellState.Stopping => CellState.Stopped,
            CellState.Resetting => CellState.Idle,
            CellState.Starting or CellState.Unholding or CellState.Unsuspending => CellState.Execute,
            CellState.Holding => CellState.Held,
            CellState.Suspending => CellState.Suspended,
            CellState.Completing => CellState.Complete,
            _ => frame.State
        };
        if (next != frame.State)
        {
            Enter(next);
        }
    }

    public void Write(int request)
    {
        frame = Read();
        if (frame.Ack == request) return;
        var command = (OperatorCommand)(request & 255);
        frame = frame with { Ack = request, Accepted = frame.Allows(command) };
        if (!frame.Accepted)
        {
            return;
        }
        switch (command)
        {
            case OperatorCommand.LoopLine:
            case OperatorCommand.Bench:
                line.Timing = false;
                line.Enabled = command == OperatorCommand.LoopLine;
                break;
            case OperatorCommand.Standard:
            case OperatorCommand.Precision:
                line.Precision = command == OperatorCommand.Precision;
                break;
            case OperatorCommand.JamClamp:
            case OperatorCommand.ReleaseClamp:
                line.Jammed = command == OperatorCommand.JamClamp;
                break;
            case OperatorCommand.AckClamp:
                frame = frame with { Accepted = line.Acknowledge(request >> 8) };
                break;
            case OperatorCommand.DropAir:
                frame = frame with { AirFault = true };
                if (frame.State is not (CellState.Aborted or CellState.Aborting))
                {
                    Enter(CellState.Aborting);
                }
                break;
            case OperatorCommand.RestoreAir:
                frame = frame with { AirFault = false };
                break;
            case OperatorCommand.MissingSeal:
            case OperatorCommand.RestoreSeal:
                devices.SetMissingSeal(command == OperatorCommand.MissingSeal);
                break;
            case OperatorCommand.LowBlanks:
                frame = frame with { LowStock = true };
                break;
            case OperatorCommand.Refill:
                frame = frame with { LowStock = false };
                break;
            case OperatorCommand.Automatic:
            case OperatorCommand.Manual:
                line.Timing = false;
                frame = frame with { Manual = command == OperatorCommand.Manual };
                break;
            case OperatorCommand.Start:
            case >= OperatorCommand.Stroke1 and <= OperatorCommand.Stroke5:
                line.Timing = !frame.Manual && line.Enabled;
                int station = frame.Manual ? (int)command - (int)OperatorCommand.Stroke1 + 1 : 1;
                frame = frame with { Station = !frame.Manual && line.Enabled ? 0 : station, Phase = 0 };
                Enter(CellState.Starting);
                break;
            case OperatorCommand.Reset:
                line.Reset();
                devices.Reset();
                frame = frame with { Station = 0, Phase = 0 };
                Enter(CellState.Resetting);
                break;
            case OperatorCommand.Clear:
                line.Recover();
                Enter(CellState.Clearing);
                break;
            case OperatorCommand.Abort:
                Enter(CellState.Aborting);
                break;
            case OperatorCommand.Stop:
                line.Timing = false;
                Enter(CellState.Stopping);
                break;
            case OperatorCommand.Hold:
                Enter(CellState.Holding);
                break;
            case OperatorCommand.Unhold:
                Enter(CellState.Unholding);
                break;
            case OperatorCommand.Suspend:
                Enter(CellState.Suspending);
                break;
            case OperatorCommand.Unsuspend:
                Enter(CellState.Unsuspending);
                break;
        }
    }

    public void Dispose() { }
}
