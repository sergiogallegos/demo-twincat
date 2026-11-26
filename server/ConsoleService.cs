using System.Diagnostics;

namespace CartonCell;

public record ConsoleEvent(long Id, DateTimeOffset At, string Kind, string Text);

public sealed class ConsoleService(IMachine machine, IConfiguration config, ILogger<ConsoleService> logger)
    : BackgroundService
{
    private readonly object gate = new();
    private readonly Queue<ConsoleEvent> history = new();
    private Frame? current;
    private readonly Guid session = Guid.NewGuid();
    private readonly Queue<ConsoleEvent> alarmHistory = new();
    private long eventId;
    private int previousRecovery;
    private long heartbeatAt;
    private int? pending;
    private long pendingAt;
    private bool online;
    private string? issue;

    private void Log(string kind, string text)
    {
        var entry = new ConsoleEvent(++eventId, DateTimeOffset.UtcNow, kind, text);
        history.Enqueue(entry);
        if (text.StartsWith("F02 #", StringComparison.Ordinal))
        {
            alarmHistory.Enqueue(entry);
            if (alarmHistory.Count > 128) alarmHistory.Dequeue();
        }
        while (history.Count > 60)
        {
            history.Dequeue();
        }
    }

    private void Poll()
    {
        Frame next = machine.Read();
        if (current?.Heartbeat != next.Heartbeat)
        {
            heartbeatAt = Stopwatch.GetTimestamp();
        }
        if (Stopwatch.GetElapsedTime(heartbeatAt).TotalSeconds > 2)
        {
            throw new IOException("PLC scan heartbeat stopped.");
        }
        if (!online)
        {
            Log("Connection", "Telemetry connected");
        }
        if (current?.State != next.State)
        {
            Log("Transition", $"{current?.State.ToString() ?? "Connect"} → {next.State}");
        }
        if (current?.Manual != next.Manual)
        {
            Log("Mode", next.Manual ? "Manual station control" : "Automatic cycle");
        }
        if (current?.Station != next.Station && next.Station > 0)
        {
            Log("Station", $"Station {next.Station:00} selected");
        }
        if (current?.AirFault != next.AirFault && (next.AirFault || current is not null))
        {
            Log(next.AirFault ? "Fault" : "Recovery", next.AirFault ? "F01 · Supply pressure lost" : "Supply pressure restored");
        }
        if (current?.LowStock != next.LowStock && (next.LowStock || current is not null))
        {
            Log(next.LowStock ? "Warning" : "Recovery", next.LowStock ? "W01 · Blank magazine low" : "Blank magazine refilled");
        }
        if (current?.Devices.Inspection != next.Devices.Inspection && next.Devices.Inspection != SealResult.Pending)
        {
            Log("Inspection", $"Seal {next.Devices.Inspection} · {next.Devices.BrightSamples}/5 bright samples");
        }

        if (next.Line is { } line && current?.Line is { } previous)
        {
            if (line.Occurrence != previous.Occurrence) Log("Fault", $"F02 #{line.Occurrence} · ST-03 clamp extend timeout");
            if (line.Alarm == 2 && previous.Alarm == 1) Log("Alarm", $"F02 #{line.Occurrence} · acknowledged");
            if (!line.Jammed && previous.Jammed && line.Alarm != 0) Log("Recovery", $"F02 #{line.Occurrence} · obstruction removed");
            if (line.Alarm == 0 && previous.Alarm > 0) Log("Recovery", $"F02 #{line.Occurrence} · cleared");
            if (next.State == CellState.Idle && previousRecovery != 0)
            {
                Log("Recovery", $"F02 #{previousRecovery} · reset complete");
                previousRecovery = 0;
            }
            if (line.Alarm != 0) previousRecovery = line.Occurrence;
            if (line.LastId != previous.LastId) Log("Discharge", $"Carton {line.LastId} · {(line.LastFailed == 0 && line.LastChecked == 1023 ? "packed" : "reject")} · checks 0x{line.LastChecked:X3}");
        }

        if (pending == next.Ack)
        {
            Log("Command", $"{(OperatorCommand)(next.Ack & 255)} · {(next.Accepted ? "accepted" : "rejected by PLC")}");
            pending = null;
        }
        else if (pending is not null && Stopwatch.GetElapsedTime(pendingAt).TotalSeconds > 2)
        {
            Log("Command", "Acknowledgment timed out · check machine state before retrying");
            pending = null;
        }

        current = next;
        online = true;
        issue = null;
    }

    private void Disconnected(Exception error)
    {
        if (online || issue is null)
        {
            logger.LogWarning("Machine unavailable: {Message}", error.Message);
            Log("Connection", "Telemetry unavailable");
        }
        online = false;
        issue = error.Message;
        if (pending is not null)
        {
            Log("Command", "Connection lost · command outcome unknown");
        }
        pending = null;
        machine.Dispose();
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            lock (gate)
            {
                try
                {
                    Poll();
                }
                catch (Exception ex)
                {
                    Disconnected(ex);
                }
            }
            await Task.Delay(online ? 80 : 1000, stoppingToken);
        }
    }

    public object Snapshot()
    {
        lock (gate)
        {
            return new
            {
                session,
                alarms = alarmHistory.Reverse().ToArray(),
                source = config["Machine:Source"],
                online,
                issue,
                pending,
                frame = current,
                allowed = online && pending is null && current is not null
                    ? Enum.GetValues<OperatorCommand>().Where(current.Allows).ToArray() : [],
                events = history.Reverse().ToArray()
            };
        }
    }

    public IResult AddMessage(string? message)
    {
        string text = message?.Trim() ?? string.Empty;
        if (text.Length is 0 or > 200)
        {
            return Results.BadRequest("Use 1 to 200 characters.");
        }

        lock (gate)
        {
            Log("Operator", text);
            return Results.NoContent();
        }
    }

    public IResult Command(OperatorCommand command, int? occurrence)
    {
        lock (gate)
        {
            try
            {
                Poll();
                if (pending is not null || !current!.Allows(command))
                {
                    return Results.Conflict("Command is unavailable in the current state.");
                }
                // A single DINT couples the command with its acknowledgment token.
                int sequence = ((current.Ack >> 8) % 0x7ffffe) + 1;
                if (command == OperatorCommand.AckClamp)
                {
                    if (occurrence is null || occurrence != current.Line?.Occurrence)
                        return Results.Conflict("The alarm occurrence has changed.");
                    sequence = occurrence.Value;
                }
                pending = (sequence << 8) | (int)command;
                pendingAt = Stopwatch.GetTimestamp();
                machine.Write(pending.Value);
                return Results.Accepted();
            }
            catch (Exception ex)
            {
                Disconnected(ex);
                return Results.Problem("Machine unavailable.", statusCode: 503);
            }
        }
    }
}
